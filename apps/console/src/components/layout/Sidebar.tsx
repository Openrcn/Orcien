"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useOrgHref, useOrg } from "@/lib/org";
import { Layers, Cpu, Cloud, Box, type LucideIcon } from "lucide-react";

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-label="Orcien logo"
      className="flex-none"
    >
      <defs>
        <linearGradient id="orcn-mk" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--logo1)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo2)" }} />
        </linearGradient>
      </defs>
      <path
        fill="url(#orcn-mk)"
        fillRule="evenodd"
        d="M256 83a171 171 0 0 1 0 342v-53a118 118 0 1 0-118-118H85A171 171 0 0 1 256 83Z"
      />
      <path fill="url(#orcn-mk)" d="M138 254h118v118h-53v-65h-65z" />
      <path
        fill="url(#orcn-mk)"
        fillRule="evenodd"
        d="M85 307h118v118H85zM138 307h65v65h-65z"
      />
    </svg>
  );
}

function SectionLabel({
  children,
  isCollapsed,
  first,
}: {
  children: string;
  isCollapsed: boolean;
  first?: boolean;
}) {
  if (isCollapsed) {
    return (
      <div
        className={cn(
          "mx-auto w-6 border-t border-line",
          first ? "mb-3 mt-[18px]" : "my-3",
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "px-3 pb-2 text-xs font-medium uppercase tracking-wide text-mut",
        first ? "pt-[18px]" : "pt-6",
      )}
    >
      {children}
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  isCollapsed,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  isCollapsed: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={isCollapsed ? label : undefined}
      className={cn(
        "group relative mb-1 flex h-10 items-center gap-[13px] rounded-[10px] border text-[14.5px] transition",
        active
          ? "border-line2 bg-card font-medium text-fg"
          : "border-transparent text-mut2 hover:bg-fg/5 hover:text-fg",
        isCollapsed ? "mx-auto w-10 justify-center" : "px-3",
      )}
    >
      <Icon className="size-[18px] flex-none" strokeWidth={1.7} />
      {!isCollapsed && <span className="truncate">{label}</span>}
      {isCollapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-full border border-line2 bg-card px-3 py-1 text-xs font-medium text-fg opacity-0 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.5)] transition duration-150 group-hover:translate-x-0 group-hover:opacity-100">
          {label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ isCollapsed }: any) {
  const pathname = usePathname();
  const { slug } = useOrg();
  const orgHref = useOrgHref();
  // Org-scoped prefix for activity matching (e.g. "/acme").
  const base = slug ? `/${slug}` : "";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-line bg-bg transition-[width] duration-200",
        isCollapsed ? "w-[72px] px-3" : "w-[264px] px-4",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "-mx-4 flex h-14 flex-none items-center gap-2.5 border-b border-line px-5",
          isCollapsed && "-mx-3 justify-center px-0",
        )}
      >
        <BrandMark />
        {!isCollapsed && (
          <span className="text-[13px] font-bold tracking-[.16em]">ORCIEN</span>
        )}
      </div>

      {/* Nav — overflow stays visible when collapsed so tooltips can escape */}
      <nav
        className={cn(
          "flex-1 pb-3",
          isCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden",
        )}
      >
        <SectionLabel isCollapsed={isCollapsed} first>
          Deploy
        </SectionLabel>
        <NavItem
          href={orgHref("/deployments")}
          icon={Layers}
          label="Deployments"
          isCollapsed={isCollapsed}
          active={
            base
              ? pathname.startsWith(`${base}/deployments`) ||
                pathname === `${base}/`
              : pathname.startsWith("/deployments") || pathname === "/"
          }
        />
        <NavItem
          href={orgHref("/models")}
          icon={Cpu}
          label="AI models"
          isCollapsed={isCollapsed}
          active={pathname.startsWith(`${base}/models`)}
        />

        <SectionLabel isCollapsed={isCollapsed}>Configuration</SectionLabel>
        <NavItem
          href={orgHref("/providers")}
          icon={Cloud}
          label="Providers"
          isCollapsed={isCollapsed}
          active={pathname.startsWith(`${base}/providers`)}
        />
        <NavItem
          href={orgHref("/templates")}
          icon={Box}
          label="Templates"
          isCollapsed={isCollapsed}
          active={pathname.startsWith(`${base}/templates`)}
        />
      </nav>

      {/* User footer */}
      <div
        className={cn(
          "-mx-4 flex h-[72px] flex-none items-center border-t border-line px-5",
          isCollapsed && "-mx-3 justify-center px-3",
        )}
      >
        <button
          type="button"
          title="User profile"
          className={cn(
            "flex cursor-pointer items-center gap-3 transition",
            isCollapsed
              ? "mx-auto rounded-full hover:brightness-110"
              : "w-full rounded-xl p-1.5 hover:bg-fg/5",
          )}
        >
          <span className="grid size-[34px] flex-none place-items-center rounded-full border border-line2 bg-accent/10 font-mono text-xs">
            V
          </span>
          {!isCollapsed && (
            <span className="min-w-0 flex-1 text-left leading-tight">
              <b className="block text-sm font-medium">Vinit</b>
              <span className="block truncate text-xs text-mut">
                {slug ?? "orcien.cloud"}
              </span>
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
