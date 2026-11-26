// Package huggingface is the single source of truth for talking to the
// Hugging Face Hub. Runtimes such as vLLM and SGLang should use this client
// instead of hard-coding Hub URLs, query parameters or caches.
package huggingface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

const (
	// DefaultBaseURL is the public Hugging Face Hub endpoint.
	DefaultBaseURL = "https://huggingface.co"

	// DefaultTimeout is applied when a caller does not provide its own client.
	DefaultTimeout = 30 * time.Second

	// UserAgent identifies this orchestration plane to the Hub.
	UserAgent = "orcn-huggingface-client/1.0"

	defaultSearchTTL        = 30 * time.Minute
	defaultBytesTTL         = 1 * time.Hour
	defaultMaxSearchEntries = 500
	defaultMaxBytesEntries  = 2000
	maxResponseBytes        = 64 << 20
)

var (
	// ErrModelNotFound is returned when the Hub has no model with the given ID.
	ErrModelNotFound = errors.New("model not found on Hugging Face")

	// ErrFileNotFound is returned when a model exists but the requested file
	// does not (for example a missing config.json).
	ErrFileNotFound = errors.New("file not found on Hugging Face")
)

// HTTPError describes a non-2xx Hub response.
type HTTPError struct {
	StatusCode int
	Status     string
	URL        string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("hugging face request failed: %s (%s)", e.Status, e.URL)
}

// Config configures a Client.
type Config struct {
	BaseURL          string
	HTTPClient       *http.Client
	SearchTTL        time.Duration
	BytesTTL         time.Duration
	MaxSearchEntries int
	MaxBytesEntries  int
}

// Option mutates a Config.
type Option func(*Config)

// WithBaseURL overrides the Hub base URL (for example a mirror such as
// https://hf-mirror.com).
func WithBaseURL(baseURL string) Option {
	return func(cfg *Config) { cfg.BaseURL = baseURL }
}

// WithHTTPClient supplies a custom HTTP client.
func WithHTTPClient(client *http.Client) Option {
	return func(cfg *Config) { cfg.HTTPClient = client }
}

// WithCacheTTL overrides the search and raw-response cache lifetimes.
func WithCacheTTL(searchTTL, bytesTTL time.Duration) Option {
	return func(cfg *Config) {
		cfg.SearchTTL = searchTTL
		cfg.BytesTTL = bytesTTL
	}
}

// Client talks to the Hugging Face Hub API.
type Client struct {
	baseURL    string
	apiBaseURL string
	httpClient *http.Client
	cache      *cache
}

// New creates a client. By default the base URL comes from
// HUGGINGFACE_BASE_URL or HF_ENDPOINT, falling back to DefaultBaseURL.
func New(opts ...Option) *Client {
	cfg := Config{
		BaseURL:          defaultBaseURL(),
		HTTPClient:       &http.Client{Timeout: DefaultTimeout},
		SearchTTL:        defaultSearchTTL,
		BytesTTL:         defaultBytesTTL,
		MaxSearchEntries: defaultMaxSearchEntries,
		MaxBytesEntries:  defaultMaxBytesEntries,
	}
	for _, opt := range opts {
		if opt != nil {
			opt(&cfg)
		}
	}

	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: DefaultTimeout}
	}

	return &Client{
		baseURL:    baseURL,
		apiBaseURL: baseURL + "/api",
		httpClient: cfg.HTTPClient,
		cache: newCache(
			cfg.SearchTTL,
			cfg.BytesTTL,
			cfg.MaxSearchEntries,
			cfg.MaxBytesEntries,
		),
	}
}

var defaultClient = New()

// Default returns the shared client used by runtimes.
func Default() *Client { return defaultClient }

// Configure replaces the shared client. Call it once during application
// startup, before serving requests.
func Configure(opts ...Option) *Client {
	defaultClient = New(opts...)
	return defaultClient
}

// BaseURL returns the Hub base URL (without a trailing slash).
func (c *Client) BaseURL() string { return c.baseURL }

// APIBaseURL returns the Hub API base URL.
func (c *Client) APIBaseURL() string { return c.apiBaseURL }

// FlushCache drops every cached search result and raw response.
func (c *Client) FlushCache() { c.cache.flush() }

// Search queries the Hub. When the query has several pipeline tags, one
// request is made per tag and the results are merged and de-duplicated.
func (c *Client) Search(ctx context.Context, query *SearchQuery) ([]Model, error) {
	if query == nil {
		query = NewSearchQuery("")
	}

	var merged []Model
	seen := make(map[string]bool)
	var lastErr error
	succeeded := false

	for _, pipelineTag := range query.pipelineTagList() {
		models, err := c.searchOne(ctx, query.forPipeline(pipelineTag))
		if err != nil {
			lastErr = err
			continue
		}
		succeeded = true
		for _, model := range models {
			if model.ID == "" || seen[model.ID] {
				continue
			}
			seen[model.ID] = true
			merged = append(merged, model)
		}
	}

	if !succeeded && lastErr != nil {
		return nil, lastErr
	}
	if len(query.pipelineTagList()) > 1 && query.sort == "downloads" && query.direction == "-1" {
		sort.SliceStable(merged, func(i, j int) bool {
			return merged[i].Downloads > merged[j].Downloads
		})
	}
	return merged, nil
}

