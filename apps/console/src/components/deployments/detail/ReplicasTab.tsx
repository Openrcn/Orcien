/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Square,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/Logos";
import { CopyButton } from "@/components/ui/CopyButton";
import { shortNodeId } from "@/components/deployments/node-detail/shared";
import { DetailCard } from "@/components/deployments/detail/DetailCard";
import { getDerivedDeploymentStatus } from "@/lib/deployment-status";
import { useOrgHref } from "@/lib/org";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

function timeAgo(iso?: string): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatUptime(iso?: string, live?: boolean): string {
  if (!live || !iso) return "--";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "--";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusDot(status?: string): string {
  const v = String(status || "").toUpperCase();
  if (["RUNNING", "READY", "HEALTHY"].includes(v)) return "bg-emerald-500";
  if (["PENDING", "SCALING", "PARTIAL"].includes(v)) return "bg-amber-500";
  if (["STOPPED", "FAILED", "ERROR"].includes(v)) return "bg-red-500";
  return "bg-gray-400";
}

function isLiveStatus(status?: string): boolean {
  return ["RUNNING", "READY", "HEALTHY"].includes(
    String(status || "").toUpperCase(),
  );
}

export function ReplicasTab({
  nodes = [],
  deployment,
  statusVariant,
}: {
  nodes: any[];
  deployment?: any;
  statusVariant?: any;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgHref = useOrgHref();
  const [nodeQuery, setNodeQuery] = useState("");
  const [nodeStatusFilter, setNodeStatusFilter] = useState(
    () => searchParams.get("status") ?? "all",
  );
  const isStopped =
    getDerivedDeploymentStatus(deployment, nodes) === "STOPPED";

  const writeParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const applyNodeStatus = (value: string) => {
    const normalized = String(value ?? "all").toUpperCase();
    setNodeStatusFilter(normalized);
    writeParam("status", normalized === "ALL" ? "all" : normalized.toLowerCase());
  };

  const nodeStatusValues = useMemo(() => {
    const unique = new Set<string>();
    nodes.forEach((n) =>
      unique.add(String(n.InfraStatus || "UNKNOWN").toUpperCase()),
    );
    return Array.from(unique).sort();
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    const q = nodeQuery.trim().toLowerCase();
    const status = nodeStatusFilter.toUpperCase();
    return nodes.filter((n) => {
      const matchesStatus =
        status === "ALL" ||
        String(n.InfraStatus || "UNKNOWN").toUpperCase() === status;
      const matchesQuery =
        !q ||
        String(n.ID || "").toLowerCase().includes(q) ||
        String(n.ProviderID || "").toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [nodes, nodeQuery, nodeStatusFilter]);

  /** Container count declared in the job spec — only shown when available */
  let containerCount = 0;
  try {
    const spec = deployment?.JobSpecJSON
      ? JSON.parse(deployment.JobSpecJSON)
      : null;
    containerCount = Array.isArray(spec?.containers) ? spec.containers.length : 0;
  } catch {
    containerCount = 0;
  }
  const hasContainerData = containerCount > 0;
  const gridCols = hasContainerData
    ? "grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]"
    : "grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]";

  return (
    <DetailCard
      title={`Nodes (${filteredNodes.length})`}
      subtitle="Registered node replicas serving this deployment"
      icon={<Server className="size-[15px]" strokeWidth={1.7} />}
      action={
        <div className="flex items-center gap-2">
          <label className="gb-f flex h-9 w-52 items-center gap-2 rounded-xl pl-3 pr-2.5 text-mut">
            <Search className="size-3.5" strokeWidth={1.7} />
            <input
              value={nodeQuery}
              onChange={(event) => setNodeQuery(event.target.value)}
              placeholder="Search nodes..."
              className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-mut"
            />
          </label>
          <Select
            value={
              nodeStatusFilter.toUpperCase() === "ALL"
                ? "all"
                : nodeStatusFilter.toUpperCase()
            }
            onValueChange={(nextValue: string) =>
              applyNodeStatus(String(nextValue ?? "all"))
            }
          >
            <SelectTrigger className="min-w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All statuses</SelectItem>
                {nodeStatusValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => {
              setNodeQuery("");
              applyNodeStatus("all");
            }}
            className="inline-grid size-9 place-items-center rounded-[10px] border border-line bg-card text-mut2 transition hover:bg-fg/[.04] hover:text-fg"
            title="Reset filters"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.7} />
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[1100px] divide-y divide-line">
            {filteredNodes.length === 0 ? (
              <div className="px-4 py-14 text-center text-xs text-mut2">
                {nodes.length === 0
                  ? "No nodes registered yet. Node capacity and health details will appear here as replicas scale."
                  : "No nodes match these filters."}
              </div>
            ) : (
              filteredNodes.map((node: any, idx: number) => {
                const nodeStatus = node.InfraStatus || "UNKNOWN";
                const badgeVariant = statusVariant
                  ? statusVariant(nodeStatus)
                  : "default";
                const live = isLiveStatus(node.InfraStatus);
                const created = node.CreatedAt
                  ? new Date(node.CreatedAt).toLocaleDateString()
                  : "-";
                const updatedAbsolute = node.UpdatedAt
                  ? new Date(node.UpdatedAt).toLocaleString()
                  : "-";

                return (
                  <div
                    key={node.ID || idx}
                    onClick={() =>
                      deployment?.ID &&
                      router.push(
                        orgHref(`/deployments/${deployment.ID}/nodes/${node.ID}`),
                      )
                    }
                    className={`grid cursor-pointer ${gridCols} items-start gap-6 px-5 py-6 transition-colors duration-200 hover:bg-field`}
                  >
                    {/* Node identity */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${statusDot(node.InfraStatus)}`}
                        />
                        <span className="truncate text-sm font-bold text-fg">
                          {shortNodeId(node.ID || `node-${idx + 1}`)}
                        </span>
                      </div>
                      <div
                        className="mt-2 flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate font-mono text-[11px] text-mut2">
                          {node.ID}
                        </span>
                        <CopyButton value={node.ID} size={12} />
                      </div>
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-field px-2 py-0.5 text-[11px] text-mut2">
                          {node.ProviderID ? (
                            <Logo name={node.ProviderID} size={12} />
                          ) : null}
                          <span className="capitalize">
                            {node.ProviderID || "unknown"}
                          </span>
                        </span>
                      </div>
                    </div>
                    {/* Instance / app */}
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-mut2">
                        Instance Type
                      </div>
                      <div className="mt-2 truncate text-sm font-bold text-fg">
                        {node.InstanceName ||
                          deployment?.InstanceName ||
                          deployment?.InstanceTypeID ||
                          "--"}
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] font-medium text-mut2">
                          App Status
                        </div>
                        <div className="mt-1.5">
                          <Badge
                            variant={
                              statusVariant
                                ? statusVariant(node.AppStatus || "UNKNOWN")
                                : "default"
                            }
                          >
                            {node.AppStatus || "UNKNOWN"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {/* Containers running */}
                    {hasContainerData ? (
                      <div
                        className="min-w-0"
                        title="Running containers from the job spec"
                      >
                        <div className="text-[11px] font-medium text-mut2">
                          Containers
                        </div>
                        <div className="mt-2 whitespace-nowrap text-sm font-bold text-fg">
                          {live
                            ? `${containerCount} / ${containerCount}`
                            : `0 / ${containerCount}`}
                        </div>
                        <div className="mt-3 text-[11px] text-mut">
                          {live ? "All running" : "Not running"}
                        </div>
                      </div>
                    ) : null}
                    {/* Infra status */}
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-mut2">
                        Infra Status
                      </div>
                      <div className="mt-2">
                        <Badge variant={badgeVariant}>{nodeStatus}</Badge>
                      </div>
                      <div className="mt-3 text-[11px] text-mut2">
                        Replica {idx + 1} of {filteredNodes.length}
                      </div>
                    </div>
                    {/* Uptime */}
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-mut2">
                        Uptime
                      </div>
                      <div className="mt-2 whitespace-nowrap text-sm font-bold text-fg">
                        {formatUptime(node.CreatedAt, live)}
                      </div>
                      <div className="mt-3 text-[11px] text-mut2">
                        {live ? "Running" : "Not running"}
                      </div>
                    </div>
                    {/* Heartbeat */}
                    <div className="min-w-0" title={updatedAbsolute}>
                      <div className="text-[11px] font-medium text-mut2">
                        Last Heartbeat
                      </div>
                      <div className="mt-2 whitespace-nowrap text-sm font-bold text-fg">
                        {timeAgo(node.UpdatedAt)}
                      </div>
                      <div className="mt-3 text-[11px] text-mut2">
                        {created}
                      </div>
                    </div>
                    {/* Actions */}
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          deployment?.ID &&
                          router.push(
                            orgHref(
                              `/deployments/${deployment.ID}/nodes/${node.ID}?tab=logs`,
                            ),
                          )
                        }
                        className="btn-pri inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-medium transition hover:brightness-110 active:translate-y-px"
                      >
                        <Terminal className="size-3.5" strokeWidth={1.7} />
                        Logs
                      </button>
                      {isStopped ? (
                        <button
                          type="button"
                          disabled
                          title="Coming soon — start this node individually"
                          className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3.5 text-[12.5px] text-mut2 transition hover:bg-fg/5 hover:text-fg disabled:pointer-events-none disabled:opacity-45"
                        >
                          <Play className="size-3.5" strokeWidth={1.7} />
                          Start
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled
                            title="Coming soon — restart this node"
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
                            title="Coming soon — stop this node"
                            className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-bad/45 px-3.5 text-[12.5px] text-bad transition hover:bg-bad/10 disabled:pointer-events-none disabled:opacity-45"
                          >
                            <Square className="size-3.5" strokeWidth={1.7} />
                            Stop
                          </button>
                        </>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-mut" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
    </DetailCard>
  );
}
