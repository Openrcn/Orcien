"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

export function AppShell({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarWidth = isCollapsed ? 72 : 264;

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <TopHeader
        sidebarWidth={sidebarWidth}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <main
        style={{
          flex: 1,
          padding:
            "calc(56px + 26px) 2rem 3.5rem calc(" +
            sidebarWidth +
            "px + 2rem)",
          width: "100%",
          margin: "0",
          transition: "padding-left 0.2s ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}
