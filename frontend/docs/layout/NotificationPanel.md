# `components/layout/NotificationPanel.tsx` — NotificationPanel

**Type:** Client Component

The right sidebar listing notifications. Reads from
[`NotificationProvider`](../providers/NotificationProvider.md) via
`useNotifications()`, so it stays in sync with the toast popups.

## Behavior

- Fixed width (`w-72`), full height, left border.
- Header shows an unread count badge and a **Mark read** action.
- Body lists notifications newest-first; unread items have a subtle highlight.
- Footer shows **Clear all** when there are notifications.
- Empty state: "No notifications yet."

## Data source

All data and actions come from the notification store:

| Used | From `useNotifications()` |
|------|---------------------------|
| list | `notifications` |
| badge | `unreadCount` |
| Mark read | `markAllRead()` |
| Clear all | `clearAll()` |

## Props

None.

## Showing / hiding the panel

- Static: `notifications` prop on [`AppShell`](./AppShell.md).
- Runtime: `toggleNotifications()` from
  [`useLayout()`](../providers/LayoutProvider.md) (header 🔔 button).

## Related

- [NotificationProvider](../providers/NotificationProvider.md)
- [AppShell](./AppShell.md)
