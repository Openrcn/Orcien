"use client";

import { Info } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/ui/Logos";
import { K } from "@/components/providers/kit";
import { getEngineMeta } from "./engine-meta";

interface EngineInfoCardProps {
  runtime: string;
  taskLabel?: string;
  image: string;
  optionCount: number;
}

/** Read-only summary of the engine selected in step 1. */
export function EngineInfoCard({
  runtime,
  taskLabel,
  image,
  optionCount,
}: EngineInfoCardProps) {
  const engine = getEngineMeta(runtime);
  if (!engine) return null;

  const trimmedImage = image.trim();
  const isCustomImage = trimmedImage.length > 0 && trimmedImage !== engine.image;
  const displayedVersion = isCustomImage
    ? trimmedImage.split(":").pop() || engine.version
    : engine.version;

  return (
    <section className={K.dbx}>
      <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-accent-t">
            <Logo name={engine.id} size={22} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold leading-tight tracking-[-.01em]">
              {engine.name}
            </h3>
            <p className="mt-0.5 truncate text-[12px] leading-tight text-mut">
              {engine.tagline}
            </p>
          </div>
        </div>
        <span className={cn(K.pill, "shrink-0 font-mono")}>
          {displayedVersion}
        </span>
      </div>

      <div className={K.inner}>
        <div className={K.kv}>
          <span className="flex-1 text-mut2">Engine</span>
          <b className="text-[12.5px] font-medium">{engine.name}</b>
          <span className="font-mono text-[11px] text-mut">({engine.id})</span>
        </div>
        <div className={K.kv}>
          <span className="flex-1 text-mut2">Version</span>
          <b className="font-mono text-[12.5px] font-medium">
            {displayedVersion}
          </b>
          {isCustomImage && (
            <span className={cn(K.pill, "text-[10px]")}>custom image</span>
          )}
        </div>
        <div className={K.kv}>
          <span className="flex-1 text-mut2">Task</span>
          <b className="text-[12.5px] font-medium">{taskLabel || "—"}</b>
        </div>
        <div className={K.kv}>
          <span className="flex-1 text-mut2">API</span>
          <div className="min-w-0 text-right">
            <b className="text-[12.5px] font-medium">{engine.api}</b>
            <p className="truncate font-mono text-[11px] text-mut">
              {engine.endpoints}
            </p>
          </div>
        </div>
        <div className={K.kv}>
          <span className="flex-1 text-mut2">Container image</span>
          <b className="truncate font-mono text-[12px] font-medium" title={image || engine.image}>
            {image || engine.image}
          </b>
        </div>
        <div className={K.kv}>
          <span className="flex-1 text-mut2">Health check</span>
          <b className="font-mono text-[12.5px] font-medium">
            {engine.health}
          </b>
          <span className="text-mut">·</span>
          <b className="font-mono text-[12.5px] font-medium">{engine.port}</b>
        </div>
        {engine.cuda && (
          <div className={K.kv}>
            <span className="flex-1 text-mut2">CUDA / min VRAM</span>
            <b className="font-mono text-[12.5px] font-medium">
              {engine.cuda} · {engine.minVramGB} GB
            </b>
          </div>
        )}
        <div className={K.kv}>
          <span className="flex-1 text-mut2">Built for</span>
          <span className="flex flex-wrap justify-end gap-1">
            {engine.highlights.map((h) => (
              <span key={h} className={K.pill}>
                {h}
              </span>
            ))}
          </span>
        </div>
        <div className="flex items-start gap-2 px-4 py-3 text-[11px] leading-snug text-mut">
          <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.7} />
          <p>
            Engine and version are managed by the platform — no editable options
            yet. {optionCount > 0 && `Tune ${optionCount} engine flags under Advanced settings.`}
          </p>
        </div>
      </div>
    </section>
  );
}
