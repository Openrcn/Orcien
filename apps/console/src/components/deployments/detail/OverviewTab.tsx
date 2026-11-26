/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  ExternalLink,
  Globe,
  Network,
  Server,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoRow } from "@/components/deployments/detail/InfoRow";
import { DetailCard } from "@/components/deployments/detail/DetailCard";
import { Logo, getLogoCategory } from "@/components/ui/Logos";
import { CopyButton } from "@/components/ui/CopyButton";
import { K } from "@/components/providers/kit";
import { getDerivedDeploymentStatus } from "@/lib/deployment-status";
import { useOrgHref } from "@/lib/org";
import { apiFetch } from "@/lib/api";
import { routeUrl } from "@/lib/public-url";
import type { ProviderConnection } from "@/components/providers/api";

type OverviewTabProps = {
  deployment: any;
  nodes: any[];
  onOpenTab: (tab: string) => void;
  statusVariant: (
    status: string,
  ) => "default" | "success" | "warning" | "error";
};

function MetricTile({
  label,
  value,
  meta,
  hint,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  meta: string;
  hint: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-line bg-card p-3.5 text-left [box-shadow:var(--sh)] transition hover:border-line2 hover:bg-field"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-mut">
          {label}
        </span>
        <span className="grid size-6 place-items-center rounded-lg border border-line bg-band text-mut2 transition group-hover:text-fg">
          <Icon className="size-3.5" strokeWidth={1.7} />
        </span>
      </div>
      <div className="mt-2.5 text-[22px] font-semibold leading-none tracking-[-.02em] text-fg">
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-mut">{meta}</div>
      <div className="mt-2.5 flex items-center gap-1 border-t border-line pt-2 text-[11px] font-medium text-mut2 transition group-hover:text-accent-t">
        {hint}
        <ArrowUpRight className="size-3" strokeWidth={1.7} />
      </div>
    </button>
  );
}

type SpecPort = { port: number; protocol: string; isPublic: boolean };

/** Ports declared by the job spec (expose), deduped across containers */
function buildSpecPorts(deployment: any): SpecPort[] {
  let containers: any[] = [];
  try {
    const spec = deployment.JobSpecJSON
      ? JSON.parse(deployment.JobSpecJSON)
      : null;
    containers = spec?.containers || [];
  } catch {
    return [];
  }

  const seen = new Set<number>();
  const ports: SpecPort[] = [];
  for (const c of containers) {
    for (const p of c?.args?.expose || []) {
      const port = Number(p?.port);
      if (!Number.isFinite(port) || port <= 0 || seen.has(port)) continue;
      seen.add(port);
      ports.push({
        port,
        protocol: (p.protocol || "http").toLowerCase(),
        isPublic: Boolean(p.is_public),
      });
    }
  }
  return ports.sort((a, b) => a.port - b.port);
}

