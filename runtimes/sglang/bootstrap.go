package sglang

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"orcn/assets"
	"orcn/core"
	"orcn/pkg/huggingface"
)

// bootstrapCacheTTL matches the vLLM runtime: the curated empty-query list is
// cached for an hour while best-effort download/parameter stats refresh.
const bootstrapCacheTTL = 1 * time.Hour

type bootstrapEntry struct {
	ID           string   `json:"id"`
	Author       string   `json:"author"`
	Architecture string   `json:"architecture"`
	PipelineTag  string   `json:"pipeline_tag"`
	Parameters   float64  `json:"parameters"`
	Downloads    int      `json:"downloads"`
	Tags         []string `json:"tags"`
}

type bootstrapCacheEntry struct {
	models    []core.ModelInfo
	fetchedAt time.Time
}

var bootstrapCache = struct {
	sync.Mutex
	models map[core.ModelTask]bootstrapCacheEntry
}{
	models: make(map[core.ModelTask]bootstrapCacheEntry),
}

// loadSGLangBootstrap serves the curated catalog shown when the search box is
// empty, mirroring the vLLM runtime. Enrichment never blocks when offline or
// rate-limited.
func loadSGLangBootstrap(task core.ModelTask) ([]core.ModelInfo, error) {
	bootstrapCache.Lock()
	if entry, ok := bootstrapCache.models[task]; ok && time.Since(entry.fetchedAt) < bootstrapCacheTTL {
		out := append([]core.ModelInfo(nil), entry.models...)
		bootstrapCache.Unlock()
		return out, nil
	}
	bootstrapCache.Unlock()

	raw, err := assets.ReadFile("sglang_bootstrap.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read sglang bootstrap catalog: %w", err)
	}
	models, err := parseBootstrapCatalog(raw, task)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2500*time.Millisecond)
	defer cancel()
	var wg sync.WaitGroup
	for i := range models {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			model, modelErr := huggingface.Default().Model(ctx, models[idx].ID)
			if modelErr != nil {
				return
			}
			if model.Downloads > 0 {
				models[idx].Downloads = model.Downloads
			}
			if parameters := model.Parameters(); parameters > 0 {
				models[idx].Parameters = parameters
			}
		}(i)
	}
	wg.Wait()

	bootstrapCache.Lock()
	bootstrapCache.models[task] = bootstrapCacheEntry{
		models:    append([]core.ModelInfo(nil), models...),
		fetchedAt: time.Now(),
	}
	bootstrapCache.Unlock()
	return models, nil
}

func parseBootstrapCatalog(raw []byte, task core.ModelTask) ([]core.ModelInfo, error) {
	var catalog map[string][]bootstrapEntry
	if err := json.Unmarshal(raw, &catalog); err != nil {
		return nil, fmt.Errorf("failed to parse sglang bootstrap catalog: %w", err)
	}

	entries := catalog[string(task)]
	models := make([]core.ModelInfo, 0, len(entries))
	for _, e := range entries {
		tags := append([]string(nil), e.Tags...)
		if e.Architecture != "" {
			tags = append([]string{e.Architecture}, tags...)
		}
		models = append(models, core.ModelInfo{
			ID:           e.ID,
			Name:         e.ID,
			Author:       e.Author,
			Architecture: e.Architecture,
			Downloads:    e.Downloads,
			PipelineTag:  e.PipelineTag,
			Tags:         tags,
			Task:         string(task),
			Parameters:   e.Parameters,
		})
	}
	return models, nil
}
