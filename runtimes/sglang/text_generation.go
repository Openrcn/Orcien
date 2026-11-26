package sglang

import (
	"context"
	"strconv"
	"strings"

	"orcn/core"
	"orcn/pkg/huggingface"
)

const (
	// lmsysorg/sglang:v0.5.23 is the newest published release (2026-10-30,
	// CUDA 13.0.3); the architecture registry is generated from this same
	// release so the image and registry stay in sync.
	// https://hub.docker.com/r/lmsysorg/sglang/tags
	sglangImage       = "lmsysorg/sglang:v0.5.23"
	sglangPort        = 30000
	sglangHealthPath  = "/health"
	sglangMinVRAMGB   = 16
	sglangCUDAVersion = "13.0"
)

func (r *SGLangRuntime) buildJobSpec(command []string, config map[string]string) *core.JobSpec {
	image := sglangImage
	if custom := configValue(config, "image", ""); custom != "" {
		image = custom
	}

	return &core.JobSpec{
		Version: "v2",
		Type:    "container",
		SystemRequirements: core.SystemRequirements{
			MinVRAMGB:   sglangMinVRAMGB,
			CUDAVersion: sglangCUDAVersion,
		},
		Containers: []core.ContainerSpec{{
			ID: "sglang-inference-server",
			Args: core.ContainerArgs{
				Image:      image,
				GPU:        true,
				Entrypoint: []string{"python3", "-m", "sglang.launch_server"},
				Cmd:        command,
				Expose: []core.ExposeSpec{{
					Port:     sglangPort,
					Protocol: "http",
					IsPublic: true,
					HealthCheck: &core.HealthCheckSpec{
						Path:           sglangHealthPath,
						ExpectedStatus: 200,
						TimeoutSeconds: 10,
					},
				}},
			},
		}},
	}
}

func (r *SGLangRuntime) buildTextGenerationJobSpec(modelID string, config map[string]string) *core.JobSpec {
	command := []string{
		"--model-path", modelID,
		"--served-model-name", modelID,
		"--host", "0.0.0.0",
		"--port", strconv.Itoa(sglangPort),
		"--trust-remote-code",
		"--dtype", configValue(config, "dtype", "auto"),
	}

	// Leave mem_fraction_static to SGLang's automatic sizing unless the user
	// sets it — the auto value depends on GPU memory and is lower on small
	// cards than a hardcoded 0.85.
	if memFraction := configValue(config, "mem_fraction_static", ""); memFraction != "" {
		command = append(command, "--mem-fraction-static", memFraction)
	}

	if contextLength := configValue(config, "context_length", ""); contextLength != "" {
		command = append(command, "--context-length", contextLength)
	}
	if tensorParallel := configValue(config, "tensor_parallel", "0"); tensorParallel != "0" {
		command = append(command, "--tp-size", tensorParallel)
	}
	if kvcache := configValue(config, "kv_cache_dtype", "auto"); kvcache != "auto" && kvcache != "" {
		command = append(command, "--kv-cache-dtype", kvcache)
	}
	if configValue(config, "enable_prefix_caching", "true") == "false" {
		command = append(command, "--disable-radix-cache")
	}
	if configValue(config, "enable_cuda_graph", "true") == "false" {
		command = append(command, "--disable-cuda-graph")
	}
	if maxRunning := configValue(config, "max_running_requests", ""); maxRunning != "" {
		command = append(command, "--max-running-requests", maxRunning)
	}
	if maxPrefill := configValue(config, "max_prefill_tokens", ""); maxPrefill != "" {
		command = append(command, "--max-prefill-tokens", maxPrefill)
	}
	if chunkedPrefill := configValue(config, "chunked_prefill_size", ""); chunkedPrefill != "" {
		command = append(command, "--chunked-prefill-size", chunkedPrefill)
	}
	if toolParser := configValue(config, "tool_parser", ""); toolParser != "" {
		command = append(command, "--tool-call-parser", toolParser)
	}
	if reasoningParser := configValue(config, "reasoning_parser", ""); reasoningParser != "" {
		command = append(command, "--reasoning-parser", reasoningParser)
	}
	if quantization := configValue(config, "quantization", ""); quantization != "" {
		command = append(command, "--quantization", quantization)
	}
	if apiKey := configValue(config, "api_key", ""); apiKey != "" {
		command = append(command, "--api-key", apiKey)
	}
	if configValue(config, "enable_cache_report", "false") == "true" {
		command = append(command, "--enable-cache-report")
	}
	// --enable-metrics is commented out for now (kept for quick re-enable):
	// SGLang defaults it to false and we don't scrape the endpoint yet.
	// if configValue(config, "enable_metrics", "false") == "true" {
	// 	command = append(command, "--enable-metrics")
	// }

	return r.buildJobSpec(command, config)
}

