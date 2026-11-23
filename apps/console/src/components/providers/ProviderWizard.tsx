"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/ui/Logos";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
  createConnection,
  fetchConnection,
  fetchConnections,
  fetchProviders,
  fetchSchemas,
  fetchConnectionConfig,
  reverifyConnection,
  updateConnection,
  verifyConnectionInput,
  providerLabel,
  type ProviderCapability,
  type ProviderConnection,
  type ProviderField,
} from "./api";
import { ProviderFieldInput } from "./ProviderFieldInput";
import { JsonArrayInput } from "./JsonArrayInput";
import { K, AsideCard } from "./kit";
import { useOrgHref } from "@/lib/org";

type FlowStatus = "idle" | "verifying" | "saving" | "success" | "error";

interface Props {
  connectionId?: string;
}

export function ProviderWizard({ connectionId }: Props) {
  const router = useRouter();
  const orgHref = useOrgHref();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("provider");
  const isEdit = Boolean(connectionId);

  const [providers, setProviders] = useState<ProviderCapability[]>([]);
  const [schemas, setSchemas] = useState<Record<string, ProviderField[]>>({});
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

  const [selected, setSelected] = useState<ProviderCapability | null>(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File>>({});

  const [status, setStatus] = useState<FlowStatus>("idle");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ProviderConnection | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchProviders(),
      fetchSchemas(),
      fetchConnections(),
      connectionId ? fetchConnection(connectionId) : Promise.resolve(null),
    ])
      .then(([list, map, conns, existing]) => {
        if (!active) return;
        setProviders(list);
        setSchemas(map);
        setConnections(conns);

        if (existing) {
          const provider =
            list.find((p) => p.id === existing.Provider) || {
              id: existing.Provider,
              name: providerLabel(existing.Provider),
              description: "",
              type: "cloud",
            };
          const schema = map[existing.Provider] || provider.schema || [];
          const config = existing.Config
            ? (JSON.parse(existing.Config) as Record<string, unknown>)
            : {};
          const prefilled: Record<string, unknown> = {};
          schema.forEach((f) => {
            if (!f.secret && config[f.key] !== undefined) {
              prefilled[f.key] = config[f.key];
            }
            if (f.type === "boolean" && prefilled[f.key] === undefined) {
              prefilled[f.key] = f.secret ? false : (config[f.key] ?? false);
            }
          });
          setSelected(provider);
          setName(existing.Name);
          setValues(prefilled);
          setStep(2);

          // Fetch decrypted config (including secrets) for editing
          fetchConnectionConfig(existing.ID).then((cfg) => {
            if (!active) return;
            schema.forEach((f) => {
              if (f.secret && cfg.secret && cfg.secret[f.key] !== undefined) {
                setValues((v) => ({ ...v, [f.key]: cfg.secret[f.key] }));
              }
            });
          }).catch(() => {
            // Ignore errors - secret fields will just be empty
          });
        } else if (preselect) {
          // Deep link from the providers list ("+" on a provider group).
          const known = Object.keys(map);
          const p = list.find(
            (x) =>
              x.id === preselect &&
              (known.length === 0 || map[x.id] !== undefined),
          );
          if (p) {
            const schema = map[p.id] || p.schema || [];
            const defaults: Record<string, unknown> = {};
            schema.forEach((f) => {
              if (f.default) defaults[f.key] = f.default;
              if (f.type === "boolean" && !f.default) defaults[f.key] = false;
            });
            setSelected(p);
            setName(`${p.id}-connection`);
            setValues(defaults);
            setStep(2);
          }
        }
      })
      .catch((e: unknown) =>
        active && setError(e instanceof Error ? e.message : "Failed to load."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [connectionId, preselect]);

  const available = useMemo(() => {
    if (!providers.length) return [];
    const known = Object.keys(schemas);
    if (known.length === 0) return providers;
    return providers.filter((p) => schemas[p.id] !== undefined);
  }, [providers, schemas]);

  const fields = useMemo(
    () => {
      if (!selected) return [];
      const allFields = schemas[selected.id] || selected.schema || [];
      // Filter out "name" field from schema since we have a dedicated Connection Name input
      return allFields.filter((f) => f.key !== "name");
    },
    [selected, schemas],
  );

  const nameTaken = useMemo(() => {
    if (!selected) return false;
    return connections.some(
      (c) =>
        c.ID !== connectionId &&
        c.Provider === selected.id &&
        c.Name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  }, [connections, selected, name, connectionId]);

  const requiredFields = useMemo(
    () => fields.filter((f) => f.required),
    [fields],
  );

  const filledRequired = useMemo(
    () =>
      requiredFields.filter((f) => {
        if (f.type === "file") return Boolean(files[f.key]);
        const v = values[f.key];
        return v !== undefined && v !== null && v !== "";
      }).length,
    [requiredFields, values, files],
  );

  const canConnect = useMemo(() => {
    if (!name.trim() || nameTaken) return false;
    return filledRequired === requiredFields.length;
  }, [name, nameTaken, filledRequired, requiredFields]);

  function chooseProvider(p: ProviderCapability) {
    // Editing locks the provider: switching would orphan the connection id
    // (provider is immutable on update). Create a new connection instead.
    if (isEdit) return;
    setSelected(p);
    setName(`${p.id}-connection`);
    setFiles({});
    setError("");
    setStatus("idle");
    const schema = schemas[p.id] || p.schema || [];
    const defaults: Record<string, unknown> = {};
    schema.forEach((f) => {
      if (f.default) defaults[f.key] = f.default;
      if (f.type === "boolean" && !f.default) defaults[f.key] = false;
    });
    setValues(defaults);
    setStep(2);
  }

  async function handleSubmit() {
    if (!selected) return;
    setError("");
    try {
      setStatus("verifying");
      const result = await verifyConnectionInput(
        selected.id,
        fields,
        values,
        files,
      );
      if (!result.verified) {
        setStatus("error");
        setError(result.error || "Credentials could not be verified.");
        return;
      }

      setStatus("saving");
      let conn: ProviderConnection;
      if (isEdit && connectionId) {
        conn = await updateConnection(
          connectionId,
          selected.id,
          name.trim(),
          fields,
          values,
          files,
        );
        // Mandatory re-verify after a save so the stored status is always fresh.
        await reverifyConnection(connectionId);
        conn = { ...conn, Status: "verified" };
      } else {
        conn = await createConnection(
          selected.id,
          name.trim(),
          fields,
          values,
          files,
        );
      }
      setCreated(conn);
      setStatus("success");
      setStep(3);
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to save provider.");
    }
  }

  const busy = status === "verifying" || status === "saving";

  return (
    <div className="mx-auto w-full max-w-[1360px]">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.03em]">
            {isEdit
              ? `Edit ${selected?.name ?? "provider"}`
              : selected
                ? `Connect ${selected.name}`
                : "Connect a provider"}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-mut2">
            Step {step} of 3 ·{" "}
            {step === 1
              ? "Select a cloud or compute provider"
              : step === 2
                ? isEdit
                  ? "Update credentials, then save to re-verify"
                  : "Enter credentials and configuration"
                : "Done"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          disabled={busy}
          onClick={() => {
            if (isEdit) {
              router.push(orgHref("/providers"));
              return;
            }
            if (step > 1) setStep(step - 1);
            else router.push(orgHref("/providers"));
          }}
        >
          <ArrowLeft className="size-4" strokeWidth={1.7} />
          {isEdit ? "Back to providers" : step > 1 ? "Back" : "Providers"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2.5 py-16 text-[13px] text-mut">
          <span className="size-4 animate-spin rounded-full border-2 border-line2 border-t-accent" />
          Loading providers…
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* ===== Left: main content ===== */}
          <div className="space-y-5">
            {step === 1 ? (
              <>
                <section className={K.dbx}>
                  <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
                    <h3 className="text-[15px] font-semibold tracking-[-.01em]">
                      Available providers
                    </h3>
                    <span className="text-[13px] text-mut">
                      {available.length} connectable
                    </span>
                  </div>
                  <div className={K.inner}>
                    {available.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => chooseProvider(p)}
                        className="grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-fg/[.03]"
                      >
                        <span className="grid size-[30px] flex-none place-items-center rounded-[9px] border border-line bg-card">
                          <Logo name={p.id} size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <b className="truncate text-[13.5px] font-medium">
                              {p.name}
                            </b>
                            <span className={cn(K.pill, "capitalize")}>
                              {p.type}
                            </span>
                          </span>
                          <small className="block truncate text-[12.5px] text-mut">
                            {p.description || "Connect this provider to Orcien."}
                          </small>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="flex gap-1.5 max-md:hidden">
                            {(p.features ?? []).slice(0, 2).map((feat) => (
                              <span key={feat} className={K.pill}>
                                {feat}
                              </span>
                            ))}
                          </span>
                          <ChevronRight
                            className="size-4 text-mut"
                            strokeWidth={1.7}
                          />
                        </span>
                      </button>
                    ))}
                    {available.length === 0 && (
                      <div className={cn(K.kv, "text-mut")}>
                        No connectable providers available.
                      </div>
                    )}
                  </div>
                </section>

                {/* Bottom explainer — cures the "plain" step-1 feel without a revamp */}
                <section className={K.dbx}>
                  <div className="px-3 pb-2.5 pt-3">
                    <h3 className="text-[13px] font-semibold tracking-[-.01em]">What happens next</h3>
                    <p className="mt-0.5 text-[12px] text-mut">Picked provider controls the fields on the next screen.</p>
                  </div>
                  <div className={K.inner}>
                    <div className={cn(K.kv, "items-start gap-3 py-3")}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-card text-mut2">1</span>
                      <span className="min-w-0">
                        <b className="block text-[12.5px] font-medium">Choose & continue</b>
                        <span className="block text-[12px] leading-snug text-mut">Click any provider above — we’ll preload its credential schema.</span>
                      </span>
                    </div>
                    <div className={cn(K.kv, "items-start gap-3 py-3")}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-card text-mut2">2</span>
                      <span className="min-w-0">
                        <b className="block text-[12.5px] font-medium">Stored securely</b>
                        <span className="block text-[12px] leading-snug text-mut">Secrets are encrypted at rest and never shown again in plain text.</span>
                      </span>
                    </div>
                    <div className={cn(K.kv, "items-start gap-3 py-3")}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-card text-mut2">3</span>
                      <span className="min-w-0">
                        <b className="block text-[12.5px] font-medium">Live verification</b>
                        <span className="block text-[12px] leading-snug text-mut">We ping the provider with your credentials before the connection is saved.</span>
                      </span>
                    </div>
                  </div>
                </section>
              </>
            ) : step === 2 && selected ? (
              <section className={K.dbx}>
                <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
                  <h3 className="text-[15px] font-semibold tracking-[-.01em]">
                    Connection details
                  </h3>
                  <span className="text-[13px] text-mut">
                    {isEdit ? "Update credentials & configuration" : "Credentials & configuration"}
                  </span>
                </div>

                <div className={cn(K.inner, "grid gap-4 p-5")}>
                  <div className="grid gap-1.5">
                    <label className={K.lbl}>
                      Connection name <span className="text-bad">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`${selected.id}-connection`}
                      aria-invalid={nameTaken || undefined}
                      className="font-mono text-[13px]"
                    />
                    {nameTaken && (
                      <p className="text-xs text-bad">
                        A {providerLabel(selected.id)} connection with this name
                        already exists.
                      </p>
                    )}
                  </div>

                  {fields.length === 0 ? (
                    <p className="text-[13px] text-mut">
                      This provider does not require any credentials.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {fields.map((field) => {
                        const isArray = field.type === "json_array" || field.type === "string_array" || field.type === "number_array";
                        return (
                          <div key={field.key} className={`grid content-start gap-1.5 ${isArray ? "sm:col-span-2" : ""}`}>
                            <label className={K.lbl}>
                              {field.name}
                              {field.required && (
                                <span className="ml-0.5 text-bad">*</span>
                              )}
                            </label>
                            {isArray ? (
                              <JsonArrayInput
                                value={values[field.key] as string}
                                onChange={(value) => setValues((v) => ({ ...v, [field.key]: value }))}
                                schema={field.array_item_schema || { type: "object" }}
                                addButtonLabel={field.placeholder || "Add Item"}
                                emptyMessage={field.description || "No items yet"}
                              />
                            ) : (
                              <ProviderFieldInput
                                field={field}
                                value={values[field.key]}
                                file={files[field.key] || null}
                                onChange={(key, value) =>
                                  setValues((v) => ({ ...v, [key]: value }))
                                }
                                onFileChange={(key, file) =>
                                  setFiles((f) => {
                                    const next = { ...f };
                                    if (file) next[key] = file;
                                    else delete next[key];
                                    return next;
                                  })
                                }
                              />
                            )}
                            {field.description && (
                              <p className="text-xs text-mut">{field.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-[13px] text-bad">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.7} />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className={K.dbx}>
                <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
                  <h3 className="text-[15px] font-semibold tracking-[-.01em]">
                    {isEdit ? "Provider updated" : "Provider connected"}
                  </h3>
                  <span className={K.ok}>
                    <i className="size-1.5 rounded-full bg-current" />
                    Verified
                  </span>
                </div>
                <div className={cn(K.inner, "p-8 text-center")}>
                  <div className="mx-auto grid size-12 place-items-center rounded-full border border-ok/25 bg-ok/10">
                    <Check className="size-6 text-ok" strokeWidth={1.7} />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold tracking-[-.02em]">
                    {providerLabel(created?.Provider || selected?.id || "")} is
                    ready to use
                  </h2>
                  <p className="mt-1 text-[13px] text-mut2">
                    Credentials were verified and the connection has been{" "}
                    {isEdit ? "updated" : "saved"}.
                  </p>

                  <div className="mx-auto mt-5 max-w-md overflow-hidden rounded-xl border border-line bg-band text-left">
                    <Row label="Connection" value={created?.Name || name} />
                    <Row
                      label="Provider"
                      value={providerLabel(created?.Provider || selected?.id || "")}
                    />
                    <Row label="Status" value={created?.Status || "verified"} success />
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ===== Right: summary rail ===== */}
          <aside className="xl:sticky xl:top-[76px]">
            {step === 2 && selected ? (
              <AsideCard
                title="Connection"
                right={
                  <span className={canConnect ? K.ok : K.off}>
                    {canConnect ? "Ready" : "Incomplete"}
                  </span>
                }
                footer={
                  <>
                    <Button
                      className="w-full"
                      onClick={handleSubmit}
                      disabled={!canConnect || busy}
                    >
                      {busy && (
                        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
                      )}
                      {busy
                        ? status === "verifying"
                          ? "Verifying…"
                          : "Saving…"
                        : isEdit
                          ? "Save & Verify"
                          : "Connect"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={busy}
                      onClick={() =>
                        isEdit ? router.push(orgHref("/providers")) : setStep(1)
                      }
                    >
                      <ArrowLeft className="size-4" strokeWidth={1.7} /> Back
                    </Button>
                  </>
                }
              >
                <div className={K.kv}>
                  <span className="flex-1 text-mut2">Provider</span>
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <Logo name={selected.id} size={14} />
                    <span className="truncate">{selected.name}</span>
                  </span>
                </div>
                <div className={K.kv}>
                  <span className="flex-1 text-mut2">Type</span>
                  <b className="font-medium capitalize">{selected.type}</b>
                </div>
                <div className={K.kv}>
                  <span className="flex-1 text-mut2">Name</span>
                  <b className="max-w-[160px] truncate font-mono text-[12.5px] font-medium">
                    {name || "—"}
                  </b>
                </div>
                <div className={K.kv}>
                  <span className="flex-1 text-mut2">Required fields</span>
                  <b className="font-medium">
                    {filledRequired} / {requiredFields.length}
                  </b>
                </div>
              </AsideCard>
            ) : step >= 3 ? (
              <AsideCard
                title="Next steps"
                footer={
                  <>
                    <Button
                      className="w-full"
                      onClick={() => router.push(orgHref("/providers"))}
                    >
                      Back to providers
                    </Button>
                    {!isEdit && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          setStep(1);
                          setSelected(null);
                          setCreated(null);
                          setStatus("idle");
                          setError("");
                        }}
                      >
                        Add another provider
                      </Button>
                    )}
                  </>
                }
              >
                <div className={cn(K.kv, "text-mut2")}>
                  Deploy workloads on this connection from the Deployments page.
                </div>
              </AsideCard>
            ) : null}
            <StepsCard step={step} isEdit={isEdit} providerName={selected?.name} />
          </aside>
        </div>
      )}
    </div>
  );
}

function StepsCard({
  step,
  isEdit,
  providerName,
}: {
  step: number;
  isEdit?: boolean;
  providerName?: string;
}) {
  const items = [
    {
      id: 1,
      title: "Select provider",
      desc: isEdit && providerName ? `Editing ${providerName} — locked` : providerName ? `Picked ${providerName}` : "Choose the provider to connect",
    },
    {
      id: 2,
      title: isEdit ? "Update credentials" : "Configure access",
      desc: "Required fields vary by provider",
    },
    {
      id: 3,
      title: "Verify & save",
      desc: `We test the key then ${isEdit ? "re-save" : "save"} it encrypted`,
    },
  ];

  return (
    <AsideCard title="Steps" right={<span className={K.pill}>{step} / 3</span>}>
      {items.map((it) => {
        const isDone = step > it.id;
        const isCurrent = step === it.id;
        return (
          <div key={it.id} className={cn(K.kv, "items-start gap-3 !py-3")}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold leading-none",
                isDone
                  ? "border-ok/20 bg-ok text-white"
                  : isCurrent
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-line2 bg-card text-mut",
              )}
            >
              {isDone ? <Check className="size-3.5" strokeWidth={2.5} /> : it.id}
            </span>
            <span className="min-w-0">
              <b className={cn("block text-[12.5px] leading-tight", isCurrent ? "text-fg" : isDone ? "text-fg/90" : "text-mut2")}>
                {it.title}
              </b>
              <span className="block text-[11.5px] leading-snug text-mut">{it.desc}</span>
            </span>
            {isCurrent && (
              <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-accent px-2 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">Current</span>
            )}
          </div>
        );
      })}
      <div className="border-t border-line bg-band/40 px-4 py-2.5 text-[11px] leading-snug text-mut">
        {isEdit ? (
          <>Editing keeps the same connection ID — create a new connection to change provider.</>
        ) : step === 1 ? (
          <>Fields and validation on the next screen are driven by the provider you pick.</>
        ) : step === 2 ? (
          <>Secrets stay encrypted at rest; they’re only sent for verification when you click Connect.</>
        ) : (
          <>Connection ready — use it when deploying models or workloads.</>
        )}
      </div>
    </AsideCard>
  );
}

function Row({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className={K.kv}>
      <span className="flex-1 text-mut2">{label}</span>
      <span className="flex items-center gap-1.5 font-medium">
        {success && <span className="size-1.5 rounded-full bg-ok" />}
        {value}
      </span>
    </div>
  );
}
