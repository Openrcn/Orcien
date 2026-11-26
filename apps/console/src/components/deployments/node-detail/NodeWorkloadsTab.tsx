/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Boxes,
  Cpu,
  Database,
  RotateCcw,
  Server,
  Square,
  Terminal,
} from "lucide-react";
import { SectionCard, StatusPill } from "@/components/deployments/node-detail/shared";

type Props = {
  deployment: any;
  node: any;
  onOpenTab: (tab: string, opts?: { container?: string }) => void;
};

export function NodeWorkloadsTab({ deployment, node, onOpenTab }: Props) {
  let containers: any[] = [];
  try {
    const spec = deployment.JobSpecJSON
      ? JSON.parse(deployment.JobSpecJSON)
      : null;
    containers = Array.isArray(spec?.containers) ? spec.containers : [];
  } catch {
    containers = [];
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={`Running Workloads (${containers.length || 0})`}
        subtitle="Container operations run inside this node"
        action={
          containers.length > 0 ? (
            <span className="inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-[9px] text-[11.5px] text-mut2">
              <Boxes className="size-3" strokeWidth={1.7} />
              {containers.length} {containers.length === 1 ? "container" : "containers"}
            </span>
          ) : (
            <Boxes className="size-4 text-mut2" />
          )
        }
      >
        {containers.length === 0 ? (
          <div className="m-3 rounded-xl border border-dashed border-line2 px-3 py-8 text-center">
            <Server className="mx-auto size-5 text-mut2 opacity-40" />
            <p className="mt-2 text-xs font-medium text-mut2">
              No containers in job spec
            </p>
            <p className="mt-1 text-[10px] text-mut2 opacity-70">
              Workload rows populate from the deployment job definition.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[880px] divide-y divide-line">
              {containers.map((c: any, idx: number) => {
                const cid = c.id || `container-${idx + 1}`;
                const image = c.args?.image || "-";
                const gpu = Boolean(c.args?.gpu);
                return (
                  <div
                    key={cid}
                    className="grid grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.95fr)_auto] items-start gap-6 px-5 py-6 transition-colors duration-200 hover:bg-field"
                  >
                    {/* Container identity */}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-fg">
                        {c.name || cid}
                      </div>
                      <div className="mt-1.5 truncate font-mono text-[11px] text-mut2">
                        {image}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-mut2">
                        Status
                      </div>
                      <div className="mt-2">
                        <StatusPill
                          status={node.AppStatus || node.InfraStatus}
                        />
                      </div>
                    </div>

                    {/* GPU */}
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-mut2">
                        GPU
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-fg">
                        <Cpu
                          className="size-3.5 text-mut2"
                          strokeWidth={1.7}
                        />
                        {gpu ? "Enabled" : "--"}
                      </div>
                    </div>

                    {/* Memory */}
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-mut2">
                        Memory
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-fg">
                        <Database
                          className="size-3.5 text-mut2"
                          strokeWidth={1.7}
                        />--
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenTab("logs", { container: cid })
                        }
                        className="btn-pri inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-medium transition hover:brightness-110 active:translate-y-px"
                      >
                        <Terminal
                          className="size-3.5"
                          strokeWidth={1.7}
                        />
                        Logs
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Coming soon"
                        className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3.5 text-[12.5px] text-mut2 transition hover:bg-fg/5 hover:text-fg disabled:pointer-events-none disabled:opacity-45"
                      >
                        <RotateCcw
                          className="size-3.5"
                          strokeWidth={1.7}
                        />
                        Restart
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Coming soon"
                        className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-bad/45 px-3.5 text-[12.5px] text-bad transition hover:bg-bad/10 disabled:pointer-events-none disabled:opacity-45"
                      >
                        <Square
                          className="size-3.5"
                          strokeWidth={1.7}
                        />
                        Stop
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {containers.length > 0 && (
          <p className="border-t border-line px-5 py-2.5 text-[11px] text-mut">
            Restart / stop target the container on this node only — the node
            itself is never affected.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
