"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Check,
  ChevronRight,
  Copy,
  Eye,
  MoreHorizontal,
  Play,
  RotateCcw,
  Search,
  Square,
} from "lucide-react";
import { cn } from "cn";
import { Logo } from "../ui/Logos";
import { K } from "@/components/providers/kit";
import { DeploymentsSidebar } from "./DeploymentsSidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useOrgHref } from "@/lib/org";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/Select";

type Deployment = {
  id: string;
  name: string;
  status: string;
  model: string;
  kind: string;
  deployType: string;
  provider: string;
  resource: string;
  replicas: string;
  nodeCount: number;
  desired: number;
  created: string;
  createdAt: string;
};

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s === "ready" || s === "running") return K.ok;
  if (s === "scaling" || s === "pending") return K.warn;
  if (s === "error" || s === "failed")
    return "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-bad/25 bg-bad/10 px-[9px] text-[11.5px] text-bad";
  return K.off;
}

function statusDot(status: string) {
  const s = status.toLowerCase();
  if (s === "ready" || s === "running") return "bg-ok";
  if (s === "scaling" || s === "pending") return "bg-warn";
  if (s === "error" || s === "failed") return "bg-bad";
  return "bg-line2";
}

function logoFor(d: Deployment) {
  if (d.model && d.model !== "-") return d.model;
  const k = d.kind.toLowerCase();
  return k.includes("workload") || k.includes("container") ? "container" : "model";
}

