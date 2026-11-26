package huggingface

import "strings"

// Model is a model returned by the Hugging Face Hub API. Only the fields used
// by the orchestration plane are typed; use ModelDetails when the full raw
// payload is needed.
type Model struct {
	ID           string         `json:"id"`
	Author       string         `json:"author"`
	Downloads    int            `json:"downloads"`
	Likes        int            `json:"likes"`
	PipelineTag  string         `json:"pipeline_tag"`
	LibraryName  string         `json:"library_name"`
	Tags         []string       `json:"tags"`
	Private      bool           `json:"private"`
	Config       map[string]any `json:"config"`
	Safetensors  Safetensors    `json:"safetensors"`
	CreatedAt    string         `json:"createdAt"`
	LastModified string         `json:"lastModified"`
}

// Safetensors contains the safetensors metadata reported by the Hub.
type Safetensors struct {
	Parameters map[string]int64 `json:"parameters"`
	Total      int64            `json:"total"`
}

// Architectures returns the architectures declared in config.json. The Hub
// may encode the list as []any or []string depending on the endpoint.
func (m Model) Architectures() []string {
	if m.Config == nil {
		return nil
	}
	switch values := m.Config["architectures"].(type) {
	case []string:
		return append([]string(nil), values...)
	case []any:
		out := make([]string, 0, len(values))
		for _, value := range values {
			if architecture, ok := value.(string); ok {
				out = append(out, architecture)
			}
		}
		return out
	default:
		return nil
	}
}

// Parameters returns the safetensors parameter count in billions, or 0 when
// the Hub did not report it.
func (m Model) Parameters() float64 {
	return float64(m.Safetensors.Total) / 1e9
}

// ModelAuthor returns the organisation portion of a model ID.
func ModelAuthor(modelID string) string {
	if index := strings.IndexByte(modelID, '/'); index > 0 {
		return modelID[:index]
	}
	return ""
}

// Clone returns a deep-enough copy so callers cannot mutate cached data.
func (m Model) Clone() Model {
	cloned := m
	cloned.Tags = append([]string(nil), m.Tags...)
	if m.Config != nil {
		cloned.Config = make(map[string]any, len(m.Config))
		for key, value := range m.Config {
			cloned.Config[key] = value
		}
	}
	if m.Safetensors.Parameters != nil {
		cloned.Safetensors.Parameters = make(map[string]int64, len(m.Safetensors.Parameters))
		for key, value := range m.Safetensors.Parameters {
			cloned.Safetensors.Parameters[key] = value
		}
	}
	return cloned
}
