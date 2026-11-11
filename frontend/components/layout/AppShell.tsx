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
  /** Enable the right notification panel for this layout. */
  notifications?: boolean;
};

/**
 * App shell composing the three layout regions with flexbox:
 *
 *   ┌─────────┬───────────────────────────┬───────────────┐
 *   │         │ Header                    │               │
 *   │ Sidebar ├───────────────────────────┤ Notifications │
 *   │         │ main (px padding)         │               │
 *   └─────────┴───────────────────────────┴───────────────┘
 *
 * Each region can be statically disabled via props, or toggled at runtime
 * through `useLayout()` (the header buttons do this).
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header && <Header />}
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
          {children}
        </main>
      </div>

      {notifications && notificationsOpen && <NotificationPanel />}
    </div>
  );
}
