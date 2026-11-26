import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { DetailCard } from "@/components/deployments/detail/DetailCard";

export function MetricTile({
  label,
  value,
  meta,
  hint,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  meta: string;
  hint?: string;
  icon?: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-line bg-card p-3.5 text-left [box-shadow:var(--sh)] transition hover:border-line2 hover:bg-field"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-mut">
          {label}
        </span>
        {Icon && (
          <span className="grid size-6 place-items-center rounded-lg border border-line bg-band text-mut2 transition group-hover:text-fg">
            <Icon className="size-3.5" strokeWidth={1.7} />
          </span>
        )}
      </div>
      <div className="text-[22px] font-semibold leading-none tracking-[-.02em] text-fg">
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-mut">{meta}</div>
      {hint && (
        <div className="mt-2.5 flex items-center gap-1 border-t border-line pt-2 text-[11px] font-medium text-mut2 transition group-hover:text-accent-t">
          {hint}
          <ArrowUpRight className="size-3" strokeWidth={1.7} />
        </div>
      )}
    </button>
  );
}

/* low-opacity gray placeholder graph — kit style */
export function FakeGraph({ dashed = false }: { dashed?: boolean }) {
  return (
    <svg
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full text-mut opacity-40"
      fill="none"
    >
      {dashed ? (
        <polyline
          points="0,52 25,50 50,46 75,48 100,40 125,44 150,38 175,42 200,36"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      ) : (
        <polyline
          points="0,48 20,40 40,44 60,30 80,34 100,22 120,28 140,18 160,26 180,14 200,20"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <DetailCard
      title={title}
      subtitle={subtitle}
      action={action}
      className={className}
      bodyClassName={bodyClassName}
    >
      {children}
    </DetailCard>
  );
}

/* Kit status pill — matches the shared badge kit (Healthy / Invited / Failed / Draft) */
const PILL_TONES: Record<string, string> = {
  RUNNING: "border-ok/25 bg-ok/10 text-ok",
  READY: "border-ok/25 bg-ok/10 text-ok",
  HEALTHY: "border-ok/25 bg-ok/10 text-ok",
  COMPLETED: "border-ok/25 bg-ok/10 text-ok",
  ONLINE: "border-ok/25 bg-ok/10 text-ok",
  PARTIAL: "border-warn/25 bg-warn/10 text-warn",
  PENDING: "border-warn/25 bg-warn/10 text-warn",
  SCALING: "border-warn/25 bg-warn/10 text-warn",
  INVITED: "border-warn/25 bg-warn/10 text-warn",
  STOPPED: "border-bad/25 bg-bad/10 text-bad",
  FAILED: "border-bad/25 bg-bad/10 text-bad",
  ERROR: "border-bad/25 bg-bad/10 text-bad",
};

export function StatusPill({ status }: { status?: string | null }) {
  const value = (status || "UNKNOWN").toUpperCase();
  const tone = PILL_TONES[value] || "border-line bg-card text-mut2";
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border ${tone} px-[9px] text-[11.5px]`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}

export function shortNodeId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

// Must match the gateway ingress slug rules ([^a-z0-9-] -> "-").
export function slugifyDeployment(name: string) {
  return String(name || "deployment")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
}
