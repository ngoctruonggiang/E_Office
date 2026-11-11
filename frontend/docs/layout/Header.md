# `components/layout/Header.tsx` — Header

**Type:** Client Component

The top bar above `main`. Hosts global header features and the shell toggle
controls.

## Behavior

- Fixed height (`h-14`), bottom border.
- Left button (☰) calls `toggleSidebar()` — shows/hides the sidebar.
- Right button (🔔) calls `toggleNotifications()` — shows/hides the
  notification panel.
- Both toggles come from [`useLayout()`](../providers/LayoutProvider.md), so the
  header must render inside a `LayoutProvider`.

## Adding header features

There is a `flex-1` spacer between the toggles. Put global header UI (search,
breadcrumbs, actions, profile menu, etc.) around it:

```tsx
<div className="flex-1">
  <SearchBar />
</div>
```

## Props

None.

## Related

- [LayoutProvider](../providers/LayoutProvider.md)
- [AppShell](./AppShell.md)
