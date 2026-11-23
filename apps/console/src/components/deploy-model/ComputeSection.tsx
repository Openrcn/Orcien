"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  HardDrive,
  Loader2,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { K, StatusPill } from "@/components/providers/kit";
import { Logo } from "@/components/ui/Logos";
import { useOrgHref } from "@/lib/org";
import {
  type ProviderCapability,
  type ProviderConnection,
  type ProviderField,
  fetchConnections,
  fetchProviders,
  providerLabel,
} from "@/components/providers/api";
import { ComputeInstance } from "@/components/create/instance-utils";

interface ComputeSectionProps {
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  selectedConnectionId: string;
  onSelectConnection: (connection: ProviderConnection) => void;
  instances: ComputeInstance[];
  selectedInstance: ComputeInstance | null;
  onSelectInstance: (instance: ComputeInstance) => void;
  requiredVram: number;
  selectedModel: string;
  providerConfig: Record<string, string>;
  onProviderConfigChange: (key: string, value: string) => void;
  volumeSizeGb: number;
  onVolumeSizeGbChange: (size: number) => void;
}

/* Kit compute step: provider accordion → connection + provider schema → GPU instances */
export function ComputeSection({
  selectedProvider,
  onSelectProvider,
  selectedConnectionId,
  onSelectConnection,
  instances,
  selectedInstance,
  onSelectInstance,
  requiredVram,
  selectedModel,
  providerConfig,
  onProviderConfigChange,
  volumeSizeGb,
  onVolumeSizeGbChange,
}: ComputeSectionProps) {
  const orgHref = useOrgHref();
  const [providers, setProviders] = useState<ProviderCapability[]>([]);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [instanceSearch, setInstanceSearch] = useState("");
  const autoSelected = useRef(false);

  useEffect(() => {
    Promise.all([fetchProviders(), fetchConnections()])
      .then(([list, conns]) => {
        setProviders(list);
        setConnections(conns);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group accounts under their provider; keep providers with no accounts too.
  const groups = useMemo(() => {
    const byProvider = new Map<string, ProviderConnection[]>();
    connections.forEach((c) => {
      const list = byProvider.get(c.Provider) ?? [];
      list.push(c);
      byProvider.set(c.Provider, list);
    });
    const known = providers.map((p) => ({
      provider: p,
      id: p.id,
      name: p.name || providerLabel(p.id),
      features: p.features ?? [],
      accounts: byProvider.get(p.id) ?? [],
    }));
    const knownIds = new Set(providers.map((p) => p.id));
    const extras = [...byProvider.entries()]
      .filter(([id]) => !knownIds.has(id))
      .map(([id, accounts]) => ({
        provider: {
          id,
          name: providerLabel(id),
          description: "",
          type: "cloud",
          schema: [],
        } as ProviderCapability,
        id,
        name: providerLabel(id),
        features: [] as string[],
        accounts,
      }));
    return [...known, ...extras];
  }, [providers, connections]);

  // Auto-pick the first account once, so the GPU list is ready on arrival.
  useEffect(() => {
    if (autoSelected.current || loading || selectedProvider) return;
    const first = groups.find((g) => g.accounts.length > 0);
    if (!first) return;
    autoSelected.current = true;
    setOpenId(first.id);
    onSelectConnection(first.accounts[0]);
  }, [groups, loading, selectedProvider, onSelectConnection]);

  const activeGroup = groups.find((g) => g.id === selectedProvider);
  const activeProvider = activeGroup?.provider;
  const hasConnection = Boolean(selectedConnectionId);

  const schema = activeProvider?.schema ?? [];
  const requiredFields = schema.filter(
    (f: ProviderField) => f.required && !f.is_advanced,
  );
  const advancedFields = schema.filter(
    (f: ProviderField) => !f.required || f.is_advanced,
  );
  const needsConfig =
    Boolean(activeGroup) &&
    (requiredFields.length > 0 ||
      advancedFields.length > 0 ||
      Boolean(activeProvider?.has_volume_support));

  const filteredInstances = useMemo(() => {
    let list = [...instances];
    if (instanceSearch.trim()) {
      const q = instanceSearch.toLowerCase();
      list = list.filter(
        (i) =>
          (i.name && i.name.toLowerCase().includes(q)) ||
          (i.id && i.id.toLowerCase().includes(q)) ||
          (i.gpu_model && i.gpu_model.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [instances, instanceSearch]);

  const hasEnoughVram = (i: ComputeInstance | null) =>
    !i || i.vram_gb === undefined || i.vram_gb >= requiredVram;

  return (
    <div className="space-y-6">
      {/* VRAM requirement notice */}
      {selectedModel && requiredVram > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-4 py-3 text-[12px]">
          <HardDrive className="size-4 shrink-0 text-accent-t" strokeWidth={1.7} />
          <span className="flex-1 text-mut">
            Estimated <b className="text-fg">~{Math.ceil(requiredVram)} GB</b>{" "}
            VRAM needed for{" "}
            <span className="font-mono text-mut2">
              {selectedModel.split("/").pop()}
            </span>
          </span>
        </div>
      )}

      {/* Account — provider accordion */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-.01em]">
              Account
            </h3>
            <p className="mt-0.5 text-[12px] text-mut">
              Pick a provider and one of its saved connections.
            </p>
          </div>
          <Link
            href={orgHref("/providers/new")}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-t transition hover:brightness-110"
          >
            <Plus className="size-3.5" strokeWidth={1.7} />
            Connect account
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-band px-4 py-6 text-[13px] text-mut">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} />
            Loading providers…
          </div>
        ) : (
          <div>
            {groups.map((g) => {
              const n = g.accounts.length;
              const isOpen = openId === g.id;
              const isSelected = selectedProvider === g.id;
              return (
                <section
                  key={g.id}
                  className={cn("mb-4", K.dbx)}
                >
                  {/* Group header (click to expand) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isOpen) {
                        setOpenId("");
                        return;
                      }
                      setOpenId(g.id);
                      if (!isSelected) onSelectProvider(g.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (isOpen) {
                          setOpenId("");
                        } else {
                          setOpenId(g.id);
                          if (!isSelected) onSelectProvider(g.id);
                        }
                      }
                    }}
                    className="flex cursor-pointer select-none flex-wrap items-center gap-2.5 px-4 py-4"
                  >
                    <span className="grid size-[30px] flex-none place-items-center rounded-[9px] border border-line bg-card">
                      <Logo name={g.id} size={16} />
                    </span>
                    <h3 className="text-[15px] font-semibold tracking-[-.01em]">
                      {g.name}
                    </h3>
                    <span className={cn(K.pill, "capitalize")}>
                      {g.provider.type}
                    </span>
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
                    <Link
                      href={orgHref(
                        `/providers/new?provider=${encodeURIComponent(g.id)}`,
                      )}
                      onClick={(e) => e.stopPropagation()}
                      title={`Connect ${g.name}`}
                      aria-label={`Connect ${g.name}`}
                      className={cn(K.ib, "ml-auto")}
                    >
                      <Plus className="size-4" strokeWidth={1.7} />
                    </Link>
                    <span
                      className={cn(
                        "text-mut transition",
                        !isOpen && "rotate-180",
                      )}
                    >
                      <ChevronDown className="size-4" strokeWidth={1.7} />
                    </span>
                  </div>

                  {/* Expanded: connections + provider-specific config */}
                  {isOpen && (
                    <div className={K.inner}>
                      {n === 0 ? (
                        <div className="flex items-center justify-between gap-3 px-4 py-4">
                          <div>
                            <b className="block text-[13px] font-medium">
                              No accounts yet
                            </b>
                            <span className="text-[12px] text-mut">
                              Connect {g.name} to deploy here.
                            </span>
                          </div>
                          <Link
                            href={orgHref(
                              `/providers/new?provider=${encodeURIComponent(g.id)}`,
                            )}
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-t transition hover:brightness-110"
                          >
                            Connect
                            <ArrowRight className="size-3.5" strokeWidth={1.7} />
                          </Link>
                        </div>
                      ) : (
                        g.accounts.map((c) => {
                          const selected = selectedConnectionId === c.ID;
                          return (
                            <button
                              key={c.ID}
                              type="button"
                              onClick={() => onSelectConnection(c)}
                              className={cn(
                                "flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left transition last:border-0",
                                selected
                                  ? "bg-accent/[.05]"
                                  : "hover:bg-fg/[.03]",
                              )}
                            >
                              <span
                                className={cn(
                                  "grid size-4 flex-none place-items-center rounded-full border",
                                  selected ? "border-accent" : "border-line2",
                                )}
                              >
                                {selected && (
                                  <span className="size-2 rounded-full bg-accent" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <b className="block truncate text-[13.5px] font-medium">
                                  {c.Name}
                                </b>
                                <span className="font-mono text-[11px] text-mut">
                                  {c.ID.slice(-8)}
                                </span>
                              </span>
                              <StatusPill
                                verified={c.Status === "verified"}
                              />
                              {selected && (
                                <span className={K.ok}>
                                  <i className="size-1.5 rounded-full bg-current" />
                                  Selected
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}

                      {/* Provider-specific configuration (schema driven) */}
                      {isSelected && needsConfig && (
                        <div className="border-t border-line px-4 py-3.5">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-[12px] font-medium text-mut2">
                              {g.name} configuration
                            </span>
                            <span className="text-[11px] text-mut">
                              Provider-specific settings
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            {requiredFields.map((field) => (
                              <div key={field.key} className="space-y-1.5">
                                <label className="text-[12px] font-medium text-mut2">
                                  {field.name}
                                  <span className="ml-1 text-bad">*</span>
                                </label>
                                <ProviderFieldInput
                                  field={field}
                                  value={providerConfig[field.key]}
                                  onChange={onProviderConfigChange}
                                />
                                {field.description && (
                                  <p className="text-[11px] text-mut">
                                    {field.description}
                                  </p>
                                )}
                              </div>
                            ))}

                            {g.provider.has_volume_support && (
                              <div className="space-y-1.5 sm:col-span-2">
                                <label className="text-[12px] font-medium text-mut2">
                                  Persistent volume
                                </label>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="number"
                                    min={10}
                                    max={1000}
                                    value={volumeSizeGb}
                                    onChange={(e) =>
                                      onVolumeSizeGbChange(
                                        parseInt(e.target.value, 10) || 50,
                                      )
                                    }
                                    className="w-36 text-[13px]"
                                  />
                                  <span className="text-[12px] text-mut">
                                    GB mounted storage
                                  </span>
                                </div>
                                <p className="text-[11px] text-mut">
                                  Model weights and cache are stored on this
                                  volume.
                                </p>
                              </div>
                            )}

                            {advancedFields.length > 0 && (
                              <div className="border-t border-line pt-3 sm:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => setShowAdvanced((v) => !v)}
                                  className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left"
                                >
                                  <Settings2
                                    className="size-3.5 text-mut2"
                                    strokeWidth={1.7}
                                  />
                                  <span className="text-[12px] font-medium text-mut2">
                                    Advanced options
                                  </span>
                                  <span className="text-[11px] text-mut">
                                    {advancedFields.length}
                                  </span>
                                  <ChevronDown
                                    className={cn(
                                      "ml-auto size-4 text-mut2 transition",
                                      showAdvanced && "rotate-180",
                                    )}
                                    strokeWidth={1.7}
                                  />
                                </button>
                                {showAdvanced && (
                                  <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                    {advancedFields.map((field) => (
                                      <div
                                        key={field.key}
                                        className="space-y-1.5"
                                      >
                                        <label className="text-[12px] font-medium text-mut2">
                                          {field.name}
                                        </label>
                                        <ProviderFieldInput
                                          field={field}
                                          value={providerConfig[field.key]}
                                          onChange={onProviderConfigChange}
                                        />
                                        {field.description && (
                                          <p className="text-[11px] text-mut">
                                            {field.description}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      {/* GPU instances — only after a connection is selected */}
      {hasConnection && (
        <section className={K.dbx}>
          <div className="flex items-center justify-between px-3 pb-2.5 pt-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-.01em]">
                GPU instances
              </h3>
              <p className="mt-0.5 text-[12px] text-mut">
                Available compute on{" "}
                {activeGroup?.name ?? providerLabel(selectedProvider)}.
              </p>
            </div>
            <span className="text-[12px] text-mut2">
              {filteredInstances.length} instance
              {filteredInstances.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className={K.inner}>
            <div className="relative border-b border-line p-3">
              <Search
                className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-mut"
                strokeWidth={1.7}
              />
              <Input
                value={instanceSearch}
                onChange={(e) => setInstanceSearch(e.target.value)}
                placeholder="Search instances (RTX 4090, A100, 24GB…)"
                className="pl-10 text-[13px]"
              />
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {filteredInstances.length === 0 ? (
                <div className="grid justify-items-center gap-1.5 px-6 py-10 text-center">
                  <b className="text-[13px] font-medium text-mut2">
                    No matching GPU instances
                  </b>
                  <span className="text-[12px] text-mut">
                    Try another search or pick a different account.
                  </span>
                </div>
              ) : (
                filteredInstances.map((i) => {
                  const enoughVram = hasEnoughVram(i);
                  const soldOut = i.available === 0;
                  const selectable = enoughVram && !soldOut;
                  const selected = selectedInstance?.id === i.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      disabled={!selectable}
                      onClick={
                        selectable ? () => onSelectInstance(i) : undefined
                      }
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left transition last:border-0",
                        selected
                          ? "bg-accent/[.05]"
                          : !selectable
                            ? "cursor-not-allowed opacity-55"
                            : "hover:bg-fg/[.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-4 flex-none place-items-center rounded-full border",
                          selected ? "border-accent" : "border-line2",
                        )}
                      >
                        {selected && (
                          <span className="size-2 rounded-full bg-accent" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13.5px] font-medium">
                          {i.name}
                        </b>
                        <span className="truncate text-[12px] text-mut">
                          {[i.gpu_model, i.location]
                            .filter(Boolean)
                            .join(" • ") || "GPU"}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[11px] text-mut">VRAM</span>
                        <b className="text-[12.5px] font-medium">
                          {i.vram_gb ?? "—"} GB
                        </b>
                      </span>
                      <span className="text-right">
                        <span className="block text-[11px] text-mut">$/hr</span>
                        <b className="text-[12.5px] font-medium">
                          {i.price !== undefined ? `$${i.price}` : "—"}
                        </b>
                      </span>
                      {!enoughVram ? (
                        <span className={K.warn}>
                          <i className="size-1.5 rounded-full bg-current" />
                          Low VRAM
                        </span>
                      ) : soldOut ? (
                        <span className={K.off}>
                          <i className="size-1.5 rounded-full bg-current" />
                          Not available
                        </span>
                      ) : (
                        <span className={K.ok}>
                          <i className="size-1.5 rounded-full bg-current" />
                          {i.available !== undefined
                            ? `Available (${i.available})`
                            : "Available"}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {selectedInstance && !hasEnoughVram(selectedInstance) && (
              <div className="border-t border-warn/25 bg-warn/10 px-4 py-2.5">
                <p className="text-[12px] text-warn">
                  {selectedInstance.name} has less VRAM than needed (~
                  {Math.ceil(requiredVram)} GB).
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* Schema-driven provider field (select / boolean / number / text / password) */
function ProviderFieldInput({
  field,
  value,
  onChange,
}: {
  field: ProviderField;
  value?: string;
  onChange: (key: string, value: string) => void;
}) {
  const currentValue = value ?? field.default ?? "";

  if (field.type === "select" && field.options) {
    return (
      <Select
        value={currentValue}
        onValueChange={(val: string) => onChange(field.key, val)}
      >
        <SelectTrigger className="w-full text-[13px] data-[size=default]:h-11">
          <SelectValue placeholder={field.placeholder || "Select"} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "boolean") {
    return (
      <Select
        value={currentValue || "false"}
        onValueChange={(val: string) => onChange(field.key, val)}
      >
        <SelectTrigger className="w-full text-[13px] data-[size=default]:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Enabled</SelectItem>
          <SelectItem value="false">Disabled</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={
        field.type === "number"
          ? "number"
          : field.type === "password"
            ? "password"
            : "text"
      }
      placeholder={field.placeholder || field.default || ""}
      value={currentValue}
      onChange={(e) => onChange(field.key, e.target.value)}
      className={
        field.type === "password"
          ? "font-mono text-[13px]"
          : "text-[13px]"
      }
    />
  );
}
