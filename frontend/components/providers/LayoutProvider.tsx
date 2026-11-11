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
  /** Whether the right notification panel is currently visible. */
  notificationsOpen: boolean;
  toggleSidebar: () => void;
  toggleNotifications: () => void;
  setSidebarOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export type LayoutProviderProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
  defaultNotificationsOpen?: boolean;
};

/**
 * Holds the runtime open/collapse state for the app shell regions.
 * Pair with `AppShell` props to statically enable/disable a region.
 */
export function LayoutProvider({
  children,
  defaultSidebarOpen = true,
  defaultNotificationsOpen = true,
}: LayoutProviderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [notificationsOpen, setNotificationsOpen] = useState(
    defaultNotificationsOpen,
  );

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleNotifications = useCallback(
    () => setNotificationsOpen((v) => !v),
    [],
  );

  return (
    <LayoutContext.Provider
      value={{
        sidebarOpen,
        notificationsOpen,
        toggleSidebar,
        toggleNotifications,
        setSidebarOpen,
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
