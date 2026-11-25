"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { AsideCard, K } from "@/components/providers/kit";
import { Logo } from "@/components/ui/Logos";

type SidebarDeployment = {
  status: string;
  provider: string;
  kind: string;
  nodeCount: number;
  desired: number;
};

interface DeploymentsSidebarProps {
  deployments: SidebarDeployment[];
  statusFilter: string;
  providerFilter: string;
  typeFilter: string;
  onStatusClick: (status: string) => void;
  onProviderClick: (provider: string) => void;
  onTypeClick: (type: string) => void;
}

const PROVIDER_COLORS = [
  "#60a5fa", // sky
  "#34d399", // emerald
  "#a78bfa", // violet
  "#fbbf24", // amber
  "#f472b6", // rose
  "#94a3b8", // slate
];

function ProviderHalfGauge({
  providers,
  total,
  subtitle,
}: {
  providers: { id: string; total: number }[];
  total: number;
  subtitle?: string;
}) {
  const r = 64;
  const cx = 90;
  const cy = 84;
  const halfCirc = Math.PI * r;
  const gap = providers.length > 1 ? 3 : 0;
  let acc = 0;

  return (
    <div className="relative flex flex-col items-center border-b border-line px-4 pb-3 pt-4">
      <svg viewBox="0 0 180 96" className="w-44 overflow-visible">
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="currentColor"
          className="text-line"
          strokeWidth={11}
          strokeLinecap="round"
        />
        {/* Segments */}
        {total > 0 &&
          providers.map((p, i) => {
            const share = p.total / total;
            const rawLen = share * halfCirc;
            const segLen = Math.max(0, rawLen - gap);
            const offset = -acc;
            acc += rawLen;
            const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length];
            return (
              <circle
                key={p.id}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={color}
                strokeOpacity={0.8}
                strokeWidth={11}
                strokeLinecap="butt"
                strokeDasharray={`${segLen} ${halfCirc * 2}`}
                strokeDashoffset={offset}
                transform={`rotate(-180 ${cx} ${cy})`}
              />
            );
          })}
      </svg>
      <div className="-mt-9 text-center">
        <div className="text-[20px] font-semibold leading-none tracking-tight">
          {total}
        </div>
        <div className="mt-1 text-[11px] text-mut">
          {subtitle ?? `across ${providers.length} ${providers.length === 1 ? "provider" : "providers"}`}
        </div>
      </div>
    </div>
  );
}

const STATUS_META: { key: string; label: string; bar: string; dot: string }[] = [
  { key: "running", label: "Running", bar: "bg-ok", dot: "bg-ok" },
  { key: "ready", label: "Ready", bar: "bg-ok/75", dot: "bg-ok/75" },
  { key: "scaling", label: "Scaling", bar: "bg-warn", dot: "bg-warn" },
  { key: "pending", label: "Pending", bar: "bg-warn/70", dot: "bg-warn/70" },
  { key: "error", label: "Error", bar: "bg-bad", dot: "bg-bad" },
  { key: "stopped", label: "Stopped", bar: "bg-line2", dot: "bg-line2" },
];

