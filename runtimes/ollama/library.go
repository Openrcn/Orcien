package ollama

import (
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"orcn/assets"
	"orcn/core"
)

const (
	libraryCacheTTL  = 30 * time.Minute
	libraryTimeout   = 15 * time.Second
	libraryUserAgent = "orcn-gateway/1.0 (+model-lookup)"
	maxSearchResults = 50
)

type libraryModel struct {
	Name        string   `json:"name"`
	Namespace   string   `json:"namespace"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	Pulls       int      `json:"pulls"`
	Parameters  float64  `json:"parameters"`
}

type libraryQuery struct {
	matchTags []string
}

func taskLibraryQuery(task core.ModelTask) (libraryQuery, error) {
	switch core.NormalizeModelTask(task) {
	case core.TaskTextGeneration:
		return libraryQuery{}, nil
	case core.TaskEmbedding:
		return libraryQuery{matchTags: []string{"embedding"}}, nil
	case core.TaskMultimodal:
		return libraryQuery{matchTags: []string{"vision"}}, nil
	case core.TaskDecision:
		return libraryQuery{matchTags: []string{"decision"}}, nil
	default:
		return libraryQuery{}, fmt.Errorf("ollama does not support task %q", task)
	}
}

type libraryModelCacheEntry struct {
	model     libraryModel
	fetchedAt time.Time
}

var libraryCache = struct {
	sync.Mutex
	byName map[string]libraryModelCacheEntry
}{byName: make(map[string]libraryModelCacheEntry)}

var libraryHTTP = &http.Client{Timeout: libraryTimeout}

var (
	libraryCapRe     = regexp.MustCompile(`<span[^>]*bg-indigo-50[^>]*>([^<]+)</span>`)
	librarySizeVal   = regexp.MustCompile(`^(\d+(?:\.\d+)?)\s*([bBmM])$`)
	libraryTitleRe   = regexp.MustCompile(`<title>([^<]+)</title>`)
	libraryMetaDesc  = regexp.MustCompile(`<meta\s+name="description"\s+content="([^"]*)"`)
	libraryModelName = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.\-/]*$`)
)

// loadBootstrapModels reads the curated Ollama catalog from assets/ollama_bootstrap.json.
func loadBootstrapModels(task core.ModelTask) ([]libraryModel, error) {
	raw, err := assets.ReadFile("ollama_bootstrap.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read ollama bootstrap catalog: %w", err)
	}
	var catalog map[string][]libraryModel
	if err := json.Unmarshal(raw, &catalog); err != nil {
		return nil, fmt.Errorf("failed to parse ollama bootstrap catalog: %w", err)
	}
	if task == "" {
		var all []libraryModel
		seen := make(map[string]bool)
		for _, list := range catalog {
			for _, m := range list {
				if !seen[m.Name] {
					seen[m.Name] = true
					all = append(all, m)
				}
			}
		}
		return all, nil
	}
	return catalog[string(core.NormalizeModelTask(task))], nil
}

// findBootstrapModel finds an exact (or normalized bare-name) match in the bootstrap catalog.
func findBootstrapModel(query string, task core.ModelTask) (libraryModel, bool) {
	models, err := loadBootstrapModels(task)
	if err != nil {
		return libraryModel{}, false
	}
	qTrim := strings.TrimSpace(query)
	hasTag := strings.Contains(qTrim, ":")
	for _, m := range models {
		if strings.EqualFold(m.Name, qTrim) {
			return m, true
		}
		if !hasTag && normalizeLibraryName(m.Name) == normalizeLibraryName(qTrim) {
			return m, true
		}
	}
	return libraryModel{}, false
}

// lookupLibraryModel returns a cached model by pullable name, or false.
func lookupLibraryModel(name string) (libraryModel, bool) {
	libraryCache.Lock()
	defer libraryCache.Unlock()
	entry, ok := libraryCache.byName[strings.ToLower(name)]
	if !ok || time.Since(entry.fetchedAt) >= libraryCacheTTL {
		return libraryModel{}, false
	}
	return entry.model, true
}

func parseSizeTag(size string) float64 {
	m := librarySizeVal.FindStringSubmatch(strings.TrimSpace(size))
	if m == nil {
		return 0
	}
	value, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		return 0
	}
	if strings.ToLower(m[2]) == "m" {
		return value / 1000
	}
	return value
}

// stripLibraryTag splits "gpt-oss:latest" into "gpt-oss". Registry names
// never contain ":", so the first colon always starts the tag.
func stripLibraryTag(query string) string {
	if i := strings.Index(query, ":"); i >= 0 {
		return strings.TrimSpace(query[:i])
	}
	return strings.TrimSpace(query)
}

// normalizeLibraryName canonicalizes a model name for comparison:
// lowercase, no tag, hyphens/underscores/spaces ignored.
func normalizeLibraryName(name string) string {
	name = stripLibraryTag(strings.ToLower(name))
	name = strings.ReplaceAll(name, "-", "")
	name = strings.ReplaceAll(name, "_", "")
	return strings.ReplaceAll(name, " ", "")
}

// looksLikeModelName reports whether the query is a valid single-token model reference.
func looksLikeModelName(base string) bool {
	base = stripLibraryTag(base)
	return base != "" && !strings.Contains(base, " ") && libraryModelName.MatchString(base)
}

// --- direct library probe (exact model page, no search scraping) ---

// probeLibraryModel fetches and parses a specific Ollama library model page
// (/library/<name> or /<ns>/<name>). Returns false if not found or cloud-only.
func probeLibraryModel(base string) (libraryModel, bool) {
	if cached, ok := lookupLibraryModel(base); ok {
		return cached, true
	}

	pagePath := base
	if !strings.Contains(base, "/") {
		pagePath = "library/" + base
	}
	req, err := http.NewRequest(http.MethodGet, "https://ollama.com/"+pagePath, nil)
	if err != nil {
		return libraryModel{}, false
	}
	req.Header.Set("User-Agent", libraryUserAgent)
	req.Header.Set("Accept", "text/html")
	resp, err := libraryHTTP.Do(req)
	if err != nil {
		return libraryModel{}, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return libraryModel{}, false
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return libraryModel{}, false
	}
	m, ok := parseLibraryModelPage(string(body), base, pagePath)
	if !ok {
		return libraryModel{}, false
	}
	now := time.Now()
	libraryCache.Lock()
	defer libraryCache.Unlock()
	if len(libraryCache.byName) > 2000 {
		libraryCache.byName = make(map[string]libraryModelCacheEntry)
	}
	libraryCache.byName[strings.ToLower(m.Name)] = libraryModelCacheEntry{model: m, fetchedAt: now}
	libraryCache.byName[strings.ToLower(base)] = libraryModelCacheEntry{model: m, fetchedAt: now}
	return m, true
}

func parseLibraryModelPage(page, want, pagePath string) (libraryModel, bool) {
	title := libraryTitleRe.FindStringSubmatch(page)
	if title == nil {
		return libraryModel{}, false
	}
	got := strings.TrimSpace(title[1])
	last := want
	if i := strings.LastIndex(want, "/"); i >= 0 {
		last = want[i+1:]
	}
	if !strings.EqualFold(got, want) && !strings.EqualFold(got, last) {
		return libraryModel{}, false
	}

	var m libraryModel
	m.Name = want
	if strings.Contains(want, "/") {
		m.Namespace = want[:strings.Index(want, "/")]
	} else {
		m.Namespace = "library"
	}
	if dm := libraryMetaDesc.FindStringSubmatch(page); dm != nil {
		m.Description = strings.TrimSpace(html.UnescapeString(dm[1]))
	}

	// Pullable variants: /<pagePath>:<tag> links excluding *-cloud ones.
	variantRe := regexp.MustCompile(`href="/` + regexp.QuoteMeta(pagePath) + `:([^"/]+)"`)
	seen := make(map[string]bool)
	var order []string
	var sizes []string
	smallest, smallestVal := "", 0.0
	for _, vm := range variantRe.FindAllStringSubmatch(page, -1) {
		variant := strings.TrimSpace(vm[1])
		lower := strings.ToLower(variant)
		if variant == "" || lower == "cloud" || strings.HasSuffix(lower, "-cloud") || seen[variant] {
			continue
		}
		seen[variant] = true
		order = append(order, variant)
		if v := parseSizeTag(variant); v > 0 {
			sizes = append(sizes, lower)
			if smallestVal == 0 || v < smallestVal {
				smallest, smallestVal = variant, v
			}
		}
	}
	if len(order) == 0 {
		return libraryModel{}, false
	}
	hasLatest := false
	for _, v := range order {
		if strings.EqualFold(v, "latest") {
			hasLatest = true
			break
		}
	}
	m.Name = want
	if !hasLatest {
		if smallest != "" {
			m.Name = want + ":" + smallest
		} else {
			m.Name = want + ":" + order[0]
		}
	}
	for _, tag := range libraryCapRe.FindAllStringSubmatch(page, -1) {
		if t := strings.TrimSpace(strings.ToLower(html.UnescapeString(tag[1]))); t != "" {
			m.Tags = append(m.Tags, t)
		}
	}
	m.Tags = append(m.Tags, sizes...)
	m.Parameters = smallestVal
	return m, true
}

// hasAllTags reports whether the model carries every requested tag.
func hasAllTags(modelTags []string, required []string) bool {
	if len(required) == 0 {
		return true
	}
	set := make(map[string]bool, len(modelTags))
	for _, t := range modelTags {
		set[strings.ToLower(t)] = true
	}
	for _, r := range required {
		if !set[strings.ToLower(r)] {
			return false
		}
	}
	return true
}

// hasAnyTag reports whether the model carries at least one of the tags.
func hasAnyTag(modelTags []string, matchTags []string) bool {
	if len(matchTags) == 0 {
		return true
	}
	set := make(map[string]bool, len(modelTags))
	for _, t := range modelTags {
		set[strings.ToLower(t)] = true
	}
	for _, m := range matchTags {
		if set[strings.ToLower(m)] {
			return true
		}
	}
	return false
}
