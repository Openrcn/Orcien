"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, Search, Sun, Moon } from "lucide-react";
import { useOrg } from "@/lib/org";

const SECTION_LABELS: Record<string, string> = {
  deployments: "Deployments",
  models: "AI models",
  providers: "Providers",
  templates: "Templates",
};

function labelFor(segment: string) {
  return (
    SECTION_LABELS[segment] ??
    segment.charAt(0).toUpperCase() + segment.slice(1)
  );
}

export function TopHeader({
  sidebarWidth,
  isCollapsed,
  setIsCollapsed,
}: {
  sidebarWidth: number;
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}) {
  const pathname = usePathname();
  const { slug } = useOrg();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Breadcrumb segments after the org slug (e.g. /acme/models/deploy).
  const segments = pathname.split("/").filter(Boolean);
  const offset = slug ? 1 : 0;
  const crumbs = segments.slice(offset).map((segment, i) => ({
    label: labelFor(segment),
    href: "/" + segments.slice(0, offset + i + 1).join("/"),
  }));

  return (
    <header
      style={{ left: `${sidebarWidth}px` }}
      className="fixed top-0 right-0 z-30 flex h-14 items-center gap-2.5 border-b border-line bg-bg/80 px-8 backdrop-blur-md transition-[left] duration-200 max-md:px-4"
    >
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label="Toggle sidebar"
        className="inline-grid size-[34px] flex-none place-items-center rounded-[9px] text-mut2 transition hover:bg-fg/5 hover:text-fg"
      >
        <PanelLeft className="size-4" strokeWidth={1.7} />
      </button>

      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2.5 whitespace-nowrap text-mut2"
      >
        <Link
          href={slug ? `/${slug}` : "/"}
          className="font-medium transition hover:text-fg"
        >
          {slug ?? "orcien"}
        </Link>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span
              key={crumb.href}
              className="inline-flex items-center gap-2.5"
            >
              <span className="text-line2">/</span>
              {isLast ? (
                <span className="text-fg" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="transition hover:text-fg"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Search"
          className="inline-grid size-[34px] place-items-center rounded-[9px] text-mut2 transition hover:bg-fg/5 hover:text-fg"
        >
          <Search className="size-4" strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="inline-grid size-[34px] place-items-center rounded-[9px] text-mut2 transition hover:bg-fg/5 hover:text-fg"
        >
          {isDark ? (
            <Sun className="size-4" strokeWidth={1.7} />
          ) : (
            <Moon className="size-4" strokeWidth={1.7} />
          )}
        </button>
        <span className="ml-1.5 grid size-7 place-items-center rounded-full border border-line2 bg-accent/10 font-mono text-[11px]">
          V
        </span>
      </div>
    </header>
  );
}
