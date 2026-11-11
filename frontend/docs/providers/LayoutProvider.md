# `components/providers/LayoutProvider.tsx` — LayoutProvider

**Type:** Client Component (context provider)

Holds the **runtime** open/collapse state for the app shell regions (sidebar and
notification panel) and exposes toggles. Pair it with static
[`AppShell`](../layout/AppShell.md) props to enable/disable regions entirely.

## Provider props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Subtree that can use `useLayout()`. |
| `defaultSidebarOpen` | `boolean` | `true` | Initial sidebar visibility. |
| `defaultNotificationsOpen` | `boolean` | `true` | Initial notification panel visibility. |

## `useLayout()`

Returns:

| Member | Type | Description |
|--------|------|-------------|
| `sidebarOpen` | `boolean` | Whether the sidebar is visible. |
| `notificationsOpen` | `boolean` | Whether the notification panel is visible. |
| `toggleSidebar` | `() => void` | Flip sidebar visibility. |
| `toggleNotifications` | `() => void` | Flip panel visibility. |
| `setSidebarOpen` | `(open: boolean) => void` | Set sidebar visibility. |
| `setNotificationsOpen` | `(open: boolean) => void` | Set panel visibility. |

Throws if used outside a `LayoutProvider`.

## Usage

```tsx
// Provider (already wired in app/(main)/layout.tsx)
<LayoutProvider>
  <AppShell>{children}</AppShell>
</LayoutProvider>

// Consuming — e.g. a custom button
const { toggleSidebar, sidebarOpen } = useLayout();
<button onClick={toggleSidebar}>{sidebarOpen ? "Hide menu" : "Show menu"}</button>
```

The header's ☰ and 🔔 buttons already call `toggleSidebar` / `toggleNotifications`.

## Static vs runtime

- **Static** (region exists at all): `AppShell` props `sidebar` / `header` /
  `notifications`.
- **Runtime** (show/hide an existing region): this provider.

A region shows only when its `AppShell` prop is `true` **and** its open state
here is `true`.

## Related

- [AppShell](../layout/AppShell.md) · [Header](../layout/Header.md)
