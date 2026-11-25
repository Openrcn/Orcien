package ollama

import (
	"testing"

	"orcn/core"
)

func TestTaskLibraryQuery(t *testing.T) {
	q, err := taskLibraryQuery("decision")
	if err != nil {
		t.Fatal(err)
	}
	if len(q.matchTags) != 1 || q.matchTags[0] != "decision" {
		t.Errorf("decision must match strictly on its own tag, got %v", q.matchTags)
	}
	if _, err := taskLibraryQuery("score"); err == nil {
		t.Error("expected score to be rejected for ollama")
	}
}

func TestBootstrapCatalog(t *testing.T) {
	for _, task := range []core.ModelTask{
		core.TaskTextGeneration,
		core.TaskMultimodal,
		core.TaskEmbedding,
		core.TaskDecision,
	} {
		models, err := loadBootstrapModels(task)
		if err != nil {
			t.Fatalf("loadBootstrapModels(%s): %v", task, err)
		}
		if len(models) == 0 {
			t.Errorf("expected bootstrap models for task %s", task)
		}
	}

	rt := New()
	results, err := rt.SearchModels("", core.TaskEmbedding, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) == 0 {
		t.Fatal("expected embedding bootstrap results for empty query")
	}

	exact, err := rt.SearchModels("llama3.2", core.TaskTextGeneration, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(exact) != 1 || exact[0].ID != "llama3.2" {
		t.Errorf("expected exact match llama3.2, got %+v", exact)
	}
}

func TestParseHelpers(t *testing.T) {
	if got := parseSizeTag("123b"); got != 123 {
		t.Errorf("size b: %v", got)
	}
	if got := parseSizeTag("350m"); got != 0.35 {
		t.Errorf("size m: %v", got)
	}
	if !hasAllTags([]string{"tools", "thinking"}, []string{"tools"}) {
		t.Error("hasAllTags should pass")
	}
	if hasAllTags([]string{"tools"}, []string{"tools", "thinking"}) {
		t.Error("hasAllTags should fail on missing tag")
	}
}

func TestQueryNormalization(t *testing.T) {
	if got := stripLibraryTag("gpt-oss:latest"); got != "gpt-oss" {
		t.Errorf("strip tag: %q", got)
	}
	if normalizeLibraryName("gptoss") != normalizeLibraryName("gpt-oss:latest") {
		t.Error("gptoss should normalize equal to gpt-oss:latest")
	}
	if !looksLikeModelName("gpt-oss") || !looksLikeModelName("ns/model:tag") {
		t.Error("valid model names rejected")
	}
	if looksLikeModelName("two words") || looksLikeModelName("") {
		t.Error("invalid model names accepted")
	}
}

const testModelPage = `
<html><head><title>gpt-oss</title>
<meta name="description" content="OpenAI&#39;s open-weight models."/>
</head><body>
<div class="flex flex-wrap gap-2">
<span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 sm:text-[13px]">thinking</span>
<span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 sm:text-[13px]">tools</span>
</div>
<a href="/library/gpt-oss:120b">120b</a>
<a href="/library/gpt-oss:120b-cloud">120b-cloud</a>
<a href="/library/gpt-oss:20b">20b</a>
<a href="/library/gpt-oss:latest">latest</a>
</body></html>
`

func TestParseLibraryModelPage(t *testing.T) {
	m, ok := parseLibraryModelPage(testModelPage, "gpt-oss", "library/gpt-oss")
	if !ok {
		t.Fatal("model page not parsed")
	}
	if m.Name != "gpt-oss" || m.Namespace != "library" {
		t.Errorf("unexpected identity: %+v", m)
	}
	if m.Description != "OpenAI's open-weight models." {
		t.Errorf("unexpected description: %q", m.Description)
	}
	for _, wantTag := range []string{"thinking", "tools", "20b", "120b"} {
		found := false
		for _, tag := range m.Tags {
			if tag == wantTag {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected tag %q in %v", wantTag, m.Tags)
		}
	}
	if m.Parameters != 20 {
		t.Errorf("expected smallest variant 20B, got %v", m.Parameters)
	}

	noLatest := `<html><head><title>foo-9b</title></head><body>` +
		`<a href="/library/foo-9b:9b">9b</a>` +
		`<a href="/library/foo-9b:4b">4b</a></body></html>`
	pinned, ok := parseLibraryModelPage(noLatest, "foo-9b", "library/foo-9b")
	if !ok {
		t.Fatal("variant page not parsed")
	}
	if pinned.Name != "foo-9b:4b" {
		t.Errorf("expected pinned variant foo-9b:4b, got %q", pinned.Name)
	}

	cloudPage := `<html><head><title>kimi-k3</title></head><body><a href="/library/kimi-k3:cloud">cloud</a></body></html>`
	if _, ok := parseLibraryModelPage(cloudPage, "kimi-k3", "library/kimi-k3"); ok {
		t.Error("cloud-only model page should be rejected")
	}
	if _, ok := parseLibraryModelPage(testModelPage, "llama3", "library/llama3"); ok {
		t.Error("title mismatch should be rejected")
	}
}
