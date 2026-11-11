# `components/ui/Toast.tsx` — ToastCard

**Type:** Client Component

A single transient toast card. Presentational only — it does not manage timing
or stacking; that is handled by
[`NotificationProvider`](../providers/NotificationProvider.md), which renders
these in the toast viewport.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `notification` | `AppNotification` | The notification to display (see [types/notification](../types/notification.md)). |
| `onClose` | `() => void` | Called when the dismiss (✕) button is clicked. |

## Appearance

- Renders `title` and optional `message`.
- A left accent border is colored by `notification.kind`:

  | kind | accent |
  |------|--------|
  | `info` | blue |
  | `success` | green |
  | `warning` | amber |
  | `error` | red |

- `role="status"` for assistive technologies.

## Notes

You normally never render `ToastCard` yourself — call `notify(...)` and the
provider renders the cards. Render it directly only if building a custom toast
surface.

## Related

- [NotificationProvider](../providers/NotificationProvider.md)
- [types/notification](../types/notification.md)
