package vllm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"orcn/assets"
	"orcn/core"
	"orcn/pkg/huggingface"
)

type VLLMRuntime struct{}

func New() *VLLMRuntime { return &VLLMRuntime{} }

func (v *VLLMRuntime) Name() string { return "vLLM" }

func (v *VLLMRuntime) SupportedTasks() []core.ModelTask {
	return []core.ModelTask{
		core.TaskTextGeneration,
		core.TaskMultimodal,
		core.TaskEmbedding,
		core.TaskScore,
	}
}

func (v *VLLMRuntime) SupportedCapabilities() []core.ModelCapability { return nil }

func (v *VLLMRuntime) GetWorkloadType() string { return "model_inference" }

func (v *VLLMRuntime) BuildJobSpec(modelID string, task core.ModelTask, config map[string]string) (*core.JobSpec, error) {
	normalizedTask := normalizeTask(task)
	schema := v.GetAdvancedConfigSchema(normalizedTask)
	if len(schema) == 0 {
		return nil, fmt.Errorf("vLLM does not support task %q", task)
	}

	runtimeConfig, runtimeConfigErr := fetchModelRuntimeConfig(context.Background(), modelID)
	if errors.Is(runtimeConfigErr, huggingface.ErrModelNotFound) {
		return nil, fmt.Errorf("model %q was not found on Hugging Face", modelID)
	}
	if runtimeConfigErr != nil {
		runtimeConfig = nil
	}

	if err := validateAdvancedConfig(normalizedTask, config, schema, runtimeConfig); err != nil {
		return nil, err
	}

	switch normalizedTask {
	case core.TaskTextGeneration, core.TaskMultimodal:
		return v.buildTextGenerationJobSpec(modelID, config, runtimeConfig)
	case core.TaskEmbedding:
		return v.buildEmbeddingJobSpec(modelID, config, runtimeConfig)
	case core.TaskScore:
		return v.buildScoreJobSpec(modelID, config, runtimeConfig)
	default:
		return nil, fmt.Errorf("vLLM does not support task %q", task)
	}
}

func (v *VLLMRuntime) GetAdvancedConfigSchema(task core.ModelTask) []core.ConfigOption {
	switch normalizeTask(task) {
	case core.TaskTextGeneration, core.TaskMultimodal:
		return v.textGenerationSchema()
	case core.TaskEmbedding:
		return v.embeddingSchema()
	case core.TaskScore:
		return v.scoreSchema()
	default:
		return nil
	}
}

const (
	vllmImage       = "docker.io/vllm/vllm-openai:v0.26.0"
	vllmPort        = 9000
	vllmHealthPath  = "/health"
	vllmMinVRAMGB   = 16
	vllmCUDAVersion = "12.9"
)

func (v *VLLMRuntime) buildJobSpec(_ string, entrypoint []string, command []string, healthPath string, config map[string]string) *core.JobSpec {
	image := vllmImage
	if custom, ok := config["image"]; ok && custom != "" {
		image = custom
	}
	return &core.JobSpec{
		Version: "v2",
		Type:    "container",
		SystemRequirements: core.SystemRequirements{
			MinVRAMGB:   vllmMinVRAMGB,
			CUDAVersion: vllmCUDAVersion,
		},
		Containers: []core.ContainerSpec{{
			ID: "vllm-inference-server",
			Args: core.ContainerArgs{
				Image:      image,
				GPU:        true,
				Entrypoint: entrypoint,
				Cmd:        command,
				Env: map[string]string{
					"CUDA_MODULE_LOADING":     "LAZY",
					"PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
				},
				Expose: []core.ExposeSpec{{
					Port:     vllmPort,
					Protocol: "http",
					IsPublic: true,
					HealthCheck: &core.HealthCheckSpec{
						Path:           healthPath,
						ExpectedStatus: 200,
						TimeoutSeconds: 10,
					},
				}},
			},
		}},
	}
}

func resolveEntrypoint(runtimeConfig *modelRuntimeConfig) []string {
	if runtimeConfig != nil && (runtimeConfig.PipelineTag == "audio-text-to-text" || runtimeConfig.PipelineTag == "automatic-speech-recognition") {
		return []string{
			"/bin/bash",
			"-c",
			"pip install \"vllm[audio]\" && exec python3 -m vllm.entrypoints.openai.api_server \"$@\"",
			"--",
		}
	}
	return []string{"python3", "-m", "vllm.entrypoints.openai.api_server"}
}

