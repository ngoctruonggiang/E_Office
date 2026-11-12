"use client";

import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useLocale, useT } from "@/components/providers/I18nProvider";
import { useLayout } from "@/components/providers/LayoutProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Slide-over notification drawer toggled from the Header bell icon. */
export function NotificationPanel() {
  const t = useT();
  const [locale] = useLocale();
  const { setNotificationsOpen } = useLayout();
  const { notifications, unreadCount, markAllRead, clearAll } =
    useNotifications();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setNotificationsOpen]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={() => setNotificationsOpen(false)}
        className="fixed inset-0 z-30 bg-black/15"
      />
      <aside
        aria-label={t("notifications.title")}
        className="fixed inset-y-0 right-0 z-40 flex w-80 max-w-[92vw] flex-col border-l border-border bg-surface shadow-xl"
      >
        <div className="flex h-13 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {t("notifications.title")}
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              aria-label={t("common.close")}
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <EmptyState
              compact
              icon={<Bell size={18} strokeWidth={1.6} />}
              title={t("notifications.empty")}
            />
          ) : (
            <ul className="space-y-1.5">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-md border px-3 py-2.5 text-sm transition-colors",
                    n.read
                      ? "border-transparent text-muted-foreground"
                      : "border-border-subtle bg-surface-secondary text-foreground",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-snug">{n.title}</p>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-highlight ring-1 ring-primary/20" />
                    )}
                  </div>
                  {n.message && (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                      {n.message}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                    {formatDateTime(new Date(n.createdAt), locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={clearAll}
              className="w-full cursor-pointer rounded-md border border-border bg-surface py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground"
            >
              {t("notifications.clearAll")}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
