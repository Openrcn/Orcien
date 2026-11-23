"use client";

import { Download, Heart } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/ui/Logos";
import { K } from "@/components/providers/kit";

export interface ModelItem {
  id: string;
  name: string;
  org: string;
  downloads?: number;
  likes?: number;
  vram?: string;
  tags?: string[];
  pipelineTag?: string;
  parameters?: number;
}

interface ModelCardProps {
  model: ModelItem;
  selected?: boolean;
  onClick?: () => void;
}

function formatCount(n: number) {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/* Stacked table-like model row (kit) – matches the providers list row language */
export function ModelCard({ model, selected, onClick }: ModelCardProps) {
  const {
    id,
    name,
    org,
    downloads,
    likes,
    vram,
    tags = [],
    pipelineTag,
    parameters,
  } = model;
  const badge = pipelineTag || tags[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative grid w-full grid-cols-[16px_34px_minmax(0,1fr)_auto] items-center gap-x-3.5 px-4 py-2.5 text-left transition",
        selected ? "bg-accent/[.05]" : "hover:bg-fg/[.03]",
      )}
    >
      {selected && (
        <span className="absolute inset-y-0 left-0 w-[2px] bg-accent" />
      )}

      {/* Radio */}
      <span
        className={cn(
          "grid size-4 flex-none place-items-center rounded-full border",
          selected ? "border-accent" : "border-line2",
        )}
      >
        {selected && <span className="size-2 rounded-full bg-accent" />}
      </span>

      {/* Logo tile */}
      <span className="grid size-[34px] flex-none place-items-center rounded-[10px] border border-line bg-card">
        <Logo name={org} size={18} />
      </span>

      {/* Name + meta */}
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[14px] leading-snug" title={id}>
            <span className="text-mut">{org}/</span>
            <b className="font-medium text-fg">{name}</b>
          </span>
          {badge && (
            <span className={cn(K.pill, "capitalize")}>{badge}</span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mut">
          {parameters !== undefined && parameters > 0 && (
            <span>{formatCount(parameters * 1e9)} params</span>
          )}
          {downloads !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Download className="size-3" strokeWidth={1.7} />
              {formatCount(downloads)}
            </span>
          )}
          {likes !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3" strokeWidth={1.7} />
              {formatCount(likes)}
            </span>
          )}
        </span>
      </span>

      {/* VRAM need */}
      <span className="text-right leading-tight">
        {vram ? (
          <>
            <small className="block text-[11px] text-mut">needs</small>
            <b className="text-[13px] font-medium text-fg">{vram}</b>
            <small className="block text-[11px] text-mut">VRAM</small>
          </>
        ) : (
          <small className="text-[11px] text-mut">—</small>
        )}
      </span>
    </button>
  );
}