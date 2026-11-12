"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type LayoutContextValue = {
  /** Whether the left sidebar is currently visible. */
  sidebarOpen: boolean;
  /** Whether the left sidebar is collapsed to compact icon-only mode. */
  sidebarCollapsed: boolean;
  /** Whether the slide-over notification drawer is currently visible. */
  notificationsOpen: boolean;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  toggleNotifications: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export type LayoutProviderProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
  defaultSidebarCollapsed?: boolean;
  defaultNotificationsOpen?: boolean;
};

/**
 * Holds runtime open/collapse state for the app shell regions.
 * Notifications drawer defaults to closed so main content receives full width.
 */
export function LayoutProvider({
  children,
  defaultSidebarOpen = true,
  defaultSidebarCollapsed = false,
  defaultNotificationsOpen = false,
}: LayoutProviderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    defaultSidebarCollapsed,
  );
  const [notificationsOpen, setNotificationsOpen] = useState(
    defaultNotificationsOpen,
  );

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleSidebarCollapse = useCallback(
    () => setSidebarCollapsed((v) => !v),
    [],
  );
  const toggleNotifications = useCallback(
    () => setNotificationsOpen((v) => !v),
    [],
  );

  return (
    <LayoutContext.Provider
      value={{
        sidebarOpen,
        sidebarCollapsed,
        notificationsOpen,
        toggleSidebar,
        toggleSidebarCollapse,
        toggleNotifications,
        setSidebarOpen,
        setSidebarCollapsed,
        setNotificationsOpen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error("useLayout must be used within a <LayoutProvider>");
  }
  return ctx;
}
