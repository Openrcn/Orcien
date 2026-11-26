"use client";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

export type DetailNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number | string;
};

type DetailTabsProps = {
  items: DetailNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
};

/** Section tabs — same pill pattern used across the kit-themed pages. */
export function DetailTabs({
  items,
  activeId,
  onSelect,
  ariaLabel = "Deployment sections",
}: DetailTabsProps) {
  return (
    <div className="mb-5 overflow-x-auto">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="inline-flex w-full max-w-full gap-0.5 rounded-[14px] border border-line bg-band p-1 sm:w-auto"
      >
        {items.map((tab) => {
          const Icon = tab.icon;
          const active = activeId === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onSelect(tab.id)}
              className="inline-flex h-[34px] shrink-0 items-center gap-2 rounded-[7px] border border-transparent px-3 text-sm text-mut2 transition hover:text-fg aria-selected:border-line2 aria-selected:bg-card aria-selected:font-medium aria-selected:text-fg !rounded-[10px]"
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.7} />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "font-mono text-[11.5px]",
                    active ? "text-fg" : "text-mut",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
