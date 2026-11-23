"use client";

import { cn } from "cn";

export interface SegmentedOption {
  label: string;
  value: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[10px] border border-line bg-band p-[3px]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-[26px] whitespace-nowrap rounded-[7px] border px-[11px] text-[12.5px] transition-colors",
              active
                ? "border-line2 bg-card font-medium text-fg"
                : "border-transparent text-mut2 hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