func (r *SGLangRuntime) textGenerationSchema() []core.ConfigOption {
	return []core.ConfigOption{
		{
			Key: "mem_fraction_static", Name: "GPU Memory Fraction",
			Description: "Fraction of GPU memory reserved for weights and the KV cache. Leave empty for SGLang's automatic sizing (recommended).",
			Type:        "number", Default: "",
			Min: floatPtr(0.1), Max: floatPtr(1.0),
		},
		{
			Key: "context_length", Name: "Max Context Length",
			Description: "Maximum sequence length. Leave empty to use the model's native maximum.", Type: "number", Default: "",
			Min: floatPtr(512),
		},
		{
			Key: "tensor_parallel", Name: "Tensor Parallel Size",
			Description: "Number of GPUs used to shard the model (0=disabled).", Type: "select", Default: "0",
			Options: []string{"0", "2", "4", "8"},
		},
		{
			Key: "dtype", Name: "Data Type",
			Description: "Weight and activation data type used by SGLang.", Type: "select", Default: "auto",
			Options: []string{"auto", "float16", "bfloat16"},
		},
		{
			Key: "kv_cache_dtype", Name: "KV Cache Data Type",
			Description: "Optional KV cache precision.", Type: "select", Default: "auto",
			Options: []string{"auto", "fp8_e5m2", "fp8_e4m3"},
		},
		{
			Key: "enable_prefix_caching", Name: "Prefix Caching",
			Description: "Keep SGLang RadixAttention prefix caching enabled.", Type: "boolean", Default: "true",
		},
		{
			Key: "enable_cuda_graph", Name: "CUDA Graphs",
			Description: "Use CUDA graphs for decode. Disable only for debugging.", Type: "boolean", Default: "true",
		},
		{
			Key: "max_running_requests", Name: "Maximum Concurrent Requests",
			Description: "Maximum number of requests processed concurrently. Leave empty for SGLang's default.", Type: "number", Default: "",
		},
		{
			Key: "max_prefill_tokens", Name: "Maximum Prefill Tokens",
			Description: "Upper bound for tokens processed in one prefill batch.", Type: "number", Default: "",
		},
		{
			Key: "chunked_prefill_size", Name: "Chunked Prefill Size",
			Description: "Maximum tokens per chunk when chunked prefill is enabled.", Type: "number", Default: "",
		},
		{
			Key: "tool_parser", Name: "Tool Parser",
			Description: "SGLang tool-call parser for function calling (for example qwen25, llama3, deepseekv3).", Type: "text", Default: "",
		},
		{
			Key: "reasoning_parser", Name: "Reasoning Parser",
			Description: "SGLang reasoning parser (for example deepseek-r1 or qwen3).", Type: "text", Default: "",
		},
		{
			Key: "quantization", Name: "Quantization",
			Description: "Optional quantization method (for example fp8, awq or gptq).", Type: "text", Default: "",
		},
		{
			Key: "api_key", Name: "API Key",
			Description: "Optional API key required by the SGLang server.", Type: "text", Default: "",
		},
		{
			Key: "enable_cache_report", Name: "Cache Report",
			Description: "Return the number of prefix-cache hit tokens in usage.prompt_tokens_details for each OpenAI request.",
			Type:        "boolean", Default: "false",
		},
		// --enable-metrics is commented out (flag not passed while disabled);
		// uncomment here and in buildTextGenerationJobSpec to re-enable.
		// {
		// 	Key: "enable_metrics", Name: "Prometheus Metrics",
		// 	Description: "Expose SGLang metrics on the /metrics endpoint.",
		// 	Type: "boolean", Default: "false",
		// },
	}
}

func textGenerationMetadata(data map[string]any) map[string]any {
	metadata := map[string]any{"Task": string(core.TaskTextGeneration)}
	config, _ := data["config"].(map[string]any)

	if pipeline, ok := data["pipeline_tag"].(string); ok && pipeline != "" {
		metadata["Pipeline"] = pipeline
	}
	if value, ok := firstModelValue(config, "max_position_embeddings", "max_seq_length", "max_sequence_length"); ok {
		metadata["Context Length"] = value
	}
	if value, ok := firstModelValue(config, "hidden_size"); ok {
		metadata["Hidden Size"] = value
	}
	if value, ok := firstModelValue(config, "num_hidden_layers", "num_layers"); ok {
		metadata["Layers"] = value
	}
	if value, ok := firstModelValue(config, "vocab_size"); ok {
		metadata["Vocabulary Size"] = value
	}
	return metadata
}

func enrichModelConfig(ctx context.Context, modelID string, data map[string]any) {
	config := map[string]any{}
	if existing, ok := data["config"].(map[string]any); ok {
		config = existing
	}

	fullConfig, err := huggingface.Default().RawJSON(ctx, modelID, "config.json")
	if err == nil {
		for key, value := range fullConfig {
			if _, exists := config[key]; !exists {
				config[key] = value
			}
		}
	}
	data["config"] = config
}

func firstModelValue(config map[string]any, keys ...string) (any, bool) {
	if config == nil {
		return nil, false
	}
	for _, key := range keys {
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
	}
	return nil, false
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
