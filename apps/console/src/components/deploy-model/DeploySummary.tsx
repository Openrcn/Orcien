"use client";

import { useState } from "react";
import { Box, ChevronRight, Info, Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/Logos";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "cn";
import { K } from "@/components/providers/kit";
import { ComputeInstance } from "@/components/create/instance-utils";
import { ModelDetails } from "./model-types";
import {
  CONTEXT_KEYS,
  DTYPE_KEYS,
  resolveConfigNumber,
  resolveConfigString,
} from "./config-utils";

interface DeploySummaryProps {
  data: {
    name: string;
    model: string;
    modality: string;
    runtime: string;
    replicas: number;
    provider: string;
    provider_connection_name?: string;
    instance: ComputeInstance | null;
    timeout_minutes?: number;
    strategy?: string;
  };
  modelDetails: ModelDetails | null;
  taskLabel?: string;
  requiredVram: number;
  currentStep: number;
  onDeploy: () => void;
  isDeploying: boolean;
  onNext: () => void;
  canNext: boolean;
}

/* Right rail — original structure, kit tokens only */
export function DeploySummary({
  data,
  modelDetails,
  taskLabel,
  requiredVram,
  currentStep,
  onDeploy,
  isDeploying,
  onNext,
  canNext,
}: DeploySummaryProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const modelId = data.model;
  const modelName = modelId ? modelId.split("/").pop() : "";
  const modelOrg =
    modelDetails?.author || (modelId ? modelId.split("/")[0] : "");

  // Parameters
  const paramsCount = modelDetails?.safetensors?.total
    ? `${(modelDetails.safetensors.total / 1e9).toFixed(0)}B`
    : typeof modelDetails?.parameters === "number"
      ? `${modelDetails.parameters}B`
      : modelId.match(/(\d+)b/i)?.[1]
        ? `${modelId.match(/(\d+)b/i)?.[1]}B`
        : "-";

  // Context (falls back to text_config etc. for multimodal models)
  const contextValue = resolveConfigNumber(modelDetails?.config, CONTEXT_KEYS);
  const contextLength =
    contextValue !== undefined ? `${Math.round(contextValue / 1024)}K` : "-";

  // Dtype (falls back to text_config etc. for multimodal models)
  const dtype =
    resolveConfigString(modelDetails?.config, DTYPE_KEYS) ||
    (modelDetails?.safetensors?.parameters
      ? Object.keys(modelDetails.safetensors.parameters)[0]
      : modelDetails?.quantization) ||
    "-";

  // VRAM
  const estVram = `~${Math.ceil(requiredVram || 16)} GB`;

  // Button label
  const getButtonText = () => {
    if (currentStep === 1) return "Continue to Compute";
    if (currentStep === 2) return "Continue to Engine";
    if (currentStep === 3) return "Continue to Deployment";
    return "Continue to Review";
  };

  const isFinalStep = currentStep === 5;

  return (
    <aside className="sticky top-6 rounded-2xl border border-line bg-band p-1.5 [box-shadow:var(--sh)]">
      {/* Header */}
      <div className="px-3 pb-2.5 pt-2">
        <h3 className="text-[15px] font-semibold tracking-[-.01em]">
          Deployment Summary
        </h3>
        <p className="mt-0.5 text-[12px] text-mut">
          Configure your model, compute and deployment settings.
        </p>
      </div>

      <div className={K.inner}>
        <div className="divide-y divide-line">
          {/* Model Section */}
          <div className="p-4">
            <div className="mb-2.5 text-[12px] font-medium text-mut2">
              Model
            </div>

            {modelId ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-line bg-card p-1.5">
                    <Logo name={modelOrg} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[13px] font-medium text-fg"
                      title={modelName}
                    >
                      {modelName}
                    </div>
                    <div
                      className="truncate font-mono text-[10px] text-mut"
                      title={modelId}
                    >
                      {modelId}
                    </div>
                  </div>
                </div>

                {/* Badges */}
                {(taskLabel || data.runtime) && (
                  <div className="flex flex-wrap gap-1.5">
                    {taskLabel && <span className={K.pill}>{taskLabel}</span>}
                    {data.runtime && (
                      <span className={K.pill}>{data.runtime}</span>
                    )}
                  </div>
                )}

                {/* Rows */}
                <div className="space-y-2 pt-1 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-mut">Parameters</span>
                    <span className="font-medium text-fg">{paramsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mut">Context Length</span>
                    <span className="font-medium text-fg">{contextLength}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mut">Dtype</span>
                    <span className="font-medium capitalize text-fg">
                      {dtype}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mut">Est. VRAM</span>
                    <span className="font-medium text-fg">{estVram}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[12.5px] text-mut">No model selected</div>
            )}
          </div>

          {/* Compute Section */}
          <div className="p-4">
            <div className="mb-2.5 text-[12px] font-medium text-mut2">
              Compute
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line bg-card p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-line bg-band text-mut">
                  <Box className="size-4 text-mut2" strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-fg">
                    {data.instance ? data.instance.name : "Not selected"}
                  </div>
                  <div className="truncate text-[10px] text-mut">
                    {data.provider
                      ? data.provider.charAt(0).toUpperCase() +
                        data.provider.slice(1)
                      : "-"}
                    {data.instance?.vram_gb &&
                      ` • ${data.instance.vram_gb} GB VRAM`}
                    {data.provider_connection_name &&
                      ` • ${data.provider_connection_name}`}
                  </div>
                </div>
              </div>
              <ChevronRight
                className="size-4 shrink-0 text-mut2"
                strokeWidth={1.7}
              />
            </div>
          </div>

          {/* Deployment Section */}
          <div className="p-4">
            <div className="mb-2.5 text-[12px] font-medium text-mut2">
              Deployment
            </div>
            <div className="space-y-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-mut">Name</span>
                <span className="truncate font-medium text-fg">
                  {data.name || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mut">Replicas</span>
                <span className="font-medium text-fg">
                  {data.replicas || 1}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mut">Recovery Strategy</span>
                <span className="font-medium text-fg">
                  {data.strategy || "EXTEND"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mut">Estimated Cost</span>
                <span className="font-medium text-fg">
                  {data.instance ? `$${data.instance.price}/h` : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Endpoint Section */}
          <div className="p-4">
            <div className="mb-1 text-[12px] font-medium text-mut2">
              Endpoint
            </div>
            <div className="mb-2.5 flex items-center gap-1 text-[11px] text-mut">
              <span>Generated after deployment</span>
              <Info className="size-3 text-mut" strokeWidth={1.7} />
            </div>
            <div className="flex h-9 items-center rounded-xl border border-line bg-card px-3 font-mono text-[11.5px] text-mut">
              {data.name ? `${data.name}.orcn.network` : "-"}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="border-t border-line p-3.5">
          {isFinalStep ? (
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isDeploying || !canNext}
              className="w-full"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.7} />
                  <span>Deploying...</span>
                </>
              ) : (
                <span>Deploy AI Model</span>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={onNext}
              disabled={!canNext}
              className="w-full"
            >
              {getButtonText()}
            </Button>
          )}
        </div>
      </div>

      {/* Launch Confirmation */}
      <Dialog open={confirmOpen} onOpenChange={(open: boolean) => setConfirmOpen(open)}>
        <DialogContent className="rounded-2xl border border-line2 bg-card p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px]">Launch deployment?</DialogTitle>
            <DialogDescription className="text-[13px] text-mut2">
              Nodes will be provisioned on the provider network and your
              endpoint allocated. Billing starts as soon as the instance is up.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl border border-line bg-band">
            <div className={cn(K.kv, "text-[12.5px]")}>
              <span className="flex-1 text-mut">Model</span>
              <span className="max-w-[220px] truncate font-medium text-fg">
                {data.model || "-"}
              </span>
            </div>
            <div className={cn(K.kv, "text-[12.5px]")}>
              <span className="flex-1 text-mut">Compute</span>
              <span className="font-medium text-fg">
                {data.instance ? data.instance.name : "-"}
                {data.instance?.vram_gb ? ` • ${data.instance.vram_gb} GB` : ""}
              </span>
            </div>
            <div className={cn(K.kv, "text-[12.5px]")}>
              <span className="flex-1 text-mut">Replicas</span>
              <span className="font-medium text-fg">{data.replicas || 1}</span>
            </div>
            <div className={cn(K.kv, "text-[12.5px]")}>
              <span className="flex-1 text-mut">Est. Cost</span>
              <span className="font-medium text-fg">
                {data.instance ? `$${data.instance.price}/h` : "-"}
              </span>
            </div>
          </div>
          <DialogFooter className="border-line bg-transparent">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                onDeploy();
              }}
              disabled={isDeploying || !canNext}
            >
              {isDeploying ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.7} />
                  <span>Launching...</span>
                </>
              ) : (
                <span>Launch now</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
