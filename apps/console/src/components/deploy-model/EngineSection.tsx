"use client";

import { useState } from "react";
import { Box, ChevronDown, Settings2 } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { K } from "@/components/providers/kit";
import { ConfigOption } from "./AdvancedConfigSection";
import { EngineInfoCard } from "./EngineInfoCard";
import { getEngineMeta } from "./engine-meta";

interface EngineSectionProps {
  runtime: string;
  modality: string;
  taskLabel?: string;
  schema: ConfigOption[];
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
  image: string;
  onImageChange: (value: string) => void;
}

/* Keys that are commonly tuned and belong in the always-open Settings card. */
const IMPORTANT_KEYS = new Set([
  "gpu_memory_utilization",
  "max_model_len",
  "context_length",
  "num_parallel",
  "dtype",
  "tensor_parallel",
  "max_num_seqs",
  "enable_prefix_caching",
  "cuda_graphs",
]);

/* Engine step: engine info · Settings (open) · Advanced settings · Container */
export function EngineSection({
  runtime,
  modality,
  taskLabel,
  schema,
  config,
  onChange,
  image,
  onImageChange,
}: EngineSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showContainer, setShowContainer] = useState(false);

  // `api_key` is owned by the Deployment step, never duplicated here.
  const options = schema.filter((opt) => opt.key !== "api_key");

  let important = options.filter((opt) => IMPORTANT_KEYS.has(opt.key));
  let advanced = options.filter((opt) => !IMPORTANT_KEYS.has(opt.key));

  // Unknown runtime schemas: keep the first few visible, rest advanced.
  if (important.length === 0 && options.length > 0) {
    important = options.slice(0, 3);
    advanced = options.slice(3);
  }

  // vLLM currently exposes only advanced + container; hide the Settings card
  // entirely unless the runtime actually surfaces important keys. For vLLM we
  // force everything into advanced so the card disappears (requirement).
  if (runtime === "vllm") {
    if (options.length > 0) {
      important = [];
      advanced = options;
    }
  }

  const container = getEngineMeta(runtime);

  return (
    <div className="space-y-6">
      {/* 0. Engine identity + read-only facts */}
      <EngineInfoCard
        runtime={runtime}
        taskLabel={taskLabel}
        image={image}
        optionCount={options.length}
      />

      {/* 1. Settings — only when the runtime exposes important keys */}
      {important.length > 0 && (
        <section className={K.dbx}>
          <div className="flex items-center justify-between px-3 pb-2.5 pt-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-.01em]">
                Settings
              </h3>
              <p className="mt-0.5 text-[12px] text-mut">
                Key inference settings for {modality} on {runtime}.
              </p>
            </div>
            <span className={cn(K.pill, "capitalize")}>{runtime}</span>
          </div>
          <div className={K.inner}>
            <div className="space-y-4 p-4">
              {important.map((opt) => (
                <EngineField
                  key={opt.key}
                  option={opt}
                  value={config[opt.key]}
                  onChange={onChange}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. Advanced settings — collapsed by default, one input per row */}
      {advanced.length > 0 && (
        <section className={K.dbx}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowAdvanced((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowAdvanced((v) => !v);
              }
            }}
            className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-[32px] shrink-0 place-items-center rounded-[10px] border border-line bg-card text-mut2">
                <Settings2 className="size-4" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold leading-tight tracking-[-.01em]">
                  Advanced settings
                </h3>
                <p className="mt-0.5 truncate text-[12px] leading-tight text-mut">
                  Low-level engine flags · safe to keep defaults
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <span className={cn(K.pill, "hidden sm:inline-flex")}>
                {advanced.length} options
              </span>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-mut transition",
                  showAdvanced && "rotate-180",
                )}
              >
                <ChevronDown className="size-4" strokeWidth={1.7} />
              </span>
            </span>
          </div>
          {showAdvanced && (
            <div className={K.inner}>
              <div className="space-y-4 p-4">
                {advanced.map((opt) => (
                  <EngineField
                    key={opt.key}
                    option={opt}
                    value={config[opt.key]}
                    onChange={onChange}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. Container — collapsed by default, image override + backend facts */}
      <section className={K.dbx}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowContainer((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowContainer((v) => !v);
            }
          }}
          className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-[32px] shrink-0 place-items-center rounded-[10px] border border-line bg-card text-mut2">
              <Box className="size-4" strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold leading-tight tracking-[-.01em]">
                Container
              </h3>
              <p className="mt-0.5 truncate text-[12px] leading-tight text-mut">
                {image
                  ? image.split("/").pop()?.slice(0, 40) || image.slice(0, 32)
                  : container?.image ?? "Image used to serve this model."}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <span className={cn(K.pill, "hidden capitalize sm:inline-flex")}>
              {runtime}
            </span>
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-mut transition",
                showContainer && "rotate-180",
              )}
            >
              <ChevronDown className="size-4" strokeWidth={1.7} />
            </span>
          </span>
        </div>
        {showContainer && (
          <div className={K.inner}>
            <div className="space-y-1.5 border-b border-line p-4">
              <label className="text-[12px] font-medium text-mut2">
                Container image
              </label>
              <Input
                type="text"
                value={image}
                onChange={(e) => onImageChange(e.target.value)}
                placeholder={container?.image || "Runtime default image"}
                className="font-mono text-[13px]"
              />
              <p className="text-[11px] text-mut">
                Leave empty to use the runtime default.
              </p>
            </div>

            {container ? (
              <>
                <div className={K.kv}>
                  <span className="flex-1 text-mut2">Health check</span>
                  <b className="font-mono text-[12.5px] font-medium">
                    {container.health}
                  </b>
                </div>
                <div className={K.kv}>
                  <span className="flex-1 text-mut2">Port</span>
                  <b className="font-mono text-[12.5px] font-medium">
                    {container.port}
                  </b>
                </div>
              </>
            ) : (
              <div className={K.kv}>
                <span className="flex-1 text-mut2">Runtime</span>
                <b className="text-[12.5px] font-medium">
                  Managed by {runtime}
                </b>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* One schema field, always full-width (single row). */
function EngineField({
  option,
  value,
  onChange,
}: {
  option: ConfigOption;
  value?: string;
  onChange: (key: string, value: string) => void;
}) {
  const currentValue = value !== undefined ? value : option.default;

  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-mut2">
        {option.name || option.key}
      </label>
      {option.description && (
        <p className="text-[11px] text-mut">{option.description}</p>
      )}
      {option.type === "boolean" ? (
        <Select
          value={currentValue === "true" ? "true" : "false"}
          onValueChange={(val: string) => onChange(option.key, val)}
        >
          <SelectTrigger className="w-full text-[13.5px] data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Enabled</SelectItem>
            <SelectItem value="false">Disabled</SelectItem>
          </SelectContent>
        </Select>
      ) : option.type === "select" && option.options ? (
        <Select
          value={currentValue || "auto"}
          onValueChange={(val: string) =>
            onChange(option.key, val === "auto" ? "" : val)
          }
        >
          <SelectTrigger className="w-full text-[13.5px] data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {option.options.map((o) => (
              <SelectItem key={o || "auto"} value={o || "auto"}>
                {o === "" ? "Auto detect" : o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : option.type === "number" ? (
        <Input
          type="number"
          min={option.min}
          max={option.max}
          value={currentValue ?? ""}
          onChange={(e) => onChange(option.key, e.target.value)}
          placeholder={String(option.default ?? "")}
          className="text-[13px]"
        />
      ) : (
        <Input
          type="text"
          value={currentValue ?? ""}
          onChange={(e) => onChange(option.key, e.target.value)}
          placeholder={option.default || ""}
          className="font-mono text-[13px]"
        />
      )}
    </div>
  );
}