func (c *Client) searchOne(ctx context.Context, query *SearchQuery) ([]Model, error) {
	cacheKey := query.CacheKey()
	if models, ok := c.cache.getSearch(cacheKey); ok {
		return models, nil
	}

	var models []Model
	if err := c.getJSON(ctx, query.URL(c.apiBaseURL), &models); err != nil {
		return nil, err
	}
	c.cache.putSearch(cacheKey, models)
	return models, nil
}

// Model fetches a model's typed metadata.
func (c *Client) Model(ctx context.Context, modelID string) (*Model, error) {
	data, err := c.getCachedBytes(ctx, c.ModelURL(modelID))
	if err != nil {
		return nil, translateModelError(err, modelID)
	}

	var model Model
	if err := json.Unmarshal(data, &model); err != nil {
		return nil, fmt.Errorf("decode model %q: %w", modelID, err)
	}
	return &model, nil
}

// ModelDetails returns the full raw model payload from the Hub.
func (c *Client) ModelDetails(ctx context.Context, modelID string) (map[string]any, error) {
	data, err := c.getCachedBytes(ctx, c.ModelURL(modelID))
	if err != nil {
		return nil, translateModelError(err, modelID)
	}

	var details map[string]any
	if err := json.Unmarshal(data, &details); err != nil {
		return nil, fmt.Errorf("decode model %q: %w", modelID, err)
	}
	return details, nil
}

// RawFile fetches a file from a model repository's main branch.
func (c *Client) RawFile(ctx context.Context, modelID, path string) ([]byte, error) {
	data, err := c.getCachedBytes(ctx, c.RawFileURL(modelID, path))
	if err != nil {
		var httpErr *HTTPError
		if errors.As(err, &httpErr) && httpErr.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("%w: %s/%s", ErrFileNotFound, modelID, path)
		}
		return nil, err
	}
	return data, nil
}

// RawJSON fetches and decodes a JSON file from a model repository.
func (c *Client) RawJSON(ctx context.Context, modelID, path string) (map[string]any, error) {
	data, err := c.RawFile(ctx, modelID, path)
	if err != nil {
		return nil, err
	}

	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, fmt.Errorf("decode %s/%s: %w", modelID, path, err)
	}
	return value, nil
}

// ModelURL returns the Hub API URL for one model.
func (c *Client) ModelURL(modelID string) string {
	return c.apiBaseURL + "/models/" + escapePath(modelID)
}

// RawFileURL returns the URL for a raw file on the model's main branch.
func (c *Client) RawFileURL(modelID, path string) string {
	return c.baseURL + "/" + escapePath(modelID) + "/raw/main/" + escapePath(path)
}

func (c *Client) getJSON(ctx context.Context, targetURL string, out any) error {
	data, err := c.getBytes(ctx, targetURL)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("decode response from %s: %w", targetURL, err)
	}
	return nil
}

func (c *Client) getCachedBytes(ctx context.Context, targetURL string) ([]byte, error) {
	cacheKey := "GET " + targetURL
	if data, ok := c.cache.getBytes(cacheKey); ok {
		return data, nil
	}

	data, err := c.getBytes(ctx, targetURL)
	if err != nil {
		return nil, err
	}
	c.cache.putBytes(cacheKey, data)
	return data, nil
}

func (c *Client) getBytes(ctx context.Context, targetURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", UserAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Drain a little of the body so the connection can be reused.
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return nil, &HTTPError{StatusCode: resp.StatusCode, Status: resp.Status, URL: targetURL}
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, err
	}
	return data, nil
}

func translateModelError(err error, modelID string) error {
	var httpErr *HTTPError
	if errors.As(err, &httpErr) && httpErr.StatusCode == http.StatusNotFound {
		return fmt.Errorf("%w: %s", ErrModelNotFound, modelID)
	}
	return err
}

func defaultBaseURL() string {
	for _, key := range []string{"HUGGINGFACE_BASE_URL", "HF_ENDPOINT"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return DefaultBaseURL
}

// escapePath escapes each path segment while preserving separators. Hub model
// IDs look like "org/name" and must keep their slash.
func escapePath(value string) string {
	segments := strings.Split(strings.Trim(value, "/"), "/")
	for index, segment := range segments {
		segments[index] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}
