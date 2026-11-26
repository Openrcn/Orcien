"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Boxes,
  Braces,
  Gauge,
  MoreHorizontal,
  Network,
  Server,
  Terminal,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CopyButton } from "@/components/ui/CopyButton";
import { Logo } from "@/components/ui/Logos";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailShell } from "@/components/deployments/detail/DetailShell";
import { DetailTabs } from "@/components/deployments/detail/DetailTabs";
import { DetailCard } from "@/components/deployments/detail/DetailCard";
import { NodeOverviewTab } from "@/components/deployments/node-detail/NodeOverviewTab";
import { NodeMetricsTab } from "@/components/deployments/node-detail/NodeMetricsTab";
import { NodeWorkloadsTab } from "@/components/deployments/node-detail/NodeWorkloadsTab";
import { NodeEventsTab } from "@/components/deployments/node-detail/NodeEventsTab";
import { NodeLogsTab } from "@/components/deployments/node-detail/NodeLogsTab";
import { NodeConfigurationTab } from "@/components/deployments/node-detail/NodeConfigurationTab";
import { shortNodeId, StatusPill } from "@/components/deployments/node-detail/shared";
import { useOrgHref } from "@/lib/org";
import { apiFetch } from "@/lib/api";

const tabOrder = [
  "overview",
  "metrics",
  "workloads",
  "events",
  "logs",
  "terminal",
  "request",
  "configuration",
] as const;
type TabId = (typeof tabOrder)[number];

