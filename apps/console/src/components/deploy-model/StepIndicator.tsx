"use client";

import { Check } from "lucide-react";
import { cn } from "cn";
import { K } from "@/components/providers/kit";

const STEPS = [
  { id: 1, label: "Model" },
  { id: 2, label: "Compute" },
  { id: 3, label: "Engine" },
  { id: 4, label: "Deployment" },
  { id: 5, label: "Review" },
];

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1.5 rounded-xl border border-line bg-band p-[3px]">
      {STEPS.map((step) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        const clickable = done;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onStepClick?.(step.id)}
            className={cn(
              "flex h-8 items-center gap-2 whitespace-nowrap rounded-[9px] border px-3 text-[13px] transition",
              active
                ? "border-line2 bg-card font-medium text-fg"
                : done
                  ? "border-transparent text-mut2 hover:text-fg"
                  : "border-transparent text-mut",
            )}
          >
            {done ? (
              <span className="grid size-5 flex-none place-items-center rounded-full border border-ok/25 bg-ok/10">
                <Check className="size-3 text-ok" strokeWidth={2} />
              </span>
            ) : (
              <span
                className={cn(
                  "grid size-5 flex-none place-items-center rounded-full text-[11px] font-medium",
                  active
                    ? "bg-accent text-on-accent"
                    : "border border-line2 text-mut",
                )}
              >
                {step.id}
              </span>
            )}
            {step.label}
          </button>
        );
      })}
    </div>
  );
}