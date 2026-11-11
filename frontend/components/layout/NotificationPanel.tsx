"use client";

import { useNotifications } from "@/components/providers/NotificationProvider";

/** Right sidebar for notifications. */
export function NotificationPanel() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-black/10 dark:border-white/10">
      <div className="flex h-14 items-center justify-between border-b border-black/10 px-4 dark:border-white/10">
        <span className="font-semibold">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium">
              {unreadCount}
            </span>
          )}
        </span>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs text-foreground/60 hover:text-foreground"
          >
            Mark read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <p className="p-2 text-sm text-foreground/60">No notifications yet.</p>
        ) : (
          <ul className="space-y-1">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-md p-2 text-sm ${n.read ? "text-foreground/60" : "bg-foreground/5"}`}
              >
                <p className="font-medium">{n.title}</p>
                {n.message && <p className="text-foreground/60">{n.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="border-t border-black/10 p-2 dark:border-white/10">
          <button
            type="button"
            onClick={clearAll}
            className="w-full rounded-md py-1.5 text-xs text-foreground/60 hover:bg-foreground/5"
          >
            Clear all
          </button>
        </div>
      )}
    </aside>
  );
}
