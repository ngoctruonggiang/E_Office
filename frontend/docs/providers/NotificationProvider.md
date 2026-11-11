# `components/providers/NotificationProvider.tsx` — NotificationProvider

**Type:** Client Component (context provider)

Central **notification store** plus the **toast popup** mechanism. Calling
`notify(...)` adds a notification to the list (shown in the
[NotificationPanel](../layout/NotificationPanel.md)) **and** pops a transient
toast — unless toast popups are disabled.

## Provider

```tsx
<NotificationProvider>{children}</NotificationProvider>
```

Already mounted in `app/(main)/layout.tsx`. It renders a fixed top-right toast
viewport and the notifications it manages.

## `useNotifications()`

| Member | Type | Description |
|--------|------|-------------|
| `notifications` | `AppNotification[]` | All notifications, newest first. |
| `unreadCount` | `number` | Count of unread notifications. |
| `notify` | `(input: NotifyInput) => string` | Add a notification; returns its id. |
| `dismissToast` | `(id: string) => void` | Hide a toast (keeps it in the panel). |
| `remove` | `(id: string) => void` | Remove a notification entirely. |
| `markAllRead` | `() => void` | Mark every notification read. |
| `clearAll` | `() => void` | Remove all notifications and toasts. |
| `popupsEnabled` | `boolean` | Whether toast popups are currently enabled. |
| `setPopupsEnabled` | `(enabled: boolean) => void` | Enable/disable toast popups. |

`NotifyInput` (see [types/notification](../types/notification.md)):
`{ title, message?, kind?, duration? }`. `duration` defaults to `5000` ms;
`0` keeps the toast until dismissed.

Throws if used outside a `NotificationProvider`.

## Firing a notification

```tsx
const { notify } = useNotifications();

notify({
  title: "New order received",
  message: "Order #1042 is waiting for confirmation.",
  kind: "success", // "info" | "success" | "warning" | "error"
});
```

## Disabling popups on some pages

Use the `useNotificationToasts(enabled)` helper. While the component is mounted
it sets `popupsEnabled`; on unmount it re-enables popups.

```tsx
"use client";
import { useNotificationToasts } from "@/components/providers/NotificationProvider";

export default function CheckoutPage() {
  useNotificationToasts(false); // no toast popups on this page
  // ...
}
```

Notifications still accumulate in the right panel while suppressed — only the
toast popups are silenced. For manual control (e.g. a "do not disturb" switch),
call `setPopupsEnabled(false)` directly.

## Notes

- State is **in-memory** and client-only; it resets on reload. To drive it from
  a backend, call `notify()` from a real-time source (WebSocket/SSE) — a good
  home is `features/notifications/api`.
- Toast timers are cleaned up on unmount.

## Related

- [NotificationPanel](../layout/NotificationPanel.md) · [Toast](../ui/Toast.md)
- [types/notification](../types/notification.md)