export function OverviewTab({
  deployment,
  nodes,
  onOpenTab,
  statusVariant,
}: OverviewTabProps) {
  const orgHref = useOrgHref();
  const createdAt = deployment.CreatedAt
    ? new Date(deployment.CreatedAt).toLocaleString()
    : "-";
  const healthyNodes = nodes.filter((node) =>
    ["READY", "RUNNING", "HEALTHY"].includes(
      String(node.InfraStatus).toUpperCase(),
    ),
  ).length;
  const providerName = deployment.ProviderID || "-";
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const connectionID = String(deployment.ProviderConnectionID || "");
  const connectionName = connections.find((c) => c.ID === connectionID)?.Name;

  // The deployment stores the connection ID, not its display name.
  useEffect(() => {
    if (!connectionID) return;
    let cancelled = false;
    apiFetch("/api/v1/provider-connections")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: ProviderConnection[]) => {
        if (!cancelled && Array.isArray(list)) setConnections(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [connectionID]);

  const runtimeName = deployment.RuntimeID || "";
  const runtimeHasLogo =
    runtimeName && getLogoCategory(runtimeName) !== "unknown";

  const specPorts = buildSpecPorts(deployment);
  const baseUrl = String(
    deployment.GatewayURL || deployment.Endpoint || deployment.URL || "",
  ).replace(/\/+$/, "");
  const routeKey = String(deployment.RouteKey || "").trim();
  const slug = String(deployment.Name || deployment.ID || "deployment")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  /** Reserved gateway URL for a port: ingress routeKey URL, or base URL + port */
  const reservedUrl = (port: number) => {
    if (baseUrl) return `${baseUrl.replace(/:\d+$/, "")}:${port}`;
    if (routeKey) return routeUrl(routeKey);
    return routeUrl(slug);
  };
  const publicCount = specPorts.filter((p) => p.isPublic).length;
  const derivedStatus = getDerivedDeploymentStatus(deployment, nodes);
  const isRunning = ["RUNNING", "READY"].includes(derivedStatus);

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Replicas"
          value={nodes.length ? String(healthyNodes) : "--"}
          meta={nodes.length ? `Healthy of ${nodes.length}` : "No nodes yet"}
          hint="View nodes"
          icon={Server}
          onClick={() => onOpenTab("replicas")}
        />
        <MetricTile
          label="Ports"
          value={specPorts.length ? String(specPorts.length) : "--"}
          meta={specPorts.length ? "Exposed in spec" : "No ports declared"}
          hint="View configuration"
          icon={Network}
          onClick={() => onOpenTab("configuration")}
        />
        <MetricTile
          label="Healthy Replicas"
          value={nodes.length ? `${healthyNodes} / ${nodes.length}` : "--"}
          meta="Replica health"
          hint="View nodes"
          icon={Boxes}
          onClick={() => onOpenTab("replicas")}
        />
        <MetricTile
          label="API Access"
          value="Ready"
          meta="OpenAI-compatible"
          hint="View API"
          icon={Globe}
          onClick={() => onOpenTab("api")}
        />
      </div>

      {/* Details */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <DetailCard
          title="Deployment information"
          subtitle="Identity and specification"
          icon={<Boxes className="size-[15px]" strokeWidth={1.7} />}
        >
          <InfoRow
            label="Deployment name"
            value={deployment.Name}
            highlight
            copyable
          />
          <InfoRow
            label="Deployment ID"
            value={deployment.ID}
            monospace
            copyable
          />
          <InfoRow
            label="Status"
            value={
              <Badge variant={statusVariant(derivedStatus)}>
                {derivedStatus}
              </Badge>
            }
          />
          <InfoRow
            label="Workload"
            value={deployment.WorkloadType || "model_inference"}
          />
          {deployment.Task ? (
            <InfoRow label="Task" value={deployment.Task} />
          ) : null}
          <InfoRow
            label="Model ID"
            value={deployment.ModelID || "-"}
            copyable
          />
          <InfoRow
            label="Provider"
            value={
              <div className="flex items-center gap-2">
                {deployment.ProviderID && (
                  <Logo name={providerName} size={15} />
                )}
                <span className="capitalize">{providerName}</span>
                {connectionName && (
                  <span className="text-mut">({connectionName})</span>
                )}
              </div>
            }
          />
          <InfoRow
            label="Runtime"
            value={
              <div className="flex items-center gap-2">
                {runtimeHasLogo && <Logo name={runtimeName} size={14} />}
                <span>{runtimeName || "-"}</span>
              </div>
            }
          />
          <InfoRow
            label={
              providerName.toLowerCase() === "local"
                ? "Machine (agent)"
                : "Instance Type"
            }
            value={deployment.InstanceName || "-"}
            copyable
          />
          <InfoRow label="Created at" value={createdAt} />
        </DetailCard>

        <div className="space-y-5">
          <DetailCard
            title="Active nodes"
            subtitle="Assigned replicas"
            icon={<Server className="size-[15px]" strokeWidth={1.7} />}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenTab("replicas")}
              >
                View all
              </Button>
            }
          >
            {nodes.length === 0 ? (
              <div className="m-3 rounded-xl border border-dashed border-line2 px-3 py-5 text-center text-[12px] text-mut">
                Nodes will appear when registered.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {nodes.slice(0, 8).map((node: any) => (
                  <div
                    key={node.ID}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-fg/[.03]"
                  >
                    <div className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-fg">
                      <span
                        className={[
                          "size-1.5 shrink-0 rounded-full",
                          statusVariant(node.InfraStatus || "UNKNOWN") ===
                          "success"
                            ? "bg-ok"
                            : statusVariant(node.InfraStatus || "UNKNOWN") ===
                                "warning"
                              ? "bg-warn"
                              : statusVariant(node.InfraStatus || "UNKNOWN") ===
                                  "error"
                                ? "bg-bad"
                                : "bg-mut",
                        ].join(" ")}
                      />
                      <Logo
                        name={
                          node.ProviderID || deployment.ProviderID || "nosana"
                        }
                        size={13}
                      />
                      <span className="text-mut">:</span>
                      <span className="truncate">{node.ID}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <CopyButton value={node.ID} size={12} />
                      <Link
                        href={orgHref(
                          `/deployments/${deployment.ID}/nodes/${node.ID}`,
                        )}
                        className="rounded-md p-1 text-mut transition hover:bg-fg/[.05] hover:text-fg"
                        title="Open node details"
                      >
                        <ArrowUpRight className="size-3.5" strokeWidth={1.7} />
                      </Link>
                    </div>
                  </div>
                ))}
                {nodes.length > 8 && (
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-[11.5px] font-medium text-accent-t transition hover:bg-fg/[.03]"
                  >
                    +{nodes.length - 8} more
                  </button>
                )}
              </div>
            )}
          </DetailCard>

          <DetailCard
            title="Endpoints"
            subtitle="Reserved URL for each declared port"
            icon={<Globe className="size-[15px]" strokeWidth={1.7} />}
            action={
              isRunning ? (
                <span className={K.pill}>
                  {publicCount > 0
                    ? `${publicCount} public`
                    : "No public ports"}
                </span>
              ) : (
                <span className={K.warn}>
                  Inactive · {deployment.Status || "stopped"}
                </span>
              )
            }
          >
            {specPorts.length > 0 ? (
              <div className="divide-y divide-line">
                {specPorts.map((p) => {
                  const url = reservedUrl(p.port);
                  return (
                    <div
                      key={p.port}
                      className={
                        "flex items-center justify-between gap-3 px-4 py-2.5 " +
                        (isRunning ? "" : "opacity-50")
                      }
                    >
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={[
                            "size-1.5 rounded-full",
                            isRunning ? "bg-ok" : "bg-mut",
                          ].join(" ")}
                        />
                        <span className="font-mono text-[11.5px] font-medium text-fg">
                          :{p.port}
                        </span>
                        <span className="text-[10px] uppercase text-mut">
                          {p.protocol}
                        </span>
                        <span
                          className={
                            p.isPublic
                              ? K.ok
                              : "rounded-full border border-line bg-band px-2 py-0.5 text-[10px] font-medium text-mut2"
                          }
                        >
                          {p.isPublic ? "public" : "internal"}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="truncate font-mono text-[11px] text-mut2"
                          title={url}
                        >
                          {url}
                        </span>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="shrink-0 rounded-md p-1 text-mut transition hover:bg-fg/[.05] hover:text-fg"
                          title={`Open :${p.port}`}
                        >
                          <ExternalLink className="size-3" strokeWidth={1.7} />
                        </a>
                        <CopyButton value={url} size={12} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="m-3 rounded-xl border border-dashed border-line2 px-3 py-4 text-center text-[11.5px] text-mut">
                No ports declared in the job spec yet.
              </div>
            )}
          </DetailCard>

          <DetailCard
            title="Requests"
            subtitle="Inference request activity"
            icon={<Network className="size-[15px]" strokeWidth={1.7} />}
            action={<span className={K.off}>Coming soon</span>}
          >
            <div className="m-3 grid gap-2 sm:grid-cols-3">
              {[
                ["Requests / min", "--"],
                ["p95 latency", "--"],
                ["Error rate", "--"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-line bg-band px-3 py-2.5"
                >
                  <div className="text-[10.5px] font-medium uppercase tracking-wider text-mut">
                    {label}
                  </div>
                  <div className="mt-1 text-[16px] font-semibold text-fg">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div className="mx-3 mb-3 rounded-xl border border-dashed border-line2 bg-field px-3 py-4 text-center text-[11.5px] text-mut">
              Live request metrics, rate-limit usage and cost roll-ups for this
              deployment will appear here.
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
}
