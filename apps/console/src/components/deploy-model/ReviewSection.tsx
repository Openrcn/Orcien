"use client";

import { AlertCircle, Check, Copy, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { K } from "@/components/providers/kit";
import { ComputeInstance } from "@/components/create/instance-utils";
import { ModelDetails } from "./model-types";

interface ReviewSectionProps {
  data: {
    name: string;
    model: string;
    modality: string;
    runtime: string;
    replicas: number;
    strategy: string;
    timeout_minutes: number;
    api_key: string;
    hf_token: string;
    provider: string;
    provider_connection_name: string;
    instance: ComputeInstance | null;
    volume_size_gb: number;
    provider_config: Record<string, string>;
    requests_per_minute?: number;
    burst_requests?: number;
    max_concurrent_requests?: number;
  };
  modelDetails: ModelDetails | null;
  taskLabel?: string;
  requiredVram: number;
  deployPayloadJson?: string;
}

/* Step 5 — preflight checks + a plain read-back of every choice */
export function ReviewSection({
  data,
  modelDetails,
  taskLabel,
  requiredVram,
  deployPayloadJson,
}: ReviewSectionProps) {
  const [copied, setCopied] = useState(false);
  const modelId = data.model;
  const modelName = modelId ? modelId.split("/").pop() : "";

  const checks = [
    {
      label: "Model selected",
      ok: Boolean(modelId),
      hint: modelName || "Pick a model",
    },
    {
      label: "GPU fits model memory",
      ok:
        !data.instance ||
        data.instance.vram_gb === undefined ||
        data.instance.vram_gb >= requiredVram,
      hint: data.instance?.vram_gb
        ? `~${Math.ceil(requiredVram)} GB of ${data.instance.vram_gb} GB`
        : "No GPU selected",
    },
    {
      label: "Provider account selected",
      ok: Boolean(data.provider_connection_name),
      hint: data.provider_connection_name || "Select a connection",
    },
    {
      label: "Gated model access",
      ok: !modelDetails?.gated || Boolean(data.hf_token),
      hint: modelDetails?.gated
        ? data.hf_token
          ? "Token provided"
          : "Token required"
        : "Public model",
    },
    {
      label: "Deployment name set",
      ok: Boolean(data.name),
      hint: data.name || "Set a deployment name",
    },
    {
      label: "Replica count valid",
      ok: data.replicas >= 1,
      hint: `${data.replicas} replica${data.replicas !== 1 ? "s" : ""}`,
    },
  ];

  const failing = checks.filter((c) => !c.ok);

  return (
    <div className="space-y-6">
      {/* Preflight checks */}
      <section className={K.dbx}>
        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
          <ShieldCheck className="size-4 text-accent-t" strokeWidth={1.7} />
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            Preflight checks
          </h3>
          <span className={cn("ml-auto", failing.length ? K.warn : K.ok)}>
            <i className="size-1.5 rounded-full bg-current" />
            {failing.length
              ? `${failing.length} issue${failing.length > 1 ? "s" : ""}`
              : "All clear"}
          </span>
        </div>
        <div className={K.inner}>
          {checks.map((check) => (
            <div key={check.label} className={K.kv}>
              {check.ok ? (
                <Check className="size-4 flex-none text-ok" strokeWidth={2} />
              ) : (
                <AlertCircle
                  className="size-4 flex-none text-bad"
                  strokeWidth={1.7}
                />
              )}
              <span className="flex-1">{check.label}</span>
              <span className="text-[12px] text-mut">{check.hint}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Model */}
      <section className={K.dbx}>
        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">Model</h3>
        </div>
        <div className={K.inner}>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Model</span>
            <b className="truncate font-mono text-[12.5px] font-medium">
              {modelId || "—"}
            </b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Modality</span>
            <b className="font-medium">{taskLabel || data.modality || "—"}</b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Runtime</span>
            <b className="font-medium">{data.runtime || "—"}</b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Est. VRAM</span>
            <b className="font-medium">~{Math.ceil(requiredVram || 16)} GB</b>
          </div>
        </div>
      </section>

      {/* Compute */}
      <section className={K.dbx}>
        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            Compute
          </h3>
        </div>
        <div className={K.inner}>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Provider</span>
            <b className="font-medium">{data.provider || "—"}</b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Account</span>
            <b className="font-medium">{data.provider_connection_name || "—"}</b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">GPU</span>
            <b className="truncate font-medium">{data.instance?.name || "—"}</b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Price</span>
            <b className="font-medium">
              {data.instance?.price !== undefined
                ? `$${data.instance.price}/hr`
                : "—"}
            </b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Volume</span>
            <b className="font-medium">{data.volume_size_gb} GB</b>
          </div>
        </div>
      </section>

      {/* Deployment */}
      <section className={K.dbx}>
        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            Deployment
          </h3>
        </div>
        <div className={K.inner}>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Name</span>
            <b className="truncate font-mono text-[12.5px] font-medium">
              {data.name || "—"}
            </b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Replicas</span>
            <b className="font-medium">{data.replicas}</b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Strategy</span>
            <b className="font-medium">{data.strategy}</b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Timeout</span>
            <b className="font-medium">
              {data.timeout_minutes === 0
                ? "Unlimited"
                : `${data.timeout_minutes} min`}
            </b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">API protection</span>
            <b className="font-medium">
              {data.api_key ? "Enabled" : "Disabled"}
            </b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Requests / min</span>
            <b className="font-medium">
              {data.requests_per_minute || "Server default"}
            </b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Burst requests</span>
            <b className="font-medium">
              {data.burst_requests || "Server default"}
            </b>
          </div>
          <div className={K.kv}>
            <span className="flex-1 text-mut2">Max concurrent</span>
            <b className="font-medium">
              {data.max_concurrent_requests || "Server default"}
            </b>
          </div>
        </div>
      </section>

      {/* Deploy payload — exact JSON the backend will receive */}
      {deployPayloadJson && (
        <section className={K.dbx}>
          <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
            <h3 className="text-[15px] font-semibold tracking-[-.01em]">
              Deploy payload
            </h3>
            <span className="text-[12px] text-mut">JSON · tokens masked</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(deployPayloadJson);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                copied
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                  : "border-line bg-band text-mut hover:text-fg",
              )}
            >
              <Copy className="size-3" strokeWidth={1.7} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className={K.inner}>
            <pre className="max-h-[320px] overflow-auto bg-band/60 p-3 font-mono text-[11.5px] leading-relaxed text-fg">
              {deployPayloadJson}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
