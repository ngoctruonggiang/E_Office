# `components/layout/Sidebar.tsx` — Sidebar

**Type:** Client Component

The left navigation menu. Renders the links from
[`config/navigation.ts`](../config/navigation.md) and highlights the active one
based on the current pathname.

## Behavior

- Fixed width (`w-60`), full height, right border.
- Active link detection:
  - `/` is active only on an exact match.
  - Other items are active when `pathname.startsWith(item.href)`.
- Uses `next/link` for client-side navigation and `usePathname()` for the
  active state (hence a Client Component).

## Props

None. Navigation content comes from `config/navigation.ts`.

## Customizing

- **Add/remove links:** edit `navItems` in
  [`config/navigation.ts`](../config/navigation.md).
- **Show/hide the whole sidebar:** use the `sidebar` prop on
  [`AppShell`](./AppShell.md) (static) or `toggleSidebar()` from
  [`useLayout()`](../providers/LayoutProvider.md) (runtime; wired to the header
  ☰ button).

## Related

- [config/navigation](../config/navigation.md)
- [AppShell](./AppShell.md)
