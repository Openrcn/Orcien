"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Zap } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/Button";
import { useOrgHref } from "@/lib/org";
import { apiFetch } from "@/lib/api";
import { K, AsideCard } from "@/components/providers/kit";
import { Logo } from "@/components/ui/Logos";

function fmtDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const COMPUTE_FILTERS = ["All", "CPU", "GPU"];

export default function TemplatesPage() {
  const router = useRouter();
  const orgHref = useOrgHref();
  const [templates, setTemplates] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [compute, setCompute] = useState("All");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/templates")
      .then((r) => r.json())
      // latest first
      .then((d) => setTemplates(Array.isArray(d) ? [...d].reverse() : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return templates.filter((t) => {
      const c = (t.computeType ?? t.compute_type ?? "CPU").toUpperCase();
      if (compute !== "All" && c !== compute) return false;
      if (!q) return true;
      return `${t.name ?? ""} ${t.image ?? ""} ${c}`.toLowerCase().includes(q);
    });
  }, [templates, query, compute]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await apiFetch(`/api/v1/templates/${id}`, { method: "DELETE" });
      if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete template.");
    } finally {
      setBusyId(null);
    }
  }

  const cpuCount = templates.filter((t) => (t.computeType ?? t.compute_type ?? "CPU").toUpperCase() === "CPU").length;
  const gpuCount = templates.filter((t) => (t.computeType ?? t.compute_type ?? "").toUpperCase() === "GPU").length;

  return (
    <div className="mx-auto w-full max-w-[1360px]">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.03em]">Templates</h1>
          <p className="mt-1.5 text-[13.5px] text-mut2">Reusable container configurations for your workloads.</p>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => router.push(orgHref("/templates/create"))}>
          <Plus className="size-4" strokeWidth={1.7} />
          New template
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-[13px] text-bad">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2.5 py-16 text-[13px] text-mut">
          <span className="size-4 animate-spin rounded-full border-2 border-line2 border-t-accent" />
          Loading templates…
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* Main list */}
          <div>
            {/* Search + compute filter chips in one row */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="gb-f flex h-9 w-56 items-center gap-2 rounded-xl pl-3 pr-2.5 text-mut">
                <Search className="size-4 flex-none" strokeWidth={1.7} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-mut"
                />
              </label>

              {/* Compute filter chips — fills the void */}
              <div className="flex items-center gap-1.5">
                {COMPUTE_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setCompute(f)}
                    className={cn(
                      "h-9 rounded-xl px-3.5 text-[13px] transition",
                      compute === f
                        ? "gb text-fg shadow-[inset_0_1px_0_var(--hi)]"
                        : "border border-line text-mut2 hover:bg-fg/5",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <span className="ml-auto text-[13px] text-mut">
                {filtered.length} template{filtered.length === 1 ? "" : "s"}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line2 px-5 py-10 text-center">
                <b>{query || compute !== "All" ? "No templates match your filters." : "No templates yet."}</b>
                <span className="text-mut">
                  {query || compute !== "All" ? "Try adjusting your search or filter." : "Create your first template to get started."}
                </span>
                {!query && compute === "All" && (
                  <Button size="sm" className="mt-1" onClick={() => router.push(orgHref("/templates/create"))}>
                    <Plus className="size-4" strokeWidth={1.7} />
                    New template
                  </Button>
                )}
              </div>
            ) : (
              /* Double-border card */
              <section className={K.dbx}>
                {/* Band header */}
                <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
                  <span className="grid size-[30px] flex-none place-items-center rounded-[9px] border border-line bg-card">
                    <Logo name="container" size={16} />
                  </span>
                  <h3 className="text-[15px] font-semibold tracking-[-.01em]">Container templates</h3>
                  <span className="text-[13px] text-mut">{filtered.length}</span>
                </div>

                {/* Inner card */}
                <div className={K.inner}>
                  {filtered.map((t) => {
                    const compute = (t.computeType ?? t.compute_type ?? "CPU").toUpperCase();
                    const createdAt = t.CreatedAt ?? t.created_at;
                    const busy = busyId === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => router.push(orgHref(`/templates/${t.id}`))}
                        className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line px-4 py-3 transition last:border-0 hover:bg-fg/[.03] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_auto_100px_auto]"
                      >
                        {/* Name + id */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid size-[30px] flex-none place-items-center rounded-[9px] border border-line bg-band text-mut2">
                            <Logo name="container" size={15} />
                          </span>
                          <div className="min-w-0">
                            <b className="block truncate text-[13.5px] font-medium">
                              {t.name ?? "Untitled template"}
                            </b>
                            <span className="block truncate font-mono text-[11px] text-mut">{t.id}</span>
                          </div>
                        </div>

                        {/* Image */}
                        <code className="col-span-2 truncate text-[12.5px] text-mut2 md:col-span-1">
                          {t.image ?? "—"}
                        </code>

                        {/* Compute badge — fit-content, not stretched */}
                        <span className={cn(K.pill, "w-fit")}>{compute}</span>

                        {/* Created */}
                        <span className="whitespace-nowrap text-[13px] text-mut2">{fmtDate(createdAt)}</span>

                        {/* Actions */}
                        <span
                          className="flex justify-end gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={busy}
                            title="Deploy from template"
                            onClick={() => router.push(orgHref(`/workloads/create?template=${t.id}`))}
                            className={K.ib}
                          >
                            <Zap className="size-[15px]" strokeWidth={1.7} />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            title="Delete template"
                            onClick={() => handleDelete(t.id)}
                            className={cn(K.ib, "hover:bg-bad/10 hover:text-bad")}
                          >
                            <Trash2 className="size-[15px]" strokeWidth={1.7} />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="xl:sticky xl:top-[76px]">
            <AsideCard title="Overview">
              {([
                ["Total templates", String(templates.length)],
                ["CPU workloads", String(cpuCount)],
                ["GPU workloads", String(gpuCount)],
                ["Showing", String(filtered.length)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className={K.kv}>
                  <span className="flex-1 text-mut2">{label}</span>
                  <b className="font-medium">{value}</b>
                </div>
              ))}
            </AsideCard>

            <AsideCard title="Quick actions">
              <div className={K.kv}>
                <Button size="sm" className="w-full" onClick={() => router.push(orgHref("/templates/create"))}>
                  <Plus className="size-4" strokeWidth={1.7} />
                  New template
                </Button>
              </div>
            </AsideCard>
          </aside>
        </div>
      )}
    </div>
  );
}
