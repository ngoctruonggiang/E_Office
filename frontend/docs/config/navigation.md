# `config/navigation.ts` — navigation config

Static configuration for the left [Sidebar](../layout/Sidebar.md) navigation.

## Exports

### `NavItem`

```ts
type NavItem = {
  label: string; // text shown in the sidebar
  href: string;  // route the link points to
};
```

### `navItems`

```ts
const navItems: NavItem[]
```

The ordered list of links rendered in the sidebar.

## Editing the menu

Add, remove, or reorder entries:

```ts
export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Orders", href: "/orders" },
  { label: "Restaurants", href: "/restaurants" },
  // { label: "Settings", href: "/settings" },
];
```

The sidebar highlights the active item automatically based on the current
pathname (exact match for `/`, prefix match otherwise).

## Related

- [Sidebar](../layout/Sidebar.md)
