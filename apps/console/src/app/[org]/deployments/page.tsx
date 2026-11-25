"use client";

import { DeploymentTable } from "@/components/deployments/DeploymentTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Boxes, ChevronDown, Plus, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOrgHref } from "@/lib/org";

export default function DeploymentsPage() {
  const router = useRouter();
  const orgHref = useOrgHref();

  return (
    <div className="mx-auto w-full max-w-[1360px]">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-.03em]">
            Deployments
          </h1>
          <p className="mt-1.5 text-[13.5px] text-mut2">
            Manage and monitor your model deployments across infrastructure.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto group gb inline-flex h-8 items-stretch overflow-hidden rounded-full text-[13px] font-medium text-fg shadow-[inset_0_1px_0_var(--hi)] transition hover:brightness-110">
            <span className="inline-flex items-center gap-1.5 px-3.5">
              <Plus className="size-4" strokeWidth={1.7} />
              Create
            </span>
            <span className="mx-0.5 my-1.5 w-px shrink-0 bg-fg/20" />
            <span className="inline-flex items-center px-2.5">
              <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[popup-open]:rotate-180" strokeWidth={1.7} />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="mt-2 w-60 p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-mut">
                Create new
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => router.push(orgHref("/workloads/create"))}
                className="items-start gap-2.5 rounded-[9px] px-2 py-2"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-[9px] border border-line bg-band text-mut2">
                  <Boxes className="size-3.5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium">Workload</span>
                  <span className="text-[11px] leading-snug text-mut">
                    Create a deployment from a workload template
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(orgHref("/models/deploy"))}
                className="items-start gap-2.5 rounded-[9px] px-2 py-2"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-[9px] border border-line bg-band text-mut2">
                  <Zap className="size-3.5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium">AI Model</span>
                  <span className="text-[11px] leading-snug text-mut">
                    Deploy any Hugging Face model with a runtime
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeploymentTable />
    </div>
  );
}
