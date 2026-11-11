# `types/notification.ts` — notification types

Shared TypeScript types for the notification system, used by
[NotificationProvider](../providers/NotificationProvider.md),
[NotificationPanel](../layout/NotificationPanel.md), and
[Toast](../ui/Toast.md).

## Exports

### `NotificationKind`

```ts
type NotificationKind = "info" | "success" | "warning" | "error";
```

Drives the toast accent color.

### `AppNotification`

A stored notification.

```ts
type AppNotification = {
  id: string;
  title: string;
  message?: string;
  kind: NotificationKind;
  createdAt: number; // epoch ms
  read: boolean;
};
```

### `NotifyInput`

The argument to `notify(...)`.

```ts
type NotifyInput = {
  title: string;
  message?: string;
  kind?: NotificationKind; // defaults to "info"
  duration?: number;       // toast auto-dismiss ms; 0 = sticky; default 5000
};
```

## Related

- [NotificationProvider](../providers/NotificationProvider.md)