export function DeploymentsSidebar({
  deployments,
  statusFilter,
  providerFilter,
  typeFilter,
  onStatusClick,
  onProviderClick,
  onTypeClick,
}: DeploymentsSidebarProps) {
  const [liveOnly, setLiveOnly] = useState(true);

  const stats = useMemo(() => {
    const total = deployments.length;
    const statusMap = new Map<string, number>();
    let onlineReplicas = 0;
    let desiredReplicas = 0;

    for (const d of deployments) {
      const s = d.status.toLowerCase();
      statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
      onlineReplicas += d.nodeCount;
      desiredReplicas += d.desired;
    }

    // Breakdown scope: if user picked a status filter, follow it;
    // otherwise follow the Live / All toggle.
    const scoped = deployments.filter((d) => {
      const s = d.status.toLowerCase();
      if (statusFilter !== "all") return s === statusFilter;
      if (liveOnly) return s === "running" || s === "ready" || s === "scaling" || s === "pending";
      return true;
    });

    const providerMap = new Map<string, number>();
    const kindMap = new Map<string, number>();
    for (const d of scoped) {
      const p = d.provider.toLowerCase();
      providerMap.set(p, (providerMap.get(p) ?? 0) + 1);
      kindMap.set(d.kind, (kindMap.get(d.kind) ?? 0) + 1);
    }

    const providers = [...providerMap.entries()]
      .map(([id, count]) => ({ id, total: count }))
      .sort((a, b) => b.total - a.total);

    const kinds = [...kindMap.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      scopedTotal: scoped.length,
      statusMap,
      providers,
      kinds,
      onlineReplicas,
      desiredReplicas,
    };
  }, [deployments, statusFilter, liveOnly]);

  const replicaPct =
    stats.desiredReplicas > 0
      ? Math.min(100, Math.round((stats.onlineReplicas / stats.desiredReplicas) * 100))
      : 0;

  return (
    <aside className="xl:sticky xl:top-[76px]">
      {/* Fleet health & status distribution */}
      <AsideCard
        title="Fleet health"
        right={
          <span className={stats.onlineReplicas > 0 ? K.ok : K.off}>
            {stats.onlineReplicas}/{stats.desiredReplicas} replicas
          </span>
        }
      >
        {/* Segmented status bar + replica meter */}
        <div className="border-b border-line px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="text-mut2">Status distribution</span>
            <b className="font-medium">{stats.total} total</b>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-band">
            {stats.total > 0 &&
              STATUS_META.map(({ key, bar }) => {
                const count = stats.statusMap.get(key) ?? 0;
                if (!count) return null;
                return (
                  <div
                    key={key}
                    title={`${key}: ${count}`}
                    className={cn("h-full transition-all", bar)}
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                );
              })}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-mut">
            <span>Replica availability</span>
            <span className="font-mono text-fg">{replicaPct}%</span>
          </div>
        </div>

        {/* Clickable status breakdown */}
        {STATUS_META.map(({ key, label, dot }) => {
          const count = stats.statusMap.get(key) ?? 0;
          if (!count && statusFilter !== key) return null;
          const active = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onStatusClick(active ? "all" : key)}
              className={cn(
                K.kv,
                "w-full text-left transition hover:bg-fg/[.03]",
                active && "bg-fg/[.05]",
              )}
            >
              <i className={cn("size-2 shrink-0 rounded-full", dot)} />
              <span className="flex-1 text-mut2">{label}</span>
              <b className="font-mono text-[13px] font-medium">{count}</b>
            </button>
          );
        })}
      </AsideCard>

      {/* By provider breakdown */}
      <AsideCard
        title="By provider"
        right={
          statusFilter !== "all" ? (
            <span className={K.pill}>{statusFilter}</span>
          ) : (
            <div className="inline-flex rounded-full border border-line bg-card p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setLiveOnly(true)}
                className={cn(
                  "rounded-full px-2 py-0.5 transition",
                  liveOnly ? "bg-fg/10 font-medium text-fg" : "text-mut hover:text-fg",
                )}
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => setLiveOnly(false)}
                className={cn(
                  "rounded-full px-2 py-0.5 transition",
                  !liveOnly ? "bg-fg/10 font-medium text-fg" : "text-mut hover:text-fg",
                )}
              >
                All
              </button>
            </div>
          )
        }
      >
        {stats.providers.length === 0 ? (
          <div className={cn(K.kv, "text-mut2")}>
            {liveOnly && statusFilter === "all"
              ? "No live deployments."
              : "No matching deployments."}
          </div>
        ) : (
          <>
            <ProviderHalfGauge
              providers={stats.providers}
              total={stats.scopedTotal}
              subtitle={
                statusFilter !== "all"
                  ? `${statusFilter} across ${stats.providers.length}`
                  : liveOnly
                    ? `live across ${stats.providers.length}`
                    : `across ${stats.providers.length} ${stats.providers.length === 1 ? "provider" : "providers"}`
              }
            />
            {stats.providers.map((p, i) => {
              const pct = stats.scopedTotal > 0 ? Math.round((p.total / stats.scopedTotal) * 100) : 0;
              const active = providerFilter === p.id;
              const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onProviderClick(active ? "all" : p.id)}
                  className={cn(
                    K.kv,
                    "w-full text-left transition hover:bg-fg/[.03]",
                    active && "bg-fg/[.05]",
                  )}
                >
                  <i
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color, opacity: 0.85 }}
                  />
                  <Logo name={p.id} size={14} />
                  <span className="flex-1 truncate text-[12.5px] font-medium uppercase tracking-wide text-mut2">
                    {p.id}
                  </span>
                  <span className="text-[11.5px] text-mut">{pct}%</span>
                  <b className="font-mono text-[13px] font-medium">{p.total}</b>
                </button>
              );
            })}
          </>
        )}
      </AsideCard>

      {/* Workload mix */}
      {stats.kinds.length > 0 && (
        <AsideCard title="Workload mix">
          {stats.kinds.map(({ kind, count }) => {
            const label = kind.toLowerCase().includes("container")
              ? "Container"
              : kind.toLowerCase().includes("model")
                ? "Model inference"
                : kind;
            const active = typeFilter === kind;
            const pct = stats.scopedTotal > 0 ? Math.round((count / stats.scopedTotal) * 100) : 0;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onTypeClick(active ? "all" : kind)}
                className={cn(
                  K.kv,
                  "w-full text-left transition hover:bg-fg/[.03]",
                  active && "bg-fg/[.05]",
                )}
              >
                <span className="flex-1 truncate text-mut2">{label}</span>
                <span className="text-[11.5px] text-mut">{pct}%</span>
                <b className="font-mono text-[13px] font-medium">{count}</b>
              </button>
            );
          })}
        </AsideCard>
      )}
    </aside>
  );
}