func commonModelArgs(modelID string, config map[string]string) []string {
	return []string{
		"--model", modelID,
		"--served-model-name", modelID,
		"--port", "9000",
		"--trust-remote-code",
		"--gpu-memory-utilization", configValue(config, "gpu_memory_utilization", "0.80"),
	}
}

func configValue(config map[string]string, key, fallback string) string {
	if value, ok := config[key]; ok {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return fallback
}

func floatPtr(value float64) *float64 { return &value }

type modelRuntimeConfig struct {
	Architectures []string
	PipelineTag   string
	Config        map[string]any
}

func fetchModelRuntimeConfig(ctx context.Context, modelID string) (*modelRuntimeConfig, error) {
	model, err := huggingface.Default().Model(ctx, modelID)
	if err != nil {
		return nil, err
	}
	return &modelRuntimeConfig{
		Architectures: model.Architectures(),
		PipelineTag:   model.PipelineTag,
		Config:        model.Config,
	}, nil
}

func modelMaxLength(config map[string]any) int {
	value, ok := firstModelValue(config, "max_position_embeddings", "max_seq_length", "max_sequence_length")
	if !ok {
		return 0
	}

	switch value := value.(type) {
	case float64:
		return int(value)
	case int:
		return value
	case string:
		length, err := strconv.Atoi(value)
		if err == nil {
			return length
		}
	}
	return 0
}

const hfBootstrapCacheTTL = 1 * time.Hour

type vllmBootstrapEntry struct {
	ID           string   `json:"id"`
	Author       string   `json:"author"`
	Architecture string   `json:"architecture"`
	PipelineTag  string   `json:"pipeline_tag"`
	Parameters   float64  `json:"parameters"`
	Downloads    int      `json:"downloads"`
	Tags         []string `json:"tags"`
}

type hfBootstrapCacheEntry struct {
	models    []core.ModelInfo
	fetchedAt time.Time
}

var hfCache = struct {
	sync.Mutex
	bootstrap map[core.ModelTask]hfBootstrapCacheEntry
}{
	bootstrap: make(map[core.ModelTask]hfBootstrapCacheEntry),
}

func loadVLLMBootstrap(task core.ModelTask) ([]core.ModelInfo, error) {
	hfCache.Lock()
	if entry, ok := hfCache.bootstrap[task]; ok && time.Since(entry.fetchedAt) < hfBootstrapCacheTTL {
		out := append([]core.ModelInfo(nil), entry.models...)
		hfCache.Unlock()
		return out, nil
	}
	hfCache.Unlock()

	raw, err := assets.ReadFile("vllm_bootstrap.json")
	if err != nil {
		return nil, fmt.Errorf("failed to read vllm bootstrap catalog: %w", err)
	}
	var catalog map[string][]vllmBootstrapEntry
	if err := json.Unmarshal(raw, &catalog); err != nil {
		return nil, fmt.Errorf("failed to parse vllm bootstrap catalog: %w", err)
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

	// Best-effort concurrent HF stats enrichment with a short timeout so
	// bootstrap never blocks when offline or rate-limited.
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

	hfCache.Lock()
	hfCache.bootstrap[task] = hfBootstrapCacheEntry{models: append([]core.ModelInfo(nil), models...), fetchedAt: time.Now()}
	hfCache.Unlock()
	return models, nil
}

func (v *VLLMRuntime) SearchModels(query string, task core.ModelTask, _ []string) ([]core.ModelInfo, error) {
	task = normalizeTask(task)
	if strings.TrimSpace(query) == "" {
		return loadVLLMBootstrap(task)
	}
	pipelineTags, architectures, err := taskSearchConfig(task)
	if err != nil {
		return nil, err
	}

	results := make([]core.ModelInfo, 0, len(pipelineTags)*20)
	seen := make(map[string]bool)
	var lastErr error
	for _, pipelineTag := range pipelineTags {
		models, searchErr := huggingface.Default().Search(context.Background(),
			huggingface.NewSearchQuery(query).
				PipelineTag(pipelineTag).
				SortBy("downloads").
				Descending().
				Limit(100).
				ExpandFields("config", "safetensors"),
		)
		if searchErr != nil {
			lastErr = searchErr
			continue
		}
		for _, model := range models {
			architecture := firstSupportedArchitecture(model.Architectures(), architectures)
			if architecture == "" || !IsVLLMCompatible(model.ID) || seen[model.ID] {
				continue
			}
			seen[model.ID] = true
			results = append(results, core.ModelInfo{
				ID:           model.ID,
				Name:         model.ID,
				Author:       huggingface.ModelAuthor(model.ID),
				Architecture: architecture,
				Downloads:    model.Downloads,
				PipelineTag:  pipelineTag,
				Tags:         []string{architecture},
				Task:         string(task),
				Parameters:   model.Parameters(),
			})
		}
	}
	if len(results) == 0 && lastErr != nil {
		return nil, lastErr
	}
	return results, nil
}

func normalizeTask(task core.ModelTask) core.ModelTask {
	return core.NormalizeModelTask(task)
}

func firstSupportedArchitecture(candidates []string, supported map[string]bool) string {
	for _, candidate := range candidates {
		if supported[candidate] {
			return candidate
		}
	}
	return ""
}

func IsVLLMCompatible(id string) bool {
	idLower := strings.ToLower(id)
	for _, unsupported := range []string{"mlx", "exl2", "gguf", "ggml", "bnb"} {
		if strings.Contains(idLower, unsupported) {
			return false
		}
	}
	return true
}

func (v *VLLMRuntime) GetModelDetails(modelID string, task core.ModelTask) (any, error) {
	ctx := context.Background()
	data, err := huggingface.Default().ModelDetails(ctx, modelID)
	if err != nil {
		if errors.Is(err, huggingface.ErrModelNotFound) {
			return nil, fmt.Errorf("model not found")
		}
		return nil, err
	}

	normalizedTask := normalizeTask(task)
	if normalizedTask == core.TaskEmbedding || normalizedTask == core.TaskTextGeneration || normalizedTask == core.TaskScore || normalizedTask == core.TaskMultimodal {
		enrichModelConfig(ctx, modelID, data, normalizedTask)
	}
	if metadata := modelMetadata(data, normalizedTask); len(metadata) > 0 {
		data["metadata"] = metadata
	}
	injectRecommendedParsers(ctx, modelID, data)
	return data, nil
}

func modelMetadata(data map[string]any, task core.ModelTask) map[string]any {
	switch task {
	case core.TaskTextGeneration, core.TaskMultimodal:
		return textGenerationMetadata(data, task)
	case core.TaskEmbedding:
		return embeddingMetadata(data)
	case core.TaskScore:
		return scoreMetadata(data)
	default:
		return nil
	}
}

func enrichModelConfig(ctx context.Context, modelID string, data map[string]any, task core.ModelTask) {
	config := map[string]any{}
	if existing, ok := data["config"].(map[string]any); ok {
		config = existing
	}

	loadJSON := func(path string) map[string]any {
		value, err := huggingface.Default().RawJSON(ctx, modelID, path)
		if err != nil {
			return nil
		}
		return value
	}

	if fullConfig := loadJSON("config.json"); fullConfig != nil {
		for key, value := range fullConfig {
			if _, exists := config[key]; !exists {
				config[key] = value
			}
		}
	}
	data["config"] = config

	if task == core.TaskEmbedding && !hasModelValue(config, "embedding_dimension", "sentence_embedding_dimension", "word_embedding_dimension") {
		if pooling := loadJSON("1_Pooling/config.json"); pooling != nil {
			if dimension, exists := pooling["word_embedding_dimension"]; exists {
				config["word_embedding_dimension"] = dimension
			}
			data["pooling_config"] = pooling
		}
	}
}

func hasModelValue(config map[string]any, keys ...string) bool {
	_, ok := firstModelValue(config, keys...)
	return ok
}

func firstModelValue(config map[string]any, keys ...string) (any, bool) {
	for _, key := range keys {
		if value, ok := nestedModelValue(config, key); ok {
			return value, true
		}
	}
	return nil, false
}

func nestedModelValue(config map[string]any, key string) (any, bool) {
	if value, ok := config[key]; ok {
		return value, true
	}
	for _, nestedKey := range []string{"text_config", "sentence_transformers_config", "pooling_config"} {
		if nested, ok := config[nestedKey].(map[string]any); ok {
			if value, exists := nested[key]; exists {
				return value, true
			}
		}
	}
	return nil, false
}
