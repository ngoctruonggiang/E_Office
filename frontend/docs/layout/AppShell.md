# `components/layout/AppShell.tsx` — AppShell

**Type:** Client Component

Composes the three layout regions (Sidebar, Header, NotificationPanel) around
page content using flexbox. Each region can be statically disabled via props and
the sidebar / notification panel can be hidden at runtime via
[`useLayout()`](../providers/LayoutProvider.md).

## Layout

```
┌─────────┬───────────────────────────┬───────────────┐
│         │ Header                    │               │
│ Sidebar ├───────────────────────────┤ Notifications │
│         │ main (px-6 md:px-8)       │               │
└─────────┴───────────────────────────┴───────────────┘
```

`main` is the only scrolling region and carries horizontal padding on both
sides (`px-6 md:px-8`).

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Page content rendered in `main`. |
| `sidebar` | `boolean` | `true` | Enable the left navigation sidebar. |
| `header` | `boolean` | `true` | Enable the top header bar. |
| `notifications` | `boolean` | `true` | Enable the right notification panel. |

A region renders only when **both** its prop is `true` **and** (for sidebar /
notifications) its runtime open state in `LayoutProvider` is `true`.

## Usage

```tsx
// Default: all three regions
<AppShell>{children}</AppShell>

// A focused layout without the notification panel
<AppShell notifications={false}>{children}</AppShell>
```

## Notes

- Must be rendered inside a [`LayoutProvider`](../providers/LayoutProvider.md);
  it calls `useLayout()` for the open states.
- The root container is `h-screen overflow-hidden`; scrolling happens inside
  `main` and each panel, not on the page body.

## Related

- [Sidebar](./Sidebar.md) · [Header](./Header.md) · [NotificationPanel](./NotificationPanel.md)
- [LayoutProvider](../providers/LayoutProvider.md)
