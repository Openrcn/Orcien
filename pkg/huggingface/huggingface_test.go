package huggingface

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
)

func TestSearchQueryBuildsHubParameters(t *testing.T) {
	query := NewSearchQuery("qwen").
		PipelineTag("text-generation").
		AddFilter("sglang").
		AddExcludeFilter("gguf").
		Author("Qwen").
		SortBy("downloads").
		Descending().
		Limit(100).
		ExpandFields("config", "safetensors")

	values := query.Values()
	assertValue(t, values, "search", "qwen")
	assertValue(t, values, "pipeline_tag", "text-generation")
	assertValue(t, values, "filter", "sglang")
	assertValue(t, values, "exclude", "gguf")
	assertValue(t, values, "author", "Qwen")
	assertValue(t, values, "sort", "downloads")
	assertValue(t, values, "direction", "-1")
	assertValue(t, values, "limit", "100")
	assertValues(t, values, "expand", []string{"config", "safetensors"})

	parsed, err := url.Parse(query.URL("https://huggingface.co/api"))
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Path != "/api/models" {
		t.Fatalf("path = %q", parsed.Path)
	}
}

func TestSearchQueryMultiplePipelinesOmitSinglePipelineParam(t *testing.T) {
	query := NewSearchQuery("bge").PipelineTags("feature-extraction", "sentence-similarity")
	if got := query.Values().Get("pipeline_tag"); got != "" {
		t.Fatalf("pipeline_tag = %q, want empty for multi-tag search", got)
	}
	if len(query.pipelineTagList()) != 2 {
		t.Fatalf("pipeline tags = %#v", query.pipelineTagList())
	}
}

func TestModelArchitecturesAndParameters(t *testing.T) {
	model := Model{
		Config:      map[string]any{"architectures": []any{"Qwen3ForCausalLM"}},
		Safetensors: Safetensors{Total: 15_000_000_000},
	}
	if got := model.Architectures(); len(got) != 1 || got[0] != "Qwen3ForCausalLM" {
		t.Fatalf("architectures = %#v", got)
	}
	if got := model.Parameters(); got != 15 {
		t.Fatalf("parameters = %v", got)
	}

	typed := Model{Config: map[string]any{"architectures": []string{"BertModel"}}}
	if got := typed.Architectures(); len(got) != 1 || got[0] != "BertModel" {
		t.Fatalf("typed architectures = %#v", got)
	}
}

func TestClientSearchMergesPipelinesAndCaches(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/api/models" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		pipeline := r.URL.Query().Get("pipeline_tag")
		switch pipeline {
		case "feature-extraction":
			_, _ = w.Write([]byte(`[{"id":"org/a","downloads":20,"pipeline_tag":"feature-extraction","config":{"architectures":["BertModel"]}}]`))
		case "sentence-similarity":
			_, _ = w.Write([]byte(`[{"id":"org/b","downloads":10,"pipeline_tag":"sentence-similarity","config":{"architectures":["BertModel"]}}]`))
		default:
			_, _ = w.Write([]byte(`[]`))
		}
	}))
	defer server.Close()

	client := New(WithBaseURL(server.URL))
	query := NewSearchQuery("bge").PipelineTags("feature-extraction", "sentence-similarity")

	models, err := client.Search(context.Background(), query)
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 2 {
		t.Fatalf("models = %#v", models)
	}

	if _, err := client.Search(context.Background(), query); err != nil {
		t.Fatal(err)
	}
	if got := calls.Load(); got != 2 {
		t.Fatalf("hub calls = %d, want 2 (second search should be cached)", got)
	}
}

func TestClientModelNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	_, err := New(WithBaseURL(server.URL)).Model(context.Background(), "org/missing")
	if !errors.Is(err, ErrModelNotFound) {
		t.Fatalf("err = %v, want ErrModelNotFound", err)
	}
}

func TestClientRawFileNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	_, err := New(WithBaseURL(server.URL)).RawFile(context.Background(), "org/model", "missing.json")
	if !errors.Is(err, ErrFileNotFound) {
		t.Fatalf("err = %v, want ErrFileNotFound", err)
	}
}

func TestClientEscapesModelAndFilePaths(t *testing.T) {
	var gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_, _ = w.Write([]byte(`{"key":"value"}`))
	}))
	defer server.Close()

	client := New(WithBaseURL(server.URL))
	if _, err := client.RawJSON(context.Background(), "org/model name", "sub dir/config.json"); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/org/model name/raw/main/sub dir/config.json" {
		t.Fatalf("path = %q", gotPath)
	}
}

func assertValue(t *testing.T, values url.Values, key, want string) {
	t.Helper()
	if got := values.Get(key); got != want {
		t.Fatalf("%s = %q, want %q", key, got, want)
	}
}

func assertValues(t *testing.T, values url.Values, key string, want []string) {
	t.Helper()
	got := values[key]
	if len(got) != len(want) {
		t.Fatalf("%s = %#v, want %#v", key, got, want)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("%s = %#v, want %#v", key, got, want)
		}
	}
}
