"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Container,
  Cpu,
  GitBranch,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Terminal,
  Variable,
} from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";

/* ─── small neutral kit chip ─────────────────────────────── */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-line bg-card px-2 py-0.5 text-[10.5px] font-medium text-mut2">
      {children}
    </span>
  );
}

/* ─── info tile ──────────────────────────────────────────── */
function InfoTile({
  label,
  value,
  mono = false,
  copy = false,
  wide = false,
}: {
  label: string;
  value?: string | number | boolean | null;
  mono?: boolean;
  copy?: boolean;
  wide?: boolean;
}) {
  if (value === undefined || value === null || value === "") return null;
  const display = String(value);
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-lg border border-line bg-field px-3 py-2.5 ${wide ? "col-span-2" : ""}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-mut2">
        {label}
      </span>
      <span
        className={`flex items-center gap-1.5 break-all text-[12px] font-medium text-fg ${mono ? "font-mono" : ""}`}
      >
        {display}
        {copy && <CopyButton value={display} size={11} />}
      </span>
    </div>
  );
}

/* ─── top-level kit section card (static header, never collapses) ── */
function SectionLabel({
  icon: Icon,
  title,
  count,
}: {
  icon: any;
  title: string;
  count?: number;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <Icon size={12} className="shrink-0 text-mut2" strokeWidth={1.7} />
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-mut">
        {title}
      </span>
      {count !== undefined && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-line bg-card px-2 py-0.5 text-[10.5px] font-medium text-mut2">
          {count}
        </span>
      )}
    </div>
  );
}

/* ─── labelled sub-section inside a container ────────────── */
function SubSection({
  icon: Icon,
  title,
  count,
  defaultOpen = true,
  children,
}: {
  icon: any;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-mut transition hover:text-fg"
        >
          {open ? (
            <ChevronDown size={12} className="text-mut2" />
          ) : (
            <ChevronRight size={12} className="text-mut2" />
          )}
          <Icon size={12} className="text-mut2" strokeWidth={1.7} />
          {title}
        </button>
        {count !== undefined && <Tag>{count}</Tag>}
      </div>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

/* ─── env vars table ────────────────────────────────────── */
function EnvVarsSection({ env }: { env: Record<string, string> }) {
  const entries = Object.entries(env);
  if (!entries.length) return null;
  const isSensitive = (k: string) =>
    /secret|password|token|key|auth|credential/i.test(k);

  return (
    <SubSection
      icon={Variable}
      title="Environment Variables"
      count={entries.length}
      defaultOpen={false}
    >
      <div className="rounded-lg border border-line bg-field">
        {/* header row */}
        <div className="grid grid-cols-[1fr_2fr] border-b border-line bg-band px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-mut2">
          <span>Key</span>
          <span>Value</span>
        </div>
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[1fr_2fr] items-center border-b border-line/60 px-3 py-2 text-[11px] last:border-b-0"
          >
            <span className="truncate pr-2 font-mono font-semibold text-sky-400">
              {k}
            </span>
            {isSensitive(k) ? (
              <span className="flex items-center gap-1 text-mut2">
                <Lock size={10} />
                <span className="font-mono">••••••••</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 break-all font-mono text-emerald-400">
                {v || <span className="italic text-mut2">empty</span>}
                {v && <CopyButton value={v} size={10} />}
              </span>
            )}
          </div>
        ))}
      </div>
    </SubSection>
  );
}

/* ─── ports ─────────────────────────────────────────────── */
function PortsSection({ expose }: { expose: any[] }) {
  if (!expose?.length) return null;
  return (
    <SubSection icon={Globe} title="Exposed Ports" count={expose.length}>
      <div className="flex flex-wrap gap-2">
        {expose.map((p: any, i: number) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-line bg-field px-2.5 py-1.5 text-[11px]"
          >
            <span className="font-mono font-semibold text-fg">{p.port}</span>
            <span className="text-[10px] uppercase text-mut2">
              {p.protocol || "tcp"}
            </span>
            {p.is_public && <Tag>public</Tag>}
          </div>
        ))}
      </div>
    </SubSection>
  );
}

/* ─── volume mounts ─────────────────────────────────────── */
function MountsSection({ mounts }: { mounts: any[] }) {
  if (!mounts?.length) return null;
  return (
    <SubSection icon={HardDrive} title="Volume Mounts" count={mounts.length}>
      <div className="rounded-lg border border-line bg-field">
        <div className="grid grid-cols-2 border-b border-line bg-band px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-mut2">
          <span>Volume Name</span>
          <span>Mount Path</span>
        </div>
        {mounts.map((m: any, i: number) => (
          <div
            key={i}
            className="grid grid-cols-2 items-center border-b border-line/60 px-3 py-2 font-mono text-[11px] last:border-b-0"
          >
            <span className="truncate pr-2 text-amber-400">
              {m.volume_name || m.name}
            </span>
            <span className="text-fg">{m.mount_path}</span>
          </div>
        ))}
      </div>
    </SubSection>
  );
}

