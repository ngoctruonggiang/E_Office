"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ToastCard } from "@/components/ui/Toast";
import type { AppNotification, NotifyInput } from "@/types/notification";

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  /** Add a notification (and pop a toast unless popups are disabled). */
  notify: (input: NotifyInput) => string;
  /** Hide a toast without removing the notification. */
  dismissToast: (id: string) => void;
  /** Remove a notification entirely (panel + toast). */
  remove: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  popupsEnabled: boolean;
  setPopupsEnabled: (enabled: boolean) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toastIds, setToastIds] = useState<string[]>([]);
  const [popupsEnabled, setPopupsEnabledState] = useState(true);

  // Read inside the stable `notify` callback without making it depend on state.
  const popupsEnabledRef = useRef(true);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    setToastIds((ids) => ids.filter((x) => x !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (input: NotifyInput) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const notification: AppNotification = {
        id,
        title: input.title,
        message: input.message,
        kind: input.kind ?? "info",
        createdAt: Date.now(),
        read: false,
      };
      setNotifications((prev) => [notification, ...prev]);

      if (popupsEnabledRef.current) {
        setToastIds((ids) => [...ids, id]);
        const duration = input.duration ?? DEFAULT_DURATION;
        if (duration > 0) {
          timers.current.set(
            id,
            setTimeout(() => dismissToast(id), duration),
          );
        }
      }
      return id;
    },
    [dismissToast],
  );

  const remove = useCallback(
    (id: string) => {
      dismissToast(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    },
    [dismissToast],
  );

  const markAllRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [],
  );

  const clearAll = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setToastIds([]);
    setNotifications([]);
  }, []);

  const setPopupsEnabled = useCallback((enabled: boolean) => {
    popupsEnabledRef.current = enabled;
    setPopupsEnabledState(enabled);
  }, []);

  // Clear pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      notify,
      dismissToast,
      remove,
      markAllRead,
      clearAll,
      popupsEnabled,
      setPopupsEnabled,
    }),
    [
      notifications,
      unreadCount,
      notify,
      dismissToast,
      remove,
      markAllRead,
      clearAll,
      popupsEnabled,
      setPopupsEnabled,
    ],
  );

  const toasts = toastIds
    .map((id) => notifications.find((n) => n.id === id))
    .filter((n): n is AppNotification => Boolean(n));

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Toast viewport */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((n) => (
          <ToastCard
            key={n.id}
            notification={n}
            onClose={() => dismissToast(n.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {  
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a <NotificationProvider>");
  }
  return ctx;
}

/**
 * Enable/disable notification toast popups while a component is mounted.
 * Call `useNotificationToasts(false)` at the top of a page to suppress
 * popups on that page; toasts re-enable when the page unmounts.
 */
export function useNotificationToasts(enabled: boolean) {
  const { setPopupsEnabled } = useNotifications();
  useEffect(() => {
    setPopupsEnabled(enabled);
    return () => setPopupsEnabled(true);
  }, [enabled, setPopupsEnabled]);
}
