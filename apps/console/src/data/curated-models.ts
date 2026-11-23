"use client";

import modelsJson from "../../public/models.json";

export const DEFAULT_VLLM_IMAGE = "docker.io/vllm/vllm-openai:v0.26.0";
export const DEFAULT_OLLAMA_IMAGE = "ollama/ollama:latest";

export type ModelCategory =
  | "llm"
  | "embedding"
  | "reranker"
  | "vision"
  | "decision"
  | "image"
  | "audio"
  | "video";

export interface CategoryInfo {
  id: ModelCategory;
  label: string;
  description: string;
}

export const MODEL_CATEGORIES: CategoryInfo[] = [
  {
    id: "llm",
    label: "LLM",
    description: "Chat, instruct and reasoning models for text generation.",
  },
  {
    id: "embedding",
    label: "Embedding",
    description: "Vector embedding models for search, RAG and recommendations.",
  },
  {
    id: "reranker",
    label: "Reranker",
    description: "Scoring models to rerank search results by relevance.",
  },
  {
    id: "vision",
    label: "Vision",
    description: "Multimodal models that understand images and documents.",
  },
  {
    id: "decision",
    label: "Decision",
    description:
      "Fast classification models with typed, structured answers.",
  },
  {
    id: "image",
    label: "Image",
    description: "Text-to-image generation models.",
  },
  {
    id: "audio",
    label: "Audio",
    description: "Speech recognition and audio-language models.",
  },
  {
    id: "video",
    label: "Video",
    description: "Video understanding and generation models.",
  },
];

/** Size / quantisation variant of a model family (e.g. 8B vs 70B). */
export interface ModelVariant {
  label: string;
  modelId: string;
  parameters?: number;
  contextLength?: string;
  minVramGb?: number;
}

export interface CuratedModel {
  displayName: string;
  /** Family name shown as the card title when variants exist. */
  familyName?: string;
  modelId: string;
  description: string;
  logo: string;
  provider: string;
  category: ModelCategory;
  parameters: number;
  runtime: string;
  modality: string;
  pipeline: string;
  image: string;
  tags: string[];
  contextLength?: string;
  minVramGb?: number;
  /** Label for the default variant when `variants` is present. */
  variantLabel?: string;
  /** Only present on models that ship in multiple sizes. */
  variants?: ModelVariant[];
}

/**
 * Curated catalog lives in `public/models.json` so models can be added or
 * edited without touching app code.
 */
export const CURATED_MODELS = modelsJson as CuratedModel[];

/** Unique provider names present in the catalog, for the provider filter. */
export const CURATED_PROVIDERS = Array.from(
  new Set(CURATED_MODELS.map((m) => m.provider)),
).sort();
