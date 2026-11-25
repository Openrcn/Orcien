"use client";

import { useState } from "react";
import { Clock, RotateCcw, Shield, Sparkles } from "lucide-react";
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
import { useOrg } from "@/lib/org";
import { deploymentUrl } from "@/lib/public-url";

interface DeployConfigSectionProps {
  name: string;
  onNameChange: (val: string) => void;
  replicas: number;
  onReplicasChange: (val: number) => void;
  strategy: string;
  onStrategyChange: (val: string) => void;
  timeoutMinutes: number;
  onTimeoutMinutesChange: (val: number) => void;
  apiKey: string;
  onApiKeyChange: (val: string) => void;
  gated: boolean;
  hfToken: string;
  onHfTokenChange: (token: string) => void;
}

/* Deployment step: each concern is its own card, all important ones open. */
export function DeployConfigSection({
  name,
  onNameChange,
  replicas,
  onReplicasChange,
  strategy,
  onStrategyChange,
  timeoutMinutes,
  onTimeoutMinutesChange,
  apiKey,
  onApiKeyChange,
  gated,
  hfToken,
  onHfTokenChange,
}: DeployConfigSectionProps) {
  const [requireAuth, setRequireAuth] = useState(!!apiKey);
  const { slug: orgSlug } = useOrg();

  const handleGenerateName = () => {
    const rand = Math.random().toString(36).substring(2, 6);
    onNameChange(`deploy-${rand}`);
  };

  return (
    <div className="space-y-6">
      {/* Identity */}
      <section className={K.dbx}>
        <div className="px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            Identity
          </h3>
          <p className="mt-0.5 text-[12px] text-mut">
            Name and endpoint prefix for this deployment.
          </p>
        </div>
        <div className={K.inner}>
          <div className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-mut2">
                Deployment name <span className="text-bad">*</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateName}
                className="flex items-center gap-1 text-[11px] font-medium text-accent-t transition hover:brightness-110"
              >
                <Sparkles className="size-3" strokeWidth={1.7} />
                Generate random
              </button>
            </div>
            <Input
              value={name}
              onChange={(e) =>
                onNameChange(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
              placeholder="e.g. llama-3-1-8b-instruct-vllm"
              className="font-mono text-[13px]"
            />
            <p className="text-[11px] text-mut">
              Lowercase letters, numbers and dashes. Becomes{" "}
              <span className="font-mono">
                {deploymentUrl(name || "name", orgSlug)}
              </span>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Scaling */}
      <section className={K.dbx}>
        <div className="px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            Scaling
          </h3>
          <p className="mt-0.5 text-[12px] text-mut">
            How many instances run behind this endpoint.
          </p>
        </div>
        <div className={K.inner}>
          <div className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-mut2">
                Replicas
              </label>
              <span className="text-[11px] text-mut">
                {replicas} replica{replicas !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onReplicasChange(Math.max(1, replicas - 1))}
                disabled={replicas <= 1}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-[14px] text-mut transition hover:bg-fg/5",
                  replicas <= 1 && "cursor-not-allowed opacity-45",
                )}
              >
                –
              </button>
              <span className="w-10 text-center text-[13px] font-medium text-fg">
                {replicas}
              </span>
              <button
                type="button"
                onClick={() => onReplicasChange(replicas + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-[14px] text-mut transition hover:bg-fg/5"
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-mut">
              Each replica uses the selected GPU instance.
            </p>
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <section className={K.dbx}>
        <div className="px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            Lifecycle
          </h3>
          <p className="mt-0.5 text-[12px] text-mut">
            Restart behaviour and lease duration.
          </p>
        </div>
        <div className={K.inner}>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[12px] font-medium text-mut2">
                <RotateCcw className="size-3.5 text-mut2" strokeWidth={1.7} />
                Restart & recovery
              </div>
              <Select
                value={strategy}
                onValueChange={(val: string | null) =>
                  val && onStrategyChange(val)
                }
              >
                <SelectTrigger className="w-full text-[13px] data-[size=default]:h-11">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXTEND">
                    Extend lease (recommended)
                  </SelectItem>
                  <SelectItem value="RESTART">
                    Restart on node failure
                  </SelectItem>
                  <SelectItem value="MANUAL">Manual control only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-mut">
                Fixed replicas, no cold starts. Best for production.
              </p>
            </div>

            <div className="space-y-1.5 border-t border-line pt-4">
              <div className="flex items-center gap-2 text-[12px] font-medium text-mut2">
                <Clock className="size-3.5 text-mut2" strokeWidth={1.7} />
                Execution lease timeout
              </div>
              <Select
                value={String(timeoutMinutes)}
                onValueChange={(val: string | null) =>
                  val && onTimeoutMinutesChange(parseInt(val, 10))
                }
              >
                <SelectTrigger className="w-full text-[13px] data-[size=default]:h-11">
                  <SelectValue placeholder="Timeout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="720">12 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                  <SelectItem value="0">
                    Unlimited / manual termination
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-mut">
                Spin down nodes after this duration to prevent unexpected
                compute costs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Model access — only for gated models */}
      {gated && (
        <section className={K.dbx}>
          <div className="px-3 pb-2.5 pt-3">
            <h3 className="text-[15px] font-semibold tracking-[-.01em]">
              Model access
            </h3>
            <p className="mt-0.5 text-[12px] text-mut">
              This model is gated on Hugging Face.
            </p>
          </div>
          <div className={K.inner}>
            <div className="space-y-1.5 p-4">
              <div className="flex items-center gap-2">
                <Shield className="size-3.5 text-warn" strokeWidth={1.7} />
                <label className="text-[12px] font-medium text-mut2">
                  Hugging Face token <span className="text-bad">required</span>
                </label>
              </div>
              <Input
                type="password"
                value={hfToken}
                onChange={(e) => onHfTokenChange(e.target.value)}
                placeholder="hf_…"
                className="font-mono text-[13px]"
              />
              <p className="text-[11px] text-mut">
                Used once at deploy time to download model weights.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* API access */}
      <section className={K.dbx}>
        <div className="px-3 pb-2.5 pt-3">
          <h3 className="text-[15px] font-semibold tracking-[-.01em]">
            API access
          </h3>
          <p className="mt-0.5 text-[12px] text-mut">
            Protect the deployed endpoint with a key.
          </p>
        </div>
        <div className={K.inner}>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="size-3.5 text-mut2" strokeWidth={1.7} />
                <label className="text-[12px] font-medium text-mut2">
                  Endpoint API key
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={requireAuth}
                  onClick={() => {
                    const next = !requireAuth;
                    setRequireAuth(next);
                    if (!next) onApiKeyChange("");
                  }}
                  className={cn(
                    "relative h-5 w-9 flex-none rounded-full border transition",
                    requireAuth
                      ? "border-accent bg-accent"
                      : "border-line2 bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white transition-all",
                      requireAuth ? "left-[18px]" : "left-[3px]",
                    )}
                  />
                </button>
                <span className="text-[12px] font-medium text-mut2">
                  Require a key
                </span>
              </div>
            </div>
            {requireAuth && (
              <Input
                type="text"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="Auto-generated on deploy"
                className="font-mono text-[13px]"
              />
            )}
            <p className="text-[11px] text-mut">
              {requireAuth
                ? "Keys are generated on deploy and shown once. Per-key limits can be tuned later in the gateway."
                : "The endpoint will be publicly reachable without a key."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
