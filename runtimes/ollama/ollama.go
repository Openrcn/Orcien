package ollama

import (
	"errors"
	"fmt"
	"strings"

	"orcn/core"
	"orcn/core/logger"
)

var ollamaLog = logger.New("OLLAMA")

type OllamaModelDetails struct {
	Name        string   `json:"name"`
	Namespace   string   `json:"namespace"`
	Author      string   `json:"author"`
	Family      string   `json:"family,omitempty"`
	Description string   `json:"description,omitempty"`
	Pulls       int      `json:"pulls,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Parameters  *float64 `json:"parameters,omitempty"`
}

type OllamaRuntime struct{}

func New() *OllamaRuntime {
	ollamaLog.Info("Ollama runtime ready (curated bootstrap + exact model lookup).")
	return &OllamaRuntime{}
}

func (v *OllamaRuntime) GetWorkloadType() string {
	return "model_inference"
}

func (v *OllamaRuntime) Name() string { return "Ollama" }

func (v *OllamaRuntime) ModelSource() string { return "ollama" }

func (v *OllamaRuntime) SupportedTasks() []core.ModelTask {
	return []core.ModelTask{
		core.TaskTextGeneration,
		core.TaskEmbedding,
		core.TaskMultimodal,
		core.TaskDecision,
	}
}

func (v *OllamaRuntime) SupportedCapabilities() []core.ModelCapability {
	return []core.ModelCapability{
		core.CapabilityTools,
		core.CapabilityThinking,
		core.CapabilityVision,
	}
}

const (
	ollamaImage      = "ollama/ollama:latest"
	ollamaPort       = 11434
	ollamaHealthPath = "/api/tags"
)

func (v *OllamaRuntime) RuntimeMeta() core.RuntimeMeta {
	return core.RuntimeMeta{
		Image:      ollamaImage,
		Version:    "latest",
		Port:       ollamaPort,
		HealthPath: ollamaHealthPath,
		API:        "Ollama native",
		Endpoints:  "/api/generate · /api/chat",
		Tagline:    "Local-first runtime for open models from the Ollama library.",
		Highlights: []string{"Tools", "Thinking", "Vision"},
	}
}

func (v *OllamaRuntime) BuildJobSpec(modelID string, task core.ModelTask, advancedConfig map[string]string) (*core.JobSpec, error) {
	switch core.NormalizeModelTask(task) {
	case core.TaskTextGeneration, core.TaskEmbedding, core.TaskMultimodal, core.TaskDecision:
	default:
		return nil, errors.New("ollama does not support task \"" + string(task) + "\"")
	}
	numParallel := "4"
	if val, ok := advancedConfig["num_parallel"]; ok && val != "" {
		numParallel = val
	}

	contextLength := "4096"
	if val, ok := advancedConfig["context_length"]; ok && val != "" {
		contextLength = val
	}

	image := ollamaImage
	if val, ok := advancedConfig["image"]; ok && val != "" {
		image = val
	}

	return &core.JobSpec{
		Containers: []core.ContainerSpec{
			{
				ID: "ollama-engine",
				Args: core.ContainerArgs{
					Image: image,
					GPU:   true,
					Env: map[string]string{
						"OLLAMA_HOST":              fmt.Sprintf("0.0.0.0:%d", ollamaPort),
						"OLLAMA_KEEP_ALIVE":        "-1",
						"OLLAMA_FLASH_ATTENTION":   "1",
						"OLLAMA_MAX_LOADED_MODELS": "1",
						"OLLAMA_NUM_PARALLEL":      numParallel,
						"OLLAMA_CONTEXT_LENGTH":    contextLength,
					},
					Entrypoint: []string{
						"sh",
						"-c",
						"ollama serve & sleep 5 && ollama pull " + modelID + " && wait",
					},
					Expose: []core.ExposeSpec{
						{
							Port: ollamaPort,
							HealthCheck: &core.HealthCheckSpec{
								Path:           ollamaHealthPath,
								ExpectedStatus: 200,
							},
						},
					},
				},
			},
		},
	}, nil
}

func toCoreModelInfo(m libraryModel, task core.ModelTask) core.ModelInfo {
	return core.ModelInfo{
		ID:           m.Name,
		Name:         m.Name,
		Author:       libraryAuthor(m),
		Architecture: libraryFamily(m),
		Downloads:    m.Pulls,
		PipelineTag:  string(task),
		Tags:         m.Tags,
		Task:         string(task),
		Parameters:   m.Parameters,
	}
}

func (v *OllamaRuntime) SearchModels(query string, task core.ModelTask, capabilities []string) ([]core.ModelInfo, error) {
	task = core.NormalizeModelTask(task)
	lq, err := taskLibraryQuery(task)
	if err != nil {
		return nil, err
	}
	caps := core.NormalizeCapabilities(capabilities)
	trimmed := strings.TrimSpace(query)

	// Empty query -> return curated bootstrap models for this task & capabilities.
	if trimmed == "" {
		bootstrap, err := loadBootstrapModels(task)
		if err != nil {
			return nil, err
		}
		results := make([]core.ModelInfo, 0, len(bootstrap))
		for _, m := range bootstrap {
			if !hasAnyTag(m.Tags, lq.matchTags) || !hasAllTags(m.Tags, caps) {
				continue
			}
			results = append(results, toCoreModelInfo(m, task))
			if len(results) >= maxSearchResults {
				break
			}
		}
		return results, nil
	}

	// Non-empty query -> exact match only (bootstrap catalog first, then direct model page probe).
	if m, ok := findBootstrapModel(trimmed, task); ok &&
		hasAnyTag(m.Tags, lq.matchTags) && hasAllTags(m.Tags, caps) {
		return []core.ModelInfo{toCoreModelInfo(m, task)}, nil
	}

	base := stripLibraryTag(trimmed)
	if !looksLikeModelName(base) {
		return []core.ModelInfo{}, nil
	}

	if pm, ok := probeLibraryModel(base); ok &&
		hasAnyTag(pm.Tags, lq.matchTags) && hasAllTags(pm.Tags, caps) {
		// Preserve an explicit user-supplied tag (e.g. qwen2.5:14b).
		if strings.Contains(trimmed, ":") {
			pm.Name = trimmed
		}
		return []core.ModelInfo{toCoreModelInfo(pm, task)}, nil
	}
	return []core.ModelInfo{}, nil
}

func (v *OllamaRuntime) GetModelDetails(modelID string, task core.ModelTask) (interface{}, error) {
	trimmed := strings.TrimSpace(modelID)
	if trimmed == "" {
		return nil, errors.New("missing model name")
	}
	base := stripLibraryTag(trimmed)
	if base == "" {
		return nil, errors.New("missing model name")
	}

	if m, ok := lookupLibraryModel(base); ok {
		return libraryDetails(m), nil
	}
	if m, ok := findBootstrapModel(trimmed, task); ok {
		return libraryDetails(m), nil
	}
	if m, ok := findBootstrapModel(trimmed, ""); ok {
		return libraryDetails(m), nil
	}
	if looksLikeModelName(base) {
		if m, ok := probeLibraryModel(base); ok {
			return libraryDetails(m), nil
		}
	}
	return nil, errors.New("model not found in ollama library; enter the exact library name")
}

func libraryAuthor(m libraryModel) string {
	if m.Namespace == "" || m.Namespace == "library" {
		return "Ollama"
	}
	return m.Namespace
}

func libraryFamily(m libraryModel) string {
	if m.Namespace == "" || m.Namespace == "library" {
		return m.Name
	}
	return m.Namespace
}

func libraryDetails(m libraryModel) OllamaModelDetails {
	details := OllamaModelDetails{
		Name:        m.Name,
		Namespace:   m.Namespace,
		Author:      libraryAuthor(m),
		Family:      libraryFamily(m),
		Description: m.Description,
		Pulls:       m.Pulls,
		Tags:        m.Tags,
	}
	if m.Parameters > 0 {
		params := m.Parameters
		details.Parameters = &params
	}
	return details
}

func (v *OllamaRuntime) GetAdvancedConfigSchema(task core.ModelTask) []core.ConfigOption {
	return []core.ConfigOption{
		{
			Key:         "num_parallel",
			Name:        "Parallel Requests",
			Description: "Maximum number of parallel requests the model can handle simultaneously",
			Type:        "number",
			Default:     "2",
		},
		{
			Key:         "context_length",
			Name:        "Context Length",
			Description: "Maximum context window size (e.g. 4096, 8192). Increasing this uses significantly more VRAM.",
			Type:        "number",
			Default:     "4096",
		},
	}
}
