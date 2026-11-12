"use client";

import type { ReactNode } from "react";
import { useLayout } from "@/components/providers/LayoutProvider";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NotificationPanel } from "./NotificationPanel";

export type AppShellProps = {
  children: ReactNode;
  /** Enable the left navigation sidebar for this layout. */
  sidebar?: boolean;
  /** Enable the top header bar for this layout. */
  header?: boolean;
  /** Enable the slide-over notification drawer for this layout. */
  notifications?: boolean;
};

/**
 * Clean 2-region enterprise workspace shell (RAMP Section 2.1):
 * neutral light-gray Sidebar + crisp white main workspace + on-demand
 * notification drawer so data tables and split-views retain full width.
 */
export function AppShell({
  children,
  sidebar = true,
  header = true,
  notifications = true,
}: AppShellProps) {
  const { sidebarOpen, notificationsOpen } = useLayout();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {sidebar && sidebarOpen && <Sidebar />}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        {header && <Header />}
        <main className="flex-1 overflow-y-auto px-6 py-5 md:px-8">
          {children}
        </main>
      </div>

      {notifications && notificationsOpen && <NotificationPanel />}
    </div>
  );
}
