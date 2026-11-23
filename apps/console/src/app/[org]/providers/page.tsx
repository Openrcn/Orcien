"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/ui/Logos";
import { Button } from "@/components/ui/Button";
import { useOrgHref } from "@/lib/org";
import { K, AsideCard, StatusPill } from "@/components/providers/kit";
import {
  deleteConnection,
  fetchConnections,
  fetchProviders,
  providerLabel,
  reverifyConnection,
  type ProviderCapability,
  type ProviderConnection,
} from "@/components/providers/api";

export default function ProvidersPage() {
  const router = useRouter();
  const orgHref = useOrgHref();
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [providers, setProviders] = useState<ProviderCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([fetchConnections(), fetchProviders()])
      .then(([conns, list]) => {
        setConnections(conns);
        setProviders(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Group connections under their provider; keep providers with no accounts too.
  const groups = useMemo(() => {
    const byProvider = new Map<string, ProviderConnection[]>();
    connections.forEach((c) => {
      const list = byProvider.get(c.Provider) ?? [];
      list.push(c);
      byProvider.set(c.Provider, list);
    });
    const known = providers.map((p) => ({
      id: p.id,
      name: p.name || providerLabel(p.id),
      features: p.features ?? [],
      accounts: byProvider.get(p.id) ?? [],
    }));
    const knownIds = new Set(providers.map((p) => p.id));
    const extras = [...byProvider.entries()]
      .filter(([id]) => !knownIds.has(id))
      .map(([id, accounts]) => ({
        id,
        name: providerLabel(id),
        features: [],
        accounts,
      }));
    return [...known, ...extras];
  }, [providers, connections]);

  const failing = useMemo(
    () => connections.filter((c) => c.Status !== "verified"),
    [connections],
  );

  const goConnect = (providerId?: string) =>
    router.push(
      orgHref(
        providerId
          ? `/providers/new?provider=${encodeURIComponent(providerId)}`
          : "/providers/new",
      ),
    );

  async function handleReverify(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await reverifyConnection(id);
      setConnections((prev) =>
        prev.map((c) =>
          c.ID === id
            ? { ...c, Status: res.status || (res.verified ? "verified" : "failed") }
            : c,
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this provider connection?")) return;
    setBusyId(id);
    setError("");
    try {
      await deleteConnection(id);
      setConnections((prev) => prev.filter((c) => c.ID !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete connection.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1360px]">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.03em]">
            Providers
          </h1>
          <p className="mt-1.5 text-[13.5px] text-mut2">
            Connect cloud and compute providers to deploy workloads on Orcien.
          </p>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => goConnect()}>
          <Plus className="size-4" strokeWidth={1.7} />
          Connect account
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-[13px] text-bad">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2.5 py-16 text-[13px] text-mut">
          <span className="size-4 animate-spin rounded-full border-2 border-line2 border-t-accent" />
          Loading connections…
        </div>
      ) : groups.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line2 px-5 py-10 text-center">
          <b>No providers available</b>
          <span className="text-mut">
            Connect a provider to start deploying.
          </span>
          <Button size="sm" className="mt-1" onClick={() => goConnect()}>
            <Plus className="size-4" strokeWidth={1.7} />
            Connect account
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Provider groups */}
          <div>
            {groups.map((g) => {
              const n = g.accounts.length;
              const isClosed = closed[g.id];
              return (
                <section
                  key={g.id}
                  className={cn("mb-4", K.dbx, (isClosed || !n) && "pb-0")}
                >
                  {/* Group header (click to fold) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setClosed((s) => ({ ...s, [g.id]: !s[g.id] }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setClosed((s) => ({ ...s, [g.id]: !s[g.id] }));
                      }
                    }}
                    className="flex cursor-pointer select-none flex-wrap items-center gap-2.5 px-3 pb-2.5 pt-3"
                  >
                    <span className="grid size-[30px] flex-none place-items-center rounded-[9px] border border-line bg-card">
                      <Logo name={g.id} size={16} />
                    </span>
                    <h3 className="text-[15px] font-semibold tracking-[-.01em]">
                      {g.name}
                    </h3>
                    <span className="text-[13px] text-mut">
                      {n
                        ? `${n} ${n > 1 ? "accounts" : "account"}`
                        : "Not connected"}
                    </span>
                    <span className="flex flex-wrap gap-1.5 max-sm:hidden">
                      {g.features.slice(0, 3).map((feat) => (
                        <span key={feat} className={K.pill}>
                          {feat}
                        </span>
                      ))}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goConnect(g.id);
                      }}
                      title={`Connect ${g.name}`}
                      aria-label={`Connect ${g.name}`}
                      className={cn(K.ib, "ml-auto")}
                    >
                      <Plus className="size-4" strokeWidth={1.7} />
                    </button>
                    <span
                      className={cn(
                        "text-mut transition",
                        isClosed && "rotate-180",
                      )}
                    >
                      <ChevronDown className="size-4" strokeWidth={1.7} />
                    </span>
                  </div>

                  {/* Account rows */}
                  {n > 0 && !isClosed && (
                    <div className={K.inner}>
                      {g.accounts.map((c) => {
                        const verified = c.Status === "verified";
                        const busy = busyId === c.ID;
                        return (
                          <div
                            key={c.ID}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 transition last:border-0 hover:bg-fg/[.03] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_140px_128px]"
                          >
                            <b className="truncate text-[13.5px] font-medium">
                              {c.Name}
                            </b>
                            <span className="col-span-2 truncate text-[12.5px] text-mut md:col-span-1 md:text-[13px] md:text-mut2">
                              Added {new Date(c.CreatedAt).toLocaleDateString()}
                            </span>
                            <span>
                              <StatusPill verified={verified} />
                            </span>
                            <span className="flex justify-end">
                              {c.Provider === "local" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(
                                      orgHref(`/providers/${c.ID}/machines`),
                                    )
                                  }
                                  disabled={busy}
                                  title="Manage machines"
                                  aria-label="Manage machines"
                                  className={K.ib}
                                >
                                  <Server className="size-[15px]" strokeWidth={1.7} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(orgHref(`/providers/${c.ID}/edit`))
                                }
                                disabled={busy}
                                title="Edit connection"
                                aria-label="Edit connection"
                                className={K.ib}
                              >
                                <Pencil className="size-[15px]" strokeWidth={1.7} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReverify(c.ID)}
                                disabled={busy}
                                title="Test connection"
                                aria-label="Test connection"
                                className={K.ib}
                              >
                                <RefreshCw
                                  className={cn(
                                    "size-[15px]",
                                    busy && "animate-spin",
                                  )}
                                  strokeWidth={1.7}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(c.ID)}
                                disabled={busy}
                                title="Remove connection"
                                aria-label="Remove connection"
                                className={cn(
                                  K.ib,
                                  "hover:bg-bad/10 hover:text-bad",
                                )}
                              >
                                <Trash2 className="size-[15px]" strokeWidth={1.7} />
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Summary rail */}
          <aside className="xl:sticky xl:top-[76px]">
            <AsideCard title="Overview">
              {[
                [
                  "Providers linked",
                  `${groups.filter((g) => g.accounts.length).length} / ${groups.length}`,
                ],
                ["Accounts", String(connections.length)],
                [
                  "Connected",
                  String(connections.length - failing.length),
                ],
                ["Needs attention", String(failing.length)],
              ].map(([label, value]) => (
                <div key={label} className={K.kv}>
                  <span className="flex-1 text-mut2">{label}</span>
                  <b className="font-medium">{value}</b>
                </div>
              ))}
            </AsideCard>

            <AsideCard
              title="Needs attention"
              right={
                <span className={failing.length ? K.warn : K.ok}>
                  {failing.length ? failing.length : "All clear"}
                </span>
              }
            >
              {failing.length === 0 ? (
                <div className={cn(K.kv, "text-mut2")}>
                  Every account is healthy.
                </div>
              ) : (
                failing.map((c) => (
                  <div key={c.ID} className={K.kv}>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{c.Name}</b>
                      <small className="text-xs text-mut">
                        {providers.find((p) => p.id === c.Provider)?.name ||
                          providerLabel(c.Provider)}{" "}
                        · re-check credentials
                      </small>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 px-3 text-xs"
                      disabled={busyId === c.ID}
                      onClick={() => handleReverify(c.ID)}
                    >
                      Retest
                    </Button>
                  </div>
                ))
              )}
            </AsideCard>
          </aside>
        </div>
      )}
    </div>
  );
}
