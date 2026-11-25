"use client";

import { ExternalLink, KeyRound } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { K } from "@/components/providers/kit";
import { ModelDetails } from "./model-types";
import {
  CONTEXT_KEYS,
  DTYPE_KEYS,
  LAYERS_KEYS,
  VOCAB_KEYS,
  resolveConfigNumber,
  resolveConfigString,
} from "./config-utils";

interface ModelDetailCardProps {
  modelId: string;
  modelSource?: string;
  modelDetails: ModelDetails | null;
  taskLabel?: string;
  requiredVram: number;
  hfToken: string;
  onHfTokenChange: (token: string) => void;
}

/* Kit content block shown inline inside the expanded model row. */
export function ModelDetailCard({
  modelId,
  modelSource = "huggingface",
  modelDetails,
  taskLabel,
  requiredVram,
  hfToken,
  onHfTokenChange,
}: ModelDetailCardProps) {
  if (!modelId) return null;

  const modelName = modelId.split("/").pop() || "";
  const org = modelDetails?.author || modelId.split("/")[0] || "";

  const paramsCount = modelDetails?.safetensors?.total
    ? `${(modelDetails.safetensors.total / 1e9).toFixed(0)}B`
    : typeof modelDetails?.parameters === "number"
      ? `${modelDetails.parameters}B`
      : modelId.match(/(\d+)b/i)?.[1]
        ? `${modelId.match(/(\d+)b/i)?.[1]}B`
        : "—";

  const contextValue = resolveConfigNumber(modelDetails?.config, CONTEXT_KEYS);
  const contextLength =
    contextValue !== undefined ? `${Math.round(contextValue / 1024)}K` : "—";

  const layersValue = resolveConfigNumber(modelDetails?.config, LAYERS_KEYS);
  const layers = layersValue !== undefined ? layersValue : "—";

  const dtype =
    resolveConfigString(modelDetails?.config, DTYPE_KEYS) ||
    (modelDetails?.safetensors?.parameters
      ? Object.keys(modelDetails.safetensors.parameters)[0]
      : modelDetails?.quantization) ||
    "—";

  const architecture =
    modelDetails?.config?.architectures?.[0] || modelDetails?.family || "—";
  const modelType =
    modelDetails?.config?.model_type ||
    (modelId.toLowerCase().includes("instruct") ? "instruct" : "base");
  const license = modelDetails?.cardData?.license || "—";
  const lastUpdated = modelDetails?.lastModified
    ? new Date(modelDetails.lastModified).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const vocabValue = resolveConfigNumber(modelDetails?.config, VOCAB_KEYS);
  const vocabSize =
    vocabValue !== undefined ? vocabValue.toLocaleString() : "—";

  const description =
    modelDetails?.description || `${modelName} is a model from ${org}.`;
  const tags: string[] = Array.isArray(modelDetails?.tags)
    ? modelDetails.tags
    : [];

  const specs: Array<[string, string]> = [
    ["Parameters", String(paramsCount)],
    ["Context", contextLength],
    ["Layers", String(layers)],
    ["Dtype", String(dtype)],
    ["Est. VRAM", `~${Math.ceil(requiredVram || 16)} GB`],
  ];

  const meta: Array<[string, string]> = [
    ["Architecture", String(architecture)],
    ["Model type", String(modelType)],
    ["License", String(license)],
    ["Last updated", String(lastUpdated)],
    ["Vocabulary", String(vocabSize)],
    ["Framework", String(modelDetails?.library_name || "—")],
  ];

  const ollamaBase = modelId.split(":")[0]?.trim() || modelId;
  const externalLink =
    modelSource === "ollama"
      ? {
          href: `https://ollama.com/${ollamaBase.includes("/") ? ollamaBase : `library/${ollamaBase}`}`,
          label: "View on Ollama Registry",
        }
      : modelSource === "huggingface"
        ? {
            href: `https://huggingface.co/${modelId}`,
            label: "View on Hugging Face",
          }
        : null;

  return (
    <div className="grid gap-4">
      {/* Description + external links */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-mut2">
          {description}
        </p>
        {externalLink && (
          <a
            href={externalLink.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-none items-center gap-1.5 text-[12.5px] font-medium text-accent-t transition hover:brightness-110"
          >
            {externalLink.label}
            <ExternalLink className="size-3.5" strokeWidth={1.7} />
          </a>
        )}
      </div>

      {/* Gated token */}
      {modelDetails?.gated && (
        <div className="rounded-xl border border-warn/25 bg-warn/[0.04] px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
              <KeyRound className="size-3.5 text-warn" strokeWidth={1.7} />
              Hugging Face token required
            </span>
            <span className="text-[11px] text-mut">Gated model</span>
          </div>
          <Input
            type="password"
            placeholder="hf_…"
            value={hfToken}
            onChange={(e) => onHfTokenChange(e.target.value)}
            className="h-9 bg-card font-mono text-[12.5px]"
          />
        </div>
      )}

      {/* Quick specs strip */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-card p-4 sm:grid-cols-5">
        {specs.map(([label, value]) => (
          <div key={label}>
            <div className="truncate text-sm font-semibold capitalize" title={value}>
              {value}
            </div>
            <div className="mt-0.5 text-[11px] text-mut">{label}</div>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
        {meta.map(([label, value]) => (
          <div
            key={label}
            className="flex min-w-0 items-center justify-between gap-3 border-b border-line pb-2"
          >
            <span className="shrink-0 text-mut">{label}</span>
            <span className="min-w-0 truncate font-medium text-mut2" title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 16).map((t) => (
            <span key={t} className={K.pill}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}