function kindLabel(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("workload") || k.includes("container")) return "Workload";
  if (k.includes("model")) return "Model inference";
  return kind || "-";
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(iso: string) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "-";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function FilterSelect({
  items,
  value,
  onChange,
}: {
  items: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v: string) => onChange(v ?? "all")}>
      <SelectTrigger className="h-9 min-w-32 rounded-xl border-line bg-band text-[13px] text-fg">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Filter</SelectLabel>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function DeploymentTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgHref = useOrgHref();

  // Read filters from URL, fall back to "all"
  const statusFilter = searchParams.get("status") ?? "all";
  const providerFilter = searchParams.get("provider") ?? "all";
  const typeFilter = searchParams.get("type") ?? "all";
  const query = searchParams.get("q") ?? "";

  // Write a single param change back to the URL (replace so back-button isn't spammed)
  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setStatusFilter   = (v: string) => setParam("status", v);
  const setProviderFilter = (v: string) => setParam("provider", v);
  const setTypeFilter     = (v: string) => setParam("type", v);

  // Local input state debounced into URL so every keystroke doesn't navigate
  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => { setSearchInput(query); }, [query]);
  useEffect(() => {
    const t = window.setTimeout(() => setParam("q", searchInput), 300);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  function copyField(e: { stopPropagation: () => void }, key: string, value: string) {
    e.stopPropagation();
    const done = () => {
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    };
    try {
      navigator.clipboard?.writeText(value).then(done).catch(done);
    } catch {
      done();
    }
  }

  const statusOptions = useMemo(() => {
    const unique = [...new Set(deployments.map((d) => d.status.toLowerCase()))].sort();
    return [{ label: "All statuses", value: "all" }, ...unique.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v }))];
  }, [deployments]);

  const providerOptions = useMemo(() => {
    const unique = [...new Set(deployments.map((d) => d.provider.toLowerCase()))].sort();
    return [{ label: "All providers", value: "all" }, ...unique.map((v) => ({ label: v.toUpperCase(), value: v }))];
  }, [deployments]);

  const typeOptions = useMemo(() => {
    const unique = [...new Set(deployments.map((d) => d.kind))].sort();
    return [{ label: "All types", value: "all" }, ...unique.map((v) => ({ label: kindLabel(v), value: v }))];
  }, [deployments]);

  useEffect(() => {
    apiFetch("/api/v1/deployments")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setDeployments(
          data
            .map((d) => {
              const nodeCount = d.Nodes?.length || 0;
              const replicas = d.Replicas || 0;
              const isStopped = nodeCount === 0 || replicas === 0;
              const onlineCount = (d.Nodes || []).filter((n: { InfraStatus?: string }) =>
                ["RUNNING", "READY", "HEALTHY"].includes((n.InfraStatus || "").toUpperCase()),
              ).length;

              const hasErrorNode = d.Nodes?.some(
                (n: { InfraStatus?: string; AppStatus?: string }) =>
                  ["error", "failed"].includes(n.InfraStatus?.toLowerCase() ?? "") ||
                  ["error", "failed"].includes(n.AppStatus?.toLowerCase() ?? ""),
              ) ?? false;

              const depStatus = (d.Status || "").toUpperCase();
              const wasActive = ["READY", "RUNNING", "PARTIAL", "SCALING"].includes(depStatus);
              const allDown = nodeCount > 0 && wasActive && onlineCount === 0;

              let status = d.Status || "UNKNOWN";
              if (hasErrorNode) status = "error";
              else if (isStopped || allDown) status = "stopped";

              return {
                id: d.ID,
                name: d.Name || "Unnamed deployment",
                status: status.toLowerCase(),
                model: d.ModelID || "-",
                kind: d.WorkloadType || (d.ModelID ? "model_inference" : "workload"),
                deployType: (d.WorkloadType || "other").toLowerCase(),
                provider: d.ProviderID || "-",
                resource: d.InstanceName || "-",
                replicas: `${onlineCount} / ${replicas}`,
                nodeCount: onlineCount,
                desired: replicas,
                created: fmtDate(d.CreatedAt),
                createdAt: d.CreatedAt || "",
              };
            })
            .reverse(),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deployments.filter((d) => {
      if (statusFilter !== "all" && d.status.toLowerCase() !== statusFilter) return false;
      if (providerFilter !== "all" && !d.provider.toLowerCase().includes(providerFilter)) return false;
      if (typeFilter !== "all" && d.kind !== typeFilter) return false;
      if (q && ![d.name, d.model, d.provider, d.resource].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [deployments, providerFilter, query, statusFilter, typeFilter]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      {/* Main table */}
      <div>
        {/* Search + filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="gb-f flex h-9 w-full max-w-xs items-center gap-2 rounded-xl pl-3 pr-2.5 text-mut sm:w-64">
            <Search className="size-4 flex-none" strokeWidth={1.7} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search deployments…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-mut"
            />
          </label>
          <FilterSelect items={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          <FilterSelect items={providerOptions} value={providerFilter} onChange={setProviderFilter} />
          <FilterSelect items={typeOptions} value={typeFilter} onChange={setTypeFilter} />
        </div>

        {/* Double-border table card */}
        <section className={K.dbx}>
          {/* Band header */}
          <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
            <h3 className="text-[15px] font-semibold tracking-[-.01em]">Deployments</h3>
            <span className="text-[13px] text-mut">
              {filtered.length} of {deployments.length}
            </span>
          </div>

          {/* Inner card */}
          <div className={K.inner}>
            {loading ? (
              <div className="flex items-center gap-2.5 px-4 py-14 text-[13px] text-mut">
                <span className="size-4 animate-spin rounded-full border-2 border-line2 border-t-accent" />
                Loading deployments…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-14 text-center text-[13px] text-mut">
                No deployments match these filters.
              </div>
            ) : (
              <div>
                <div>
                  {filtered.map((d) => {
                    const ratio = d.desired > 0 ? Math.min(100, Math.round((d.nodeCount / d.desired) * 100)) : 0;
                    return (
                      <div
                        key={d.id}
                        onClick={() => router.push(orgHref(`/deployments/${d.id}`))}
                        className="group grid cursor-pointer grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.65fr)_auto] items-center gap-3 border-b border-line px-4 py-4 transition last:border-0 hover:bg-fg/[.03]"
                      >
                        {/* Name + status */}
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cn(
                            "grid size-[38px] flex-none place-items-center rounded-[9px] border border-line bg-band text-mut2",
                            d.status === "stopped" && "opacity-50",
                          )}>
                            <Logo name={logoFor(d)} size={18} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                onClick={(e) => copyField(e, `${d.id}:name`, d.name)}
                                title="Click to copy"
                                className="group/cp inline-flex min-w-0 cursor-pointer items-center gap-1 truncate text-[13.5px] font-medium"
                              >
                                <span className="truncate">{d.name}</span>
                                {copied === `${d.id}:name` ? (
                                  <Check className="size-3 shrink-0 text-ok" />
                                ) : (
                                  <Copy className="hidden size-3 shrink-0 text-mut group-hover/cp:inline" />
                                )}
                              </span>
                              <span className={statusPill(d.status)}>
                                <i className="size-1.5 rounded-full bg-current" />
                                {d.status}
                              </span>
                            </div>
                            <div
                              onClick={(e) => copyField(e, `${d.id}:id`, d.id)}
                              title="Click to copy"
                              className="group/cp mt-1 inline-flex max-w-full cursor-pointer items-center gap-1 font-mono text-[11px] text-mut"
                            >
                              <span className="truncate">{d.id}</span>
                              {copied === `${d.id}:id` ? (
                                <Check className="size-3 shrink-0 text-ok" />
                              ) : (
                                <Copy className="hidden size-3 shrink-0 group-hover/cp:inline" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Model + kind */}
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-mut mb-1">Model</div>
                          <div
                            onClick={(e) => copyField(e, `${d.id}:model`, d.model)}
                            title="Click to copy"
                            className="group/cp inline-flex max-w-full cursor-pointer items-center gap-1 truncate text-[13px] font-medium"
                          >
                            <span className="truncate">{d.model}</span>
                            {copied === `${d.id}:model` ? (
                              <Check className="size-3 shrink-0 text-ok" />
                            ) : (
                              <Copy className="hidden size-3 shrink-0 text-mut group-hover/cp:inline" />
                            )}
                          </div>
                          <span className={cn(K.pill, "mt-1.5 w-fit")}>{kindLabel(d.kind)}</span>
                        </div>

                        {/* Provider */}
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-mut mb-1">Provider</div>
                          <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                            <Logo name={d.provider} size={14} />
                            <span className="truncate">{d.provider}</span>
                          </div>
                          <div className="mt-1 truncate text-[11px] text-mut">{d.resource}</div>
                        </div>

                        {/* Replicas */}
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-mut mb-1">Replicas</div>
                          <span className="font-mono text-[13px] font-medium">{d.replicas}</span>
                          <div className="mt-2 h-1.5 w-16 overflow-hidden rounded-full bg-band">
                            <span
                              className={cn("block h-full rounded-full", statusDot(d.status))}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-mut">{d.nodeCount} of {d.desired} online</div>
                        </div>

                        {/* Created */}
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-mut mb-1">Created</div>
                          <div className="text-[13px] font-medium">{d.created}</div>
                          <div className="mt-1 text-[11px] text-mut">{timeAgo(d.createdAt)}</div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Actions for ${d.name}`}
                              className={K.ib}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => router.push(orgHref(`/deployments/${d.id}`))}>
                                  <Eye /> View details
                                </DropdownMenuItem>
                                <DropdownMenuItem><Play /> Start</DropdownMenuItem>
                                <DropdownMenuItem><RotateCcw /> Restart</DropdownMenuItem>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive">
                                <Square /> Stop
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <ChevronRight className="size-4 text-mut transition group-hover:translate-x-0.5 group-hover:text-fg" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            {!loading && (
              <div className="border-t border-line px-4 py-2.5 text-[11.5px] text-mut">
                Showing {filtered.length} of {deployments.length} deployments
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right sidebar — fleet health, provider breakdown, workload mix */}
      <DeploymentsSidebar
        deployments={deployments}
        statusFilter={statusFilter}
        providerFilter={providerFilter}
        typeFilter={typeFilter}
        onStatusClick={setStatusFilter}
        onProviderClick={setProviderFilter}
        onTypeClick={setTypeFilter}
      />
    </div>
  );
}
