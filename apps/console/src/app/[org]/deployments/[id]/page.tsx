"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Braces,
  Gauge,
  MoreHorizontal,
  Network,
  Play,
  RotateCcw,
  Server,
  Square,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getDerivedDeploymentStatus } from "@/lib/deployment-status";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CopyButton } from "@/components/ui/CopyButton";
import { DetailShell } from "@/components/deployments/detail/DetailShell";
import { DetailTabs } from "@/components/deployments/detail/DetailTabs";
import { StatusPill } from "@/components/deployments/node-detail/shared";
import { DetailCard } from "@/components/deployments/detail/DetailCard";
import { OverviewTab } from "@/components/deployments/detail/OverviewTab";
import { MetricsTab } from "@/components/deployments/detail/MetricsTab";
import { ReplicasTab } from "@/components/deployments/detail/ReplicasTab";
import { ConfigurationTab } from "@/components/deployments/detail/ConfigurationTab";
import { apiFetch } from "@/lib/api";
import { useOrgHref } from "@/lib/org";

const tabOrder = [
  "overview",
  "metrics",
  "replicas",
  "api",
  "configuration",
] as const;

type TabId = (typeof tabOrder)[number];

export default function DeploymentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgHref = useOrgHref();

  const [deployment, setDeployment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const tabFromQuery = (searchParams.get("tab") as TabId | null) ?? "overview";
  const activeTab = tabOrder.includes(tabFromQuery) ? tabFromQuery : "overview";

  const setTab = (tab: TabId) => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  useEffect(() => {
    apiFetch(`/api/v1/deployments/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Deployment not found");
        return res.json();
      })
      .then((data) => setDeployment(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleAction = async (action: string) => {
    if (!deployment) return;

    setActionLoading(true);
    try {
      if (action === "restart") {
        await apiFetch(`/api/v1/deployments/${deployment.ID}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        });
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await apiFetch(`/api/v1/deployments/${deployment.ID}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
      } else {
        await apiFetch(`/api/v1/deployments/${deployment.ID}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      }

      window.location.reload();
    } catch {
      alert("Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getDeploymentStatus = getDerivedDeploymentStatus;

  const statusVariant = (status: string) => {
    const value = status?.toUpperCase();
    if (value === "RUNNING" || value === "READY") return "success";
    if (value === "PARTIAL" || value === "SCALING") return "warning";
    if (value === "STOPPED") return "error";
    return "default";
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-sm text-mut2">
        Loading deployment...
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="p-16 text-center text-sm text-mut2">
        Deployment not found.
      </div>
    );
  }

  const nodes = deployment.Nodes || [];
  let parsedSpec: any = null;
  try {
    parsedSpec = deployment.JobSpecJSON
      ? JSON.parse(deployment.JobSpecJSON)
      : null;
  } catch {
    parsedSpec = null;
  }

  const tabItems = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "metrics", label: "Metrics", icon: Activity },
    {
      id: "replicas",
      label: "Replicas / Nodes",
      icon: Server,
      count: nodes.length || deployment.Replicas,
    },
    { id: "api", label: "API", icon: Network },
    { id: "configuration", label: "Configuration", icon: Braces },
  ];

  return (
    <div className="mx-auto w-full max-w-[1450px] pb-16">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href={orgHref("/deployments")}
          className="inline-grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-card text-mut2 transition hover:bg-fg/[.04] hover:text-fg"
          aria-label="Back to deployments"
        >
          <ArrowLeft className="size-4" strokeWidth={1.7} />
        </Link>
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-mut">
            <span>Deployment</span>
            <span className="text-line2">/</span>
            <span className="font-mono text-[11px] normal-case tracking-normal text-mut2">
              {deployment.ID}
            </span>
            <CopyButton value={deployment.ID} size={12} />
          </div>
          <h1 className="flex items-center gap-2 text-[26px] font-semibold leading-tight tracking-[-.03em]">
            <span className="truncate">{deployment.Name}</span>
            <CopyButton value={deployment.Name} size={14} />
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <StatusPill status={getDeploymentStatus(deployment, nodes)} />

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-[10px] border border-line bg-card text-mut2 transition hover:bg-fg/[.04] hover:text-fg">
              <MoreHorizontal className="size-4" strokeWidth={1.7} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => handleAction("restart")}
                  disabled={actionLoading}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Restart
                </DropdownMenuItem>
                {getDerivedDeploymentStatus(deployment, nodes) !== "STOPPED" ? (
                  <DropdownMenuItem
                    onClick={() => handleAction("stop")}
                    disabled={actionLoading}
                  >
                    <Square className="mr-2 size-4" />
                    Stop
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => handleAction("start")}
                    disabled={actionLoading}
                  >
                    <Play className="mr-2 size-4" />
                    Start
                  </DropdownMenuItem>
                )}
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
      />

      <DetailShell>
        {activeTab === "overview" && (
          <OverviewTab
            deployment={deployment}
            nodes={nodes}
            onOpenTab={(tab) => setTab(tab as TabId)}
            statusVariant={statusVariant}
          />
        )}
        {activeTab === "metrics" && <MetricsTab />}
        {activeTab === "replicas" && (
          <ReplicasTab
            nodes={nodes}
            deployment={deployment}
            statusVariant={statusVariant}
          />
        )}
        {activeTab === "api" && (
          <DetailCard
            title="API"
            subtitle="OpenAI-compatible endpoint"
            icon={<Network className="size-[15px]" strokeWidth={1.7} />}
          >
            <div className="grid min-h-[320px] place-items-center p-8">
              <div className="flex max-w-sm flex-col items-center text-center">
                <div className="grid size-12 place-items-center rounded-full border border-line bg-band text-mut2">
                  <Network className="size-5" strokeWidth={1.7} />
                </div>
                <h2 className="mt-4 text-[15px] font-semibold text-fg">
                  Request documentation coming soon
                </h2>
                <p className="mt-1.5 text-[12.5px] text-mut2">
                  Endpoint, auth and request examples for this deployment will
                  appear here.
                </p>
              </div>
            </div>
          </DetailCard>
        )}
        {activeTab === "configuration" && (
          <ConfigurationTab config={parsedSpec} />
        )}
      </DetailShell>
    </div>
  );
}
