import { Activity } from "lucide-react";

export function MetricsTab() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)]">
      <div className="flex flex-col items-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-hover)]">
          <Activity className="size-6 text-[var(--text-muted)]" />
        </div>
        <h2 className="mt-5 text-lg font-bold tracking-tight text-[var(--text-main)]">
          Metrics coming soon
        </h2>
        <p className="mt-2 max-w-xs text-[11px] text-[var(--text-light)]">
          Deployment traffic, latency and throughput numbers will show up here.
        </p>
      </div>
    </div>
  );
}
