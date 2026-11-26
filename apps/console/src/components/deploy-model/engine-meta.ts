/*
 * Fallback engine facts for the step-3 Engine card.
 *
 * The backend now exposes the same facts as `meta` on GET /api/v1/runtimes
 * (see core.RuntimeMeta in core/interfaces.go). This static map only fills
 * gaps when the backend does not provide meta yet.
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
  sglang: {
    id: "sglang",
    name: "SGLang",
    version: "v0.5.23",
    tagline: "High-throughput serving with RadixAttention and fast prefix caching.",
    image: "docker.io/lmsysorg/sglang:v0.5.23",
    health: "/health",
    port: 30000,
    api: "OpenAI-compatible",
    endpoints: "/v1/chat/completions · /generate",
    modelSource: "Hugging Face",
    cuda: "13.0",
    minVramGB: 16,
    highlights: ["RadixAttention", "Continuous batching", "Chunked prefill"],
  },
};

export function getEngineMeta(
  runtime: string,
  fromBackend?: EngineMeta | null,
): EngineMeta | null {
  const key = runtime.toLowerCase().trim();
  if (fromBackend) {
    return { ...ENGINE_META[key], ...fromBackend, id: key };
  }
  return ENGINE_META[key] ?? null;
}
