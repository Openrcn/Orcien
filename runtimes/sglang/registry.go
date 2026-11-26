package sglang

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"orcn/core"
)

// architectureRegistry mirrors SGLang's native model registry. It is generated
// from the EntryClass declarations in python/sglang/srt/models by
// scripts/sglang_registry_to_json.py.
type architectureRegistry struct {
	GeneratedFrom string            `json:"generated_from"`
	SourcePath    string            `json:"source_path"`
	Architectures map[string]string `json:"architectures"`
}

//go:embed compatibility/registry.json
var registryData []byte

var registry = loadRegistry()

func loadRegistry() architectureRegistry {
	var value architectureRegistry
	if err := json.Unmarshal(registryData, &value); err != nil {
		panic(fmt.Sprintf("invalid SGLang registry data: %v", err))
	}
	return value
}

func isSGLangArchitecture(architecture string) bool {
	_, ok := registry.Architectures[architecture]
	return ok
}

// firstSupportedArchitecture returns the first architecture with a native
// SGLang implementation.
func firstSupportedArchitecture(candidates []string) (string, bool) {
	for _, candidate := range candidates {
		if isSGLangArchitecture(candidate) {
			return candidate, true
		}
	}
	return "", false
}

func taskPipelineTag(task core.ModelTask) (string, error) {
	switch core.NormalizeModelTask(task) {
	case core.TaskTextGeneration:
		return "text-generation", nil
	default:
		return "", fmt.Errorf("SGLang does not support task %q yet", task)
	}
}
