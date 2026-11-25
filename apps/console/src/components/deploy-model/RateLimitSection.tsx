"use client";

import { useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { K } from "@/components/providers/kit";

/** Effective ingress policy for model inference, published by the gateway. */
export interface RateLimitDefaults {
  requestsPerMinute: number;
  burstRequests: number;
  maxConcurrentRequests: number;
  maxRequestsPerMinute: number;
}

interface RateLimitSectionProps {
  defaults: RateLimitDefaults | null;
  requestsPerMinute: number;
  onRequestsPerMinuteChange: (val: number) => void;
  burstRequests: number;
  onBurstRequestsChange: (val: number) => void;
  maxConcurrentRequests: number;
  onMaxConcurrentRequestsChange: (val: number) => void;
}

function toCount(value: string, fallback: number): number {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

/**
 * Step 4 advanced card: per-deployment request limits (RPM, burst, concurrency).
 * Defaults and the RPM ceiling come from GET /api/v1/ingress/defaults, so
 * changing them in backend config needs no frontend change. 0 = server default.
 */
export function RateLimitSection({
  defaults,
  requestsPerMinute,
  onRequestsPerMinuteChange,
  burstRequests,
  onBurstRequestsChange,
  maxConcurrentRequests,
  onMaxConcurrentRequestsChange,
}: RateLimitSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const maxRpm = defaults?.maxRequestsPerMinute;

  return (
    <section className={K.dbx}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-[32px] shrink-0 place-items-center rounded-[10px] border border-line bg-card text-mut2">
            <Activity className="size-4" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold leading-tight tracking-[-.01em]">
              Rate limits
            </h3>
            <p className="mt-0.5 truncate text-[12px] leading-tight text-mut">
              Requests per minute, burst and concurrency for this endpoint
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className={cn(K.pill, "hidden sm:inline-flex")}>Advanced</span>
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full text-mut transition",
              expanded && "rotate-180",
            )}
          >
            <ChevronDown className="size-4" strokeWidth={1.7} />
          </span>
        </span>
      </div>

      {expanded && (
        <div className={K.inner}>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <label
                htmlFor="requests-per-minute"
                className="text-[12px] font-medium text-mut2"
              >
                Requests per minute
              </label>
              <Input
                id="requests-per-minute"
                type="number"
                min={0}
                max={maxRpm || undefined}
                value={requestsPerMinute}
                onChange={(e) => {
                  const next = toCount(e.target.value, requestsPerMinute);
                  onRequestsPerMinuteChange(
                    maxRpm && maxRpm > 0 ? Math.min(maxRpm, next) : next,
                  );
                }}
                placeholder={
                  defaults ? String(defaults.requestsPerMinute) : undefined
                }
                className="text-[13px]"
              />
              <p className="text-[11px] text-mut">
                Sustained limit for the whole endpoint, shared across replicas.
                {maxRpm && maxRpm > 0
                  ? ` Max ${maxRpm} for model deployments.`
                  : ""}
              </p>
            </div>

            <div className="space-y-1.5 border-t border-line pt-4">
              <label
                htmlFor="burst-requests"
                className="text-[12px] font-medium text-mut2"
              >
                Burst requests
              </label>
              <Input
                id="burst-requests"
                type="number"
                min={0}
                value={burstRequests}
                onChange={(e) =>
                  onBurstRequestsChange(toCount(e.target.value, burstRequests))
                }
                placeholder={
                  defaults ? String(defaults.burstRequests) : undefined
                }
                className="text-[13px]"
              />
              <p className="text-[11px] text-mut">
                Short burst allowance on top of the sustained rate.
              </p>
            </div>

            <div className="space-y-1.5 border-t border-line pt-4">
              <label
                htmlFor="max-concurrent-requests"
                className="text-[12px] font-medium text-mut2"
              >
                Max concurrent requests
              </label>
              <Input
                id="max-concurrent-requests"
                type="number"
                min={0}
                value={maxConcurrentRequests}
                onChange={(e) =>
                  onMaxConcurrentRequestsChange(
                    toCount(e.target.value, maxConcurrentRequests),
                  )
                }
                placeholder={
                  defaults ? String(defaults.maxConcurrentRequests) : undefined
                }
                className="text-[13px]"
              />
              <p className="text-[11px] text-mut">
                Requests in flight at once, including streaming responses.
              </p>
            </div>

            <p className="rounded-lg border border-line bg-band/60 p-3 text-[11px] leading-relaxed text-mut">
              Limits are per deployment (one model) and apply to all request
              types on this endpoint. Leave a value at{" "}
              <span className="font-mono text-fg">0</span> to use the server
              defaults
              {defaults
                ? ` (currently ${defaults.requestsPerMinute} req/min, burst ${defaults.burstRequests}, ${defaults.maxConcurrentRequests} concurrent).`
                : " once loaded."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
