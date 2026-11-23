"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logos";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { CuratedModel } from "@/data/curated-models";

function formatParams(p: number) {
  if (p < 1) return `${Math.round(p * 1000)}M`;
  return `${p}B`;
}

export function ModelCard({
  model,
  onDeploy,
}: {
  model: CuratedModel;
  onDeploy: (modelId: string) => void;
}) {
  const variants = useMemo(() => model.variants ?? [], [model.variants]);
  const [selectedId, setSelectedId] = useState(model.modelId);

  const activeVariant = variants.find((v) => v.modelId === selectedId);
  const modelId = activeVariant?.modelId ?? model.modelId;
  const parameters = activeVariant?.parameters ?? model.parameters;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-line bg-band px-1.5 pb-1.5 transition hover:border-line2 [box-shadow:var(--sh)]">
      {/* Header sits on the band */}
      <div className="flex items-center gap-3 px-3 pb-[11px] pt-[13px]">
        <span className="grid size-[34px] flex-none place-items-center rounded-[10px] border border-line bg-card">
          <Logo name={model.logo} size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <b
            className="block truncate text-[15px] font-semibold tracking-[-.01em]"
            title={model.displayName}
          >
            {model.familyName ?? model.displayName}
          </b>
          <small className="block text-[12.5px] leading-tight text-mut">
            {model.provider}
          </small>
        </div>

        <span className="inline-flex h-[22px] flex-none items-center gap-1.5 rounded-full border border-accent-t/25 bg-accent-t/10 px-[9px] text-[11.5px] text-accent-t">
          <i className="size-1.5 rounded-full bg-accent-t" />
          Tested
        </span>
      </div>

      {/* Details in the inner card */}
      <div className="flex flex-1 flex-col gap-3.5 rounded-xl border border-line bg-card p-4">
        <p className="line-clamp-3 min-h-[65px] text-[13.5px] leading-relaxed text-mut2">
          {model.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-line bg-card px-[9px] py-px text-[11px] font-medium text-mut2">
            {model.pipeline}
          </span>
          {model.tags.slice(0, 1).map((tag) => (
            <span
              key={tag}
              title={tag}
              className="max-w-full truncate rounded-full border border-line bg-card px-[9px] py-px text-[11px] font-medium capitalize text-mut2"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-3.5">
          {variants.length > 1 ? (
            <SegmentedControl
              ariaLabel={`${model.familyName ?? model.displayName} size`}
              options={variants.map((v) => ({
                label: v.label,
                value: v.modelId,
              }))}
              value={modelId}
              onChange={setSelectedId}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full border border-line bg-card px-[9px] py-px font-mono text-[11px] text-mut2">
                {formatParams(parameters)}
              </span>
              <span className="text-xs text-mut">{model.runtime}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => onDeploy(modelId)}
            className="ml-auto inline-flex h-8 items-center gap-2 rounded-full border border-accent bg-accent px-3.5 text-[13px] font-medium text-on-accent transition hover:brightness-110 active:translate-y-px"
          >
            Deploy
            <ArrowRight className="size-4" strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </article>
  );
}