/* ─── resources/weights ─────────────────────────────────── */
function ResourcesSection({ resources }: { resources: any[] }) {
  if (!resources?.length) return null;
  return (
    <SubSection
      icon={GitBranch}
      title="Resources / Weights"
      count={resources.length}
      defaultOpen={false}
    >
      <div className="flex flex-col gap-2">
        {resources.map((r: any, i: number) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-field px-3 py-2.5"
          >
            <div className="mb-1 flex items-center gap-2">
              <Tag>{r.type || "HF"}</Tag>
              <span className="flex-1 break-all font-mono text-[11px] text-sky-400">
                {r.url}
              </span>
              {r.url && <CopyButton value={r.url} size={10} />}
            </div>
            {r.target && (
              <div className="flex items-center gap-1 text-[11px] text-mut2">
                <span>→</span>
                <span className="font-mono text-fg">{r.target}</span>
              </div>
            )}
            {r.files?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {r.files.map((f: string, fi: number) => (
                  <span
                    key={fi}
                    className="rounded border border-line bg-card px-1.5 py-0.5 font-mono text-[10px] text-mut2"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </SubSection>
  );
}

/* ─── single container card ─────────────────────────────── */
function ContainerCard({
  container,
  index,
}: {
  container: any;
  index: number;
}) {
  const [open, setOpen] = useState(true);
  const args = container.args || {};
  const image: string = args.image || container.image || "";
  const cmd: string[] = args.cmd || [];
  const entrypoint: string[] = args.entrypoint || [];
  const env: Record<string, string> = args.env || {};
  const expose: any[] = args.expose || [];
  const mounts: any[] = args.volume_mounts || [];
  const resources: any[] = args.resources || [];
  const gpu: boolean = args.gpu ?? false;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      {/* container header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-field"
      >
        {open ? (
          <ChevronDown
            size={14}
            className="shrink-0 text-mut2"
          />
        ) : (
          <ChevronRight
            size={14}
            className="shrink-0 text-mut2"
          />
        )}
        <Container size={15} className="shrink-0 text-mut2" strokeWidth={1.7} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-bold text-fg">
              {container.id || `container-${index + 1}`}
            </span>
            {gpu && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-band px-2 py-0.5 text-[10px] font-medium text-purple-400">
                <Cpu size={9} /> GPU
              </span>
            )}
          </div>
          {image && (
            <span className="mt-0.5 block truncate font-mono text-[11px] text-mut2">
              {image}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-3.5 py-3">
          {/* ── Core info grid ── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <InfoTile
              label="Image"
              value={image}
              mono
              copy
              wide={!entrypoint.length && !cmd.length}
            />
            {entrypoint.length > 0 && (
              <InfoTile
                label="Entrypoint"
                value={entrypoint.join(" ")}
                mono
                copy
              />
            )}
            {gpu !== undefined && (
              <InfoTile label="GPU" value={gpu ? "Enabled" : "Disabled"} />
            )}
          </div>

          {/* ── Command box (full-width) ── */}
          {cmd.length > 0 && (
            <div className="rounded-lg border border-line bg-field px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-mut2">
                <Terminal size={10} />
                Command
              </div>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all font-mono text-[12px] text-fg">
                  {cmd.join(" ")}
                </code>
                <CopyButton value={cmd.join(" ")} size={11} />
              </div>
            </div>
          )}

          {/* ── Sub-sections ── */}
          <div className="flex flex-col gap-3">
            <EnvVarsSection env={env} />
            <PortsSection expose={expose} />
            <MountsSection mounts={mounts} />
            <ResourcesSection resources={resources} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── top-level volumes (storage) ───────────────────────── */
function StorageVolumes({ volumes }: { volumes: any[] }) {
  if (!volumes?.length) return null;
  return (
    <div>
      <SectionLabel icon={HardDrive} title="Storage Volumes" count={volumes.length} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {volumes.map((v: any, i: number) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-lg border border-line bg-field px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-fg">
                {v.name}
              </span>
              <Tag>{v.type || "persistent"}</Tag>
            </div>
            {v.size_gb && (
              <span className="text-[11px] text-mut2">{v.size_gb} GB</span>
            )}
            {v.host_path && (
              <span className="truncate font-mono text-[10px] text-mut2">
                {v.host_path}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── content check: does this config render anything? ──── */
export function specHasContent(config: any): boolean {
  if (!config || typeof config !== "object") return false;
  const containers = Array.isArray(config.containers)
    ? config.containers
    : [];
  const volumes = Array.isArray(config.volumes) ? config.volumes : [];
  const meta = config.meta || {};
  if (containers.length > 0 || volumes.length > 0) return true;
  return Boolean(
    config.name ||
      config.type ||
      config.version ||
      config.computeType ||
      meta.trigger,
  );
}

/* ─── main export ───────────────────────────────────────── */
export function SpecViewer({ config }: { config: any }) {
  if (!config) return null;

  const containers: any[] = config.containers || [];
  const volumes: any[] = config.volumes || [];
  const meta: any = config.meta || {};

  const overviewTiles = [
    { label: "Name", value: config.name, copy: true },
    { label: "Type", value: config.type },
    { label: "Version", value: config.version },
    { label: "Compute Type", value: config.computeType },
    ...(meta.trigger ? [{ label: "Trigger", value: meta.trigger }] : []),
  ].filter((t) => t.value !== undefined && t.value !== null && t.value !== "");

  if (!overviewTiles.length && !containers.length && !volumes.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-3.5">
      {/* ── Overview grid ── */}
      {overviewTiles.length > 0 && (
        <>
          <SectionLabel icon={Layers} title="Overview" />
          <div className="-mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {overviewTiles.map((t) => (
              <InfoTile key={t.label} label={t.label} value={t.value} copy={t.copy} />
            ))}
          </div>
        </>
      )}

      {/* ── Storage Volumes ── */}
      <StorageVolumes volumes={volumes} />

      {/* ── Containers ── */}
      {containers.length > 0 && (
        <div>
          <SectionLabel icon={Box} title="Containers" count={containers.length} />
          <div className="flex flex-col gap-2.5">
            {containers.map((c, i) => (
              <ContainerCard key={c.id || i} container={c} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
