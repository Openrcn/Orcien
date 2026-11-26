/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Activity,
  Boxes,
  Clock,
  Cpu,
  ExternalLink,
  Link2,
  MemoryStick,
  Radio,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Logo } from "@/components/ui/Logos";
import { InfoRow } from "@/components/deployments/detail/InfoRow";
import {
  FakeGraph,
  MetricTile,
  SectionCard,
  StatusPill,
  shortNodeId,
} from "@/components/deployments/node-detail/shared";
import { routeUrl } from "@/lib/public-url";
type NodeOverviewTabProps = {
  deployment: any;
  node: any;
  onOpenTab: (tab: string) => void;
};

type NodeEndpoint = {
  port: number | string;
  protocol: string;
  url: string;
  subdomain?: string;
};

function buildEndpoints(deployment: any, node: any): NodeEndpoint[] {
  const out: NodeEndpoint[] = [];
  const seenPorts = new Set<string>();

  const scheme =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "https"
      : "http";
  const routeKey = String(deployment.RouteKey || "").trim();
  const nodeSlug = shortNodeId(node.ID).toLowerCase();

  const proxyUrlFor = (port: number | string, customSubdomain?: string) => {
    let sub = customSubdomain ? String(customSubdomain).toLowerCase() : "";
    if (!sub || (routeKey && !sub.endsWith(`.${routeKey.toLowerCase()}`))) {
      const base =
        port !== "-" && Number(port) > 0 ? `${nodeSlug}-${port}` : nodeSlug;
      sub = routeKey ? `${base}.${routeKey}` : base;
    }
    return {
      subdomain: sub,
      url: routeUrl(sub),
    };
  };

  const fromDeployment = (deployment.Endpoints || []).filter(
    (e: any) => e.type === "node" && e.node_id === node.ID,
  );
  for (const ep of fromDeployment) {
    // Skip duplicate primary alias if we already have the explicit port entry
    if (String(ep.id || "").endsWith("-primary") && seenPorts.has(String(ep.target_port ?? ep.port ?? "-"))) {
      continue;
    }
    const port = ep.target_port ?? ep.port ?? "-";
    const key = String(port);
    if (seenPorts.has(key)) continue;
    seenPorts.add(key);

    const { subdomain, url } = proxyUrlFor(port, ep.subdomain);
    out.push({
      port,
      protocol: scheme,
      subdomain,
      url,
    });
  }

  if (node.EndpointsJSON) {
    try {
      const parsed = JSON.parse(node.EndpointsJSON);
      if (Array.isArray(parsed)) {
        for (const e of parsed) {
          const port = e?.port ?? "-";
          const key = String(port);
          if (seenPorts.has(key)) continue;
          seenPorts.add(key);

          const { subdomain, url } = proxyUrlFor(port);
          out.push({
            port,
            protocol: scheme,
            subdomain,
            url,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (out.length === 0) {
    const { subdomain, url } = proxyUrlFor("-");
    out.push({ port: "-", protocol: scheme, subdomain, url });
  }

  return out;
}

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

export function NodeOverviewTab({
  deployment,
  node,
  onOpenTab,
}: NodeOverviewTabProps) {
  const createdAt = node.CreatedAt
    ? new Date(node.CreatedAt).toLocaleString()
    : "-";
  const updatedAt = node.UpdatedAt
    ? new Date(node.UpdatedAt).toLocaleString()
    : "-";
  const provider = node.ProviderID || deployment.ProviderID || "-";
  const endpoints = buildEndpoints(deployment, node);
  const shortId = shortNodeId(node.ID);

  let containers: { id: string; name: string; image: string }[] = [];
  try {
    const spec = deployment.JobSpecJSON
      ? JSON.parse(deployment.JobSpecJSON)
      : null;
    containers = Array.isArray(spec?.containers)
      ? spec.containers.map((c: any, i: number) => ({
          id: c.id || `container-${i + 1}`,
          name: c.name || c.id || `container-${i + 1}`,
          image: c.args?.image || "-",
        }))
      : [];
  } catch {
    containers = [];
  }
  const workloadStatus = node.AppStatus || node.InfraStatus || "UNKNOWN";
  const workloadDot = ["RUNNING", "READY", "HEALTHY"].includes(
    String(workloadStatus).toUpperCase(),
  )
    ? "bg-emerald-500"
    : ["PENDING", "SCALING", "PARTIAL"].includes(
          String(workloadStatus).toUpperCase(),
        )
      ? "bg-amber-500"
      : ["STOPPED", "FAILED", "ERROR"].includes(
            String(workloadStatus).toUpperCase(),
          )
        ? "bg-red-500"
        : "bg-gray-400";

  const isLive = ["RUNNING", "READY", "HEALTHY"].includes(
    String(node.InfraStatus || "").toUpperCase(),
  );
  const uptimeValue = formatUptime(node.CreatedAt, isLive);
  const heartbeatValue = timeAgo(node.UpdatedAt);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Status"
          value={node.InfraStatus || "UNKNOWN"}
          meta={`App: ${node.AppStatus || "unknown"}`}
          icon={Activity}
          hint="View events"
          onClick={() => onOpenTab("events")}
        />
        <MetricTile
          label="Uptime"
          value={uptimeValue}
          meta={isLive ? "Since node start" : "Node not running"}
          icon={Clock}
          hint="View events"
          onClick={() => onOpenTab("events")}
        />
        <MetricTile
          label="Heartbeat"
          value={heartbeatValue}
          meta="Last agent check-in"
          icon={Radio}
          hint="View events"
          onClick={() => onOpenTab("events")}
        />
        <MetricTile
          label="Containers"
          value={String(containers.length)}
          meta="Declared in job spec"
          icon={Boxes}
          hint="View workloads"
          onClick={() => onOpenTab("workloads")}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard
          title="Node Information"
          subtitle="Identity and runtime details"
          className="flex h-full flex-col"
          bodyClassName="flex-1"
          action={<Server className="size-4 text-mut2" />}
        >
          <div className="flex h-full flex-col">
          <InfoRow
            label="Node Name"
            value={shortId}
            highlight
            copyable
            copyValue={shortId}
            grow
          />
          <InfoRow label="Node ID" value={node.ID} monospace copyable grow />
          <InfoRow
            label="Infra Status"
            value={
              <StatusPill status={node.InfraStatus} />
            }
            grow
          />
          <InfoRow
            label="App Status"
            value={
              <StatusPill status={node.AppStatus} />
            }
            grow
          />
          <InfoRow
            label="Provider"
            value={
              <div className="flex items-center gap-2">
                {provider !== "-" && <Logo name={provider} size={15} />}
                <span className="capitalize">{provider}</span>
              </div>
            }
            grow
          />
          <InfoRow label="Parent Deployment" value={deployment.Name} copyable grow />
          <InfoRow
            label="Deployment ID"
            value={deployment.ID}
            monospace
            copyable
            grow
          />
          <InfoRow
            label="Instance Type"
            value={deployment.InstanceName || deployment.InstanceTypeID || "-"}
            grow
          />
          <InfoRow
            label="Model ID"
            value={deployment.ModelID || "-"}
            copyable
            grow
          />
          <InfoRow label="Created At" value={createdAt} grow />
          <InfoRow label="Last Updated" value={updatedAt} grow />
          </div>
        </SectionCard>

        <div className="flex h-full flex-col gap-3">
          <SectionCard
            title={`Running Workloads (${containers.length})`}
            subtitle="Containers on this node"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenTab("workloads")}
              >
                View all
              </Button>
            }
          >
            {containers.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Boxes className="mx-auto size-4 text-mut2 opacity-50" />
                <p className="mt-2 text-xs font-medium text-mut2">
                  No containers on this node
                </p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {containers.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenTab("workloads")}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-field"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${workloadDot}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-fg">
                        {c.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-mut2">
                        {c.image}
                      </span>
                    </span>
                    <StatusPill status={workloadStatus} />
                  </button>
                ))}
                {containers.length > 8 && (
                  <button
                    type="button"
                    onClick={() => onOpenTab("workloads")}
                    className="w-full px-4 py-2.5 text-left text-[11px] font-medium text-mut2 transition hover:bg-field hover:text-fg"
                  >
                    +{containers.length - 8} more containers
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Node Metrics"
            subtitle="CPU, memory and network preview"
            className="flex flex-1 flex-col"
            action={
              <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full border border-line bg-card px-[9px] text-[11.5px] text-mut2">
                Soon
              </span>
            }
          >
            <div className="grid flex-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
              <div className="flex flex-col p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-mut2">
                  <Cpu className="size-3.5" strokeWidth={1.7} />
                  CPU utilization
                </div>
                <div className="relative mt-2.5 min-h-[110px] flex-1 overflow-hidden rounded-lg bg-field">
                  <FakeGraph />
                  <FakeGraph dashed />
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[10px] font-medium text-mut">
                      Telemetry pending
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-mut2">
                  <MemoryStick className="size-3.5" strokeWidth={1.7} />
                  Memory usage
                </div>
                <div className="relative mt-2.5 min-h-[110px] flex-1 overflow-hidden rounded-lg bg-field">
                  <FakeGraph dashed />
                  <FakeGraph />
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[10px] font-medium text-mut">
                      Telemetry pending
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-line px-4 py-2.5 text-center text-[11px] text-mut">
              Live node telemetry (CPU, memory, disk, network) will appear here
              once agent metrics streaming lands.
            </div>
          </SectionCard>

          <SectionCard
            title="Endpoints"
            subtitle="Direct access for this node"
            action={
              <span className="rounded bg-field px-1.5 py-0.5 text-[10px] font-medium text-mut2">
                {endpoints.length}
              </span>
            }
          >
            {endpoints.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px] text-mut2">
                No endpoints resolved yet. They appear when the node is ready.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {endpoints.map((ep, idx) => (
                  <div
                    key={`${ep.url}-${idx}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-field"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-[11px]">
                      <Link2
                        size={12}
                        className="shrink-0 text-mut2"
                      />
                      <span className="font-mono text-fg">
                        :{ep.port}
                      </span>
                      <span className="truncate font-mono text-mut2">
                        {ep.url}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={ep.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded p-1 text-mut2 transition hover:bg-card hover:text-fg"
                        title="Open endpoint"
                      >
                        <ExternalLink size={12} />
                      </a>
                      <CopyButton value={ep.url} size={12} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
