"use client";

import type { AppNotification, NotificationKind } from "@/types/notification";

const accent: Record<NotificationKind, string> = {
  info: "border-l-blue-500",
  success: "border-l-green-500",
  warning: "border-l-amber-500",
  error: "border-l-red-500",
};

/** A single transient toast card. */
export function ToastCard({
  notification,
  onClose,
}: {
  notification: AppNotification;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-black/10 bg-background p-3 shadow-lg dark:border-white/10 ${accent[notification.kind]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{notification.title}</p>
        {notification.message && (
          <p className="mt-0.5 text-sm text-foreground/70 whitespace-pre-line">{notification.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-1 text-foreground/50 hover:bg-foreground/5"
      >
        ✕
      </button>
    </div>
  );
}
