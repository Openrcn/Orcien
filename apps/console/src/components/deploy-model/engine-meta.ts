/*
 * Static, read-only engine facts for the step-3 Engine card.
 *
 * These mirror the backend runtime registries (runtimes/vllm/vllm.go,
 * runtimes/ollama/ollama.go). The console API does not expose image/version
 * metadata yet, so it lives here until that endpoint exists.
 */
export interface EngineMeta {
  id: string;
  name: string;
  version: string;
  tagline: string;
  image: string;
  health: string;
  port: number;
  api: string;
  endpoints: string;
  modelSource: string;
  cuda?: string;
  minVramGB?: number;
  highlights: string[];
}

export const ENGINE_META: Record<string, EngineMeta> = {
  vllm: {
    id: "vllm",
    name: "vLLM",
    version: "v0.26.0",
    tagline: "OpenAI-compatible inference server for high-throughput serving.",
    image: "docker.io/vllm/vllm-openai:v0.26.0",
    health: "/health",
    port: 9000,
    api: "OpenAI-compatible",
    endpoints: "/v1/chat/completions · /v1/embeddings",
    modelSource: "Hugging Face",
    cuda: "12.9",
    minVramGB: 16,
    highlights: ["Continuous batching", "PagedAttention", "AWQ / quantized models"],
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    version: "latest",
    tagline: "Local-first runtime for open models from the Ollama library.",
    image: "ollama/ollama:latest",
    health: "/api/tags",
    port: 11434,
    api: "Ollama native",
    endpoints: "/api/generate · /api/chat",
    modelSource: "Ollama library",
    highlights: ["Tools", "Thinking", "Vision"],
  },
};

export function getEngineMeta(runtime: string): EngineMeta | null {
  return ENGINE_META[runtime.toLowerCase().trim()] ?? null;
}