type NodeRecord = {
  ID: string;
  InfraStatus?: string;
  AppStatus?: string;
  ProviderID?: string;
  EndpointsJSON?: string;
  NodeURL?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

type DeploymentRecord = {
  ID: string;
  Name: string;
  ProviderID?: string;
  ModelID?: string;
  InstanceName?: string;
  InstanceTypeID?: string;
  JobSpecJSON?: string;
  Endpoints?: unknown[];
  Nodes?: NodeRecord[];
};

export default function NodeDetailPage(props: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const orgHref = useOrgHref();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [deployment, setDeployment] = useState<DeploymentRecord | null>(null);
  const [node, setNode] = useState<NodeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const tabFromQuery = (searchParams.get("tab") as TabId | null) ?? "overview";
  const activeTab = tabOrder.includes(tabFromQuery) ? tabFromQuery : "overview";

  const setTab = (tab: TabId, extra?: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("container");
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    for (const [key, value] of Object.entries(extra || {})) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const openTab = (tab: string, opts?: { container?: string }) =>
    setTab(
      tab as TabId,
      opts?.container ? { container: opts.container } : undefined,
    );

  const decodeParam = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  useEffect(() => {
    const targetNodeId = decodeParam(params.nodeId);
    const fetchNode = () => {
      apiFetch(`/api/v1/deployments/${params.id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Deployment not found");
          return res.json();
        })
        .then((data: DeploymentRecord) => {
          setDeployment(data);
          const found = (data.Nodes || []).find(
            (n) => n.ID === targetNodeId || n.ID === params.nodeId,
          );
          if (found) {
            setNode(found);
            setError("");
          } else {
            setError("Node not found within this deployment");
          }
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    };

    fetchNode();
    const intervalId = setInterval(fetchNode, 3000);
    return () => clearInterval(intervalId);
  }, [params.id, params.nodeId]);

  if (loading) {
    return (
      <div className="p-16 text-center text-sm text-mut2">
        Loading node details...
      </div>
    );
  }

  if (error || !node || !deployment) {
    return (
      <div className="p-16 text-center text-sm text-mut2">
        {error || "Node not found."}
      </div>
    );
  }

  const shortId = shortNodeId(node.ID);
  let jobContainers: { id: string; image: string }[] = [];
  try {
    const spec = deployment.JobSpecJSON
      ? JSON.parse(deployment.JobSpecJSON)
      : null;
    jobContainers = Array.isArray(spec?.containers)
      ? spec.containers.map((c: any, i: number) => ({
          id: c.id || `container-${i + 1}`,
          image: c.args?.image || "-",
        }))
      : [];
  } catch {
    jobContainers = [];
  }
  const selectedContainer = searchParams.get("container");
  const tabItems = [
    { id: "overview" as const, label: "Overview", icon: Gauge },
    { id: "metrics" as const, label: "Metrics", icon: Activity },
    { id: "workloads" as const, label: "workloads", icon: Boxes },
    { id: "events" as const, label: "Events", icon: Server },
    { id: "logs" as const, label: "Logs", icon: Terminal },
    { id: "terminal" as const, label: "Terminal", icon: Terminal },
    { id: "request" as const, label: "Request", icon: Network },
    { id: "configuration" as const, label: "Configuration", icon: Braces },
  ];

  return (
    <div className="mx-auto w-full max-w-[1450px] pb-16">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href={orgHref(`/deployments/${params.id}`)}
          className="inline-grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-card text-mut2 transition hover:bg-fg/[.04] hover:text-fg"
          aria-label="Back to deployment"
        >
          <ArrowLeft className="size-4" strokeWidth={1.7} />
        </Link>
        <div className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-card text-mut2">
          <Server className="size-[18px]" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wider text-mut">
            <Link
              href={orgHref("/deployments")}
              className="transition hover:text-fg"
            >
              Deployments
            </Link>
            <span className="text-line2">/</span>
            <Link
              href={orgHref(`/deployments/${params.id}`)}
              className="transition hover:text-fg"
            >
              {deployment.Name}
            </Link>
            <span className="text-line2">/</span>
            <span>Nodes</span>
            <span className="text-line2">/</span>
            <span className="font-mono text-[11px] normal-case tracking-normal text-mut2">
              {node.ID}
            </span>
            <CopyButton value={node.ID} size={12} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-.03em]">
              {shortId}...
            </h1>
            <StatusPill status={node.InfraStatus} />
            {(node.ProviderID || deployment.ProviderID) && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-0.5 text-[11px] text-mut2">
                <Logo
                  name={node.ProviderID || deployment.ProviderID || "nosana"}
                  size={12}
                />
                <span className="capitalize">
                  {node.ProviderID || deployment.ProviderID}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-[10px] border border-line bg-card text-mut2 transition hover:bg-fg/[.04] hover:text-fg">
              <MoreHorizontal className="size-4" strokeWidth={1.7} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem disabled>Restart node (soon)</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(orgHref(`/deployments/${params.id}`))
                  }
                >
                  View deployment
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Section tabs */}
      <DetailTabs
        items={tabItems}
        activeId={activeTab}
        onSelect={(id) => setTab(id as TabId)}
        ariaLabel="Node sections"
      />

      <DetailShell>
        {activeTab === "overview" && (
          <NodeOverviewTab
            deployment={deployment}
            node={node}
            onOpenTab={openTab}
          />
        )}
        {activeTab === "metrics" && (
          <NodeMetricsTab
            key={`${deployment.ID}:${node.ID}:metrics`}
            deploymentId={deployment.ID}
            nodeId={node.ID}
            enabled={activeTab === "metrics"}
          />
        )}
        {activeTab === "workloads" && (
          <NodeWorkloadsTab
            deployment={deployment}
            node={node}
            onOpenTab={openTab}
          />
        )}
        {activeTab === "events" && (
          <NodeEventsTab
            key={`${deployment.ID}:${node.ID}:events`}
            deploymentId={deployment.ID}
            nodeId={node.ID}
          />
        )}
        {activeTab === "logs" && (
          <NodeLogsTab
            key={`${deployment.ID}:${node.ID}:logs`}
            deploymentId={deployment.ID}
            nodeId={node.ID}
            containers={jobContainers}
            selected={selectedContainer}
            onSelect={(id) =>
              id ? setTab("logs", { container: id }) : setTab("logs")
            }
          />
        )}
        {activeTab === "terminal" && (
          <DetailCard
            title="Terminal"
            subtitle="Shell access to this node"
            icon={<Terminal className="size-[15px]" strokeWidth={1.7} />}
          >
            <div className="grid min-h-[320px] place-items-center p-8">
              <div className="flex max-w-sm flex-col items-center text-center">
                <div className="grid size-12 place-items-center rounded-full border border-line bg-band text-mut2">
                  <Terminal className="size-5" strokeWidth={1.7} />
                </div>
                <h2 className="mt-4 text-[15px] font-semibold text-fg">
                  Terminal coming soon
                </h2>
                <p className="mt-1.5 text-[12.5px] text-mut2">
                  Exec into containers on this node will appear here.
                </p>
              </div>
            </div>
          </DetailCard>
        )}
        {activeTab === "request" && (
          <DetailCard
            title="Request"
            subtitle="Per-node request activity"
            icon={<Network className="size-[15px]" strokeWidth={1.7} />}
          >
            <div className="grid min-h-[320px] place-items-center p-8">
              <div className="flex max-w-sm flex-col items-center text-center">
                <div className="grid size-12 place-items-center rounded-full border border-line bg-band text-mut2">
                  <Network className="size-5" strokeWidth={1.7} />
                </div>
                <h2 className="mt-4 text-[15px] font-semibold text-fg">
                  Request details coming soon
                </h2>
                <p className="mt-1.5 text-[12.5px] text-mut2">
                  Traffic served by this node will appear here.
                </p>
              </div>
            </div>
          </DetailCard>
        )}
        {activeTab === "configuration" && (
          <NodeConfigurationTab deployment={deployment} node={node} />
        )}
      </DetailShell>
    </div>
  );
}
