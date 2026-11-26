package sglang

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"orcn/core"
	"orcn/pkg/huggingface"
)

const (
	sglangSearchLimit = 100
	sglangFilterTag   = "sglang"
)

// SGLangRuntime serves models through SGLang's OpenAI-compatible server.
// For now only text generation is supported.
type SGLangRuntime struct{}

func New() *SGLangRuntime { return &SGLangRuntime{} }

func (r *SGLangRuntime) Name() string { return "SGLang" }

func (r *SGLangRuntime) GetWorkloadType() string { return "model_inference" }

func (r *SGLangRuntime) RuntimeMeta() core.RuntimeMeta {
	return core.RuntimeMeta{
		Image:      sglangImage,
		Version:    "v0.5.23",
		Port:       sglangPort,
		HealthPath: sglangHealthPath,
		API:        "OpenAI-compatible",
		Endpoints:  "/v1/chat/completions · /generate",
		CUDA:       sglangCUDAVersion,
		MinVRAMGB:  sglangMinVRAMGB,
		Tagline:    "High-throughput serving with RadixAttention and fast prefix caching.",
		Highlights: []string{"RadixAttention", "Continuous batching", "Chunked prefill"},
	}
}

func (r *SGLangRuntime) SupportedTasks() []core.ModelTask {
	return []core.ModelTask{core.TaskTextGeneration}
}

func (r *SGLangRuntime) SupportedCapabilities() []core.ModelCapability { return nil }

func (r *SGLangRuntime) BuildJobSpec(modelID string, task core.ModelTask, config map[string]string) (*core.JobSpec, error) {
	if _, err := taskPipelineTag(task); err != nil {
		return nil, err
	}
	if err := validateAdvancedConfig(config, r.textGenerationSchema()); err != nil {
		return nil, err
	}
	return r.buildTextGenerationJobSpec(modelID, config), nil
}

func (r *SGLangRuntime) GetAdvancedConfigSchema(task core.ModelTask) []core.ConfigOption {
	if _, err := taskPipelineTag(task); err != nil {
		return nil
	}
	return r.textGenerationSchema()
}

// SearchModels merges two Hub queries:
//
//  1. models tagged "sglang" (what huggingface.co/models?apps=sglang shows)
//  2. models whose architecture has a native SGLang implementation
//
// A model is accepted when either signal matches. Results are de-duplicated
// and sorted by downloads.
func (r *SGLangRuntime) SearchModels(query string, task core.ModelTask, _ []string) ([]core.ModelInfo, error) {
	pipelineTag, err := taskPipelineTag(task)
	if err != nil {
		return nil, err
	}

	// Empty search box: serve the curated catalog, same as vLLM.
	if strings.TrimSpace(query) == "" {
		return loadSGLangBootstrap(task)
	}

	ctx := context.Background()
	client := huggingface.Default()
	term := strings.TrimSpace(query)

	taggedModels, taggedErr := client.Search(ctx, textGenerationQuery(term, pipelineTag, true))
	nativeModels, nativeErr := client.Search(ctx, textGenerationQuery(term, pipelineTag, false))
	if taggedErr != nil && nativeErr != nil {
		return nil, taggedErr
	}

	type candidate struct {
		model        huggingface.Model
		tagged       bool
		native       bool
		architecture string
	}

	candidates := make(map[string]*candidate)
	add := func(models []huggingface.Model, fromTaggedQuery bool) {
		for _, model := range models {
			if !IsSGLangCompatible(model.ID) {
				continue
			}

			architecture, native := firstSupportedArchitecture(model.Architectures())
			tagged := fromTaggedQuery || hasTag(model.Tags, sglangFilterTag)
			if !native && !tagged {
				continue
			}

			existing, ok := candidates[model.ID]
			if !ok {
				candidates[model.ID] = &candidate{
					model:        model,
					tagged:       tagged,
					native:       native,
					architecture: architecture,
				}
				continue
			}

			existing.tagged = existing.tagged || tagged
			existing.native = existing.native || native
			if existing.architecture == "" {
				existing.architecture = architecture
			}
			if model.Downloads > existing.model.Downloads {
				existing.model.Downloads = model.Downloads
			}
		}
	}

	add(taggedModels, true)
	add(nativeModels, false)

	ordered := make([]*candidate, 0, len(candidates))
	for _, candidate := range candidates {
		ordered = append(ordered, candidate)
	}
	sort.SliceStable(ordered, func(i, j int) bool {
		return ordered[i].model.Downloads > ordered[j].model.Downloads
	})

	results := make([]core.ModelInfo, 0, len(ordered))
	for _, candidate := range ordered {
		architecture := candidate.architecture
		if architecture == "" {
			architectures := candidate.model.Architectures()
			if len(architectures) > 0 {
				architecture = architectures[0]
			}
		}

		tags := make([]string, 0, 2)
		if architecture != "" {
			tags = append(tags, architecture)
		}
		if candidate.tagged {
			tags = append(tags, sglangFilterTag)
		}

		results = append(results, core.ModelInfo{
			ID:           candidate.model.ID,
			Name:         candidate.model.ID,
			Author:       huggingface.ModelAuthor(candidate.model.ID),
			Architecture: architecture,
			Downloads:    candidate.model.Downloads,
			PipelineTag:  pipelineTag,
			Tags:         tags,
			Task:         string(core.TaskTextGeneration),
			Parameters:   candidate.model.Parameters(),
		})
	}
	return results, nil
}

func textGenerationQuery(term, pipelineTag string, tagged bool) *huggingface.SearchQuery {
	query := huggingface.NewSearchQuery(term).
		PipelineTag(pipelineTag).
		SortBy("downloads").
		Descending().
		Limit(sglangSearchLimit).
		ExpandFields("config", "safetensors")
	if tagged {
		query.AddFilter(sglangFilterTag)
	}
	return query
}

func (r *SGLangRuntime) GetModelDetails(modelID string, task core.ModelTask) (any, error) {
	if _, err := taskPipelineTag(task); err != nil {
		return nil, err
	}

	ctx := context.Background()
	data, err := huggingface.Default().ModelDetails(ctx, modelID)
	if err != nil {
		if errors.Is(err, huggingface.ErrModelNotFound) {
			return nil, fmt.Errorf("model not found")
		}
		return nil, err
	}

	enrichModelConfig(ctx, modelID, data)
	if metadata := textGenerationMetadata(data); len(metadata) > 0 {
		data["metadata"] = metadata
	}
	return data, nil
}

// IsSGLangCompatible rejects repositories that cannot be served as regular
// safetensors checkpoints.
func IsSGLangCompatible(id string) bool {
	idLower := strings.ToLower(id)
	for _, unsupported := range []string{"gguf", "ggml", "mlx", "exl2", "bnb", "onnx", "openvino"} {
		if strings.Contains(idLower, unsupported) {
			return false
		}
	}
	return true
}

func hasTag(tags []string, target string) bool {
	for _, tag := range tags {
		if strings.EqualFold(tag, target) {
			return true
		}
	}
	return false
}
