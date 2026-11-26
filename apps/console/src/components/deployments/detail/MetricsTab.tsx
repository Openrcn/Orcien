import { Activity } from "lucide-react";
import { DetailCard } from "@/components/deployments/detail/DetailCard";

export function MetricsTab() {
  return (
    <DetailCard
      title="Metrics"
      subtitle="Traffic, latency and throughput"
      icon={<Activity className="size-[15px]" strokeWidth={1.7} />}
    >
      <div className="grid min-h-[320px] place-items-center p-8">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-full border border-line bg-band text-mut2">
            <Activity className="size-5" strokeWidth={1.7} />
          </div>
          <h2 className="mt-4 text-[15px] font-semibold text-fg">
            Metrics coming soon
          </h2>
          <p className="mt-1.5 text-[12.5px] text-mut2">
            Deployment traffic, latency and throughput numbers will show up
            here.
          </p>
        </div>
      </div>
    </DetailCard>
  );
}
