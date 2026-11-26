package sglang

import (
	"testing"

	"orcn/assets"
	"orcn/core"
)

func TestBuildTextGenerationJobSpec(t *testing.T) {
	spec, err := New().BuildJobSpec("Qwen/Qwen3-8B", core.TaskTextGeneration, nil)
	if err != nil {
		t.Fatal(err)
	}

	args := spec.Containers[0].Args
	if len(args.Entrypoint) != 3 || args.Entrypoint[0] != "python3" || args.Entrypoint[2] != "sglang.launch_server" {
		t.Fatalf("entrypoint = %#v", args.Entrypoint)
	}
	if !containsPair(args.Cmd, "--model-path", "Qwen/Qwen3-8B") {
		t.Fatalf("missing model path: %#v", args.Cmd)
	}
	if !containsPair(args.Cmd, "--port", "30000") {
		t.Fatalf("missing port: %#v", args.Cmd)
	}
	if containsFlag(args.Cmd, "--mem-fraction-static") {
		t.Fatalf("memory fraction should default to SGLang auto sizing: %#v", args.Cmd)
	}
	if containsFlag(args.Cmd, "--enable-metrics") {
		t.Fatalf("metrics should be disabled: %#v", args.Cmd)
	}
	if containsFlag(args.Cmd, "--enable-cache-report") {
		t.Fatalf("cache report should be disabled by default: %#v", args.Cmd)
	}
	if len(args.Expose) != 1 || args.Expose[0].Port != 30000 {
		t.Fatalf("expose = %#v", args.Expose)
	}
	if args.Expose[0].HealthCheck == nil || args.Expose[0].HealthCheck.Path != "/health" {
		t.Fatalf("health check = %#v", args.Expose[0].HealthCheck)
	}
}

func TestBuildTextGenerationJobSpecAddsConfiguredFlags(t *testing.T) {
	spec, err := New().BuildJobSpec("Qwen/Qwen3-8B", core.TaskTextGeneration, map[string]string{
		"context_length":        "8192",
		"tensor_parallel":       "2",
		"dtype":                 "bfloat16",
		"kv_cache_dtype":        "fp8_e4m3",
		"enable_prefix_caching": "false",
		"enable_cuda_graph":     "false",
		"max_running_requests":  "64",
		"max_prefill_tokens":    "8192",
		"chunked_prefill_size":  "4096",
		"tool_parser":           "qwen25",
		"reasoning_parser":      "qwen3",
		"quantization":          "fp8",
		"api_key":               "secret",
		"enable_cache_report":   "true",
		"mem_fraction_static":   "0.75",
	})
	if err != nil {
		t.Fatal(err)
	}

	cmd := spec.Containers[0].Args.Cmd
	for key, value := range map[string]string{
		"--context-length":       "8192",
		"--tp-size":              "2",
		"--dtype":                "bfloat16",
		"--kv-cache-dtype":       "fp8_e4m3",
		"--max-running-requests": "64",
		"--max-prefill-tokens":   "8192",
		"--chunked-prefill-size": "4096",
		"--tool-call-parser":     "qwen25",
		"--reasoning-parser":     "qwen3",
		"--quantization":         "fp8",
		"--api-key":              "secret",
		"--mem-fraction-static":  "0.75",
	} {
		if !containsPair(cmd, key, value) {
			t.Fatalf("missing %s=%s: %#v", key, value, cmd)
		}
	}
	for _, flag := range []string{"--disable-radix-cache", "--disable-cuda-graph", "--enable-cache-report"} {
		if !containsFlag(cmd, flag) {
			t.Fatalf("missing %s: %#v", flag, cmd)
		}
	}
	if containsFlag(cmd, "--enable-metrics") {
		t.Fatalf("metrics should be disabled: %#v", cmd)
	}
}

func TestBuildJobSpecRejectsUnsupportedTask(t *testing.T) {
	if _, err := New().BuildJobSpec("model", core.TaskEmbedding, nil); err == nil {
		t.Fatal("expected embedding to be rejected")
	}
}

func TestRegistryContainsCommonArchitectures(t *testing.T) {
	for _, architecture := range []string{"Qwen3ForCausalLM", "LlamaForCausalLM", "DeepseekV3ForCausalLM"} {
		if !isSGLangArchitecture(architecture) {
			t.Fatalf("registry is missing %s", architecture)
		}
	}
}

func TestFirstSupportedArchitecture(t *testing.T) {
	architecture, ok := firstSupportedArchitecture([]string{"UnknownModel", "LlamaForCausalLM"})
	if !ok || architecture != "LlamaForCausalLM" {
		t.Fatalf("architecture = %q, ok = %v", architecture, ok)
	}
}

func TestIsSGLangCompatible(t *testing.T) {
	for _, id := range []string{"org/model", "Qwen/Qwen3-8B-AWQ"} {
		if !IsSGLangCompatible(id) {
			t.Fatalf("%q should be compatible", id)
		}
	}
	for _, id := range []string{"org/model-GGUF", "org/model-mlx", "org/model.exl2", "org/model-bnb"} {
		if IsSGLangCompatible(id) {
			t.Fatalf("%q should be rejected", id)
		}
	}
}

func TestParseBootstrapCatalog(t *testing.T) {
	raw, err := assets.ReadFile("sglang_bootstrap.json")
	if err != nil {
		t.Fatal(err)
	}

	models, err := parseBootstrapCatalog(raw, core.TaskTextGeneration)
	if err != nil {
		t.Fatal(err)
	}
	if len(models) == 0 {
		t.Fatal("bootstrap catalog is empty")
	}
	for _, model := range models {
		if model.Architecture == "" || !isSGLangArchitecture(model.Architecture) {
			t.Fatalf("bootstrap entry %q has unsupported architecture %q", model.ID, model.Architecture)
		}
		if len(model.Tags) == 0 {
			t.Fatalf("bootstrap entry %q has no tags", model.ID)
		}
	}
}

func TestValidateAdvancedConfig(t *testing.T) {
	schema := New().GetAdvancedConfigSchema(core.TaskTextGeneration)
	for _, config := range []map[string]string{
		{"bogus_flag": "1"},
		{"mem_fraction_static": "0"},
		{"mem_fraction_static": "1.5"},
		{"context_length": "0"},
		{"context_length": "abc"},
		{"dtype": "int4"},
		{"enable_cuda_graph": "maybe"},
	} {
		if err := validateAdvancedConfig(config, schema); err == nil {
			t.Fatalf("expected %#v to be rejected", config)
		}
	}
	if err := validateAdvancedConfig(map[string]string{"context_length": "8192"}, schema); err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}
}

func containsPair(values []string, key, value string) bool {
	for index := 0; index+1 < len(values); index++ {
		if values[index] == key && values[index+1] == value {
			return true
		}
	}
	return false
}

func containsFlag(values []string, flag string) bool {
	for _, value := range values {
		if value == flag {
			return true
		}
	}
	return false
}
