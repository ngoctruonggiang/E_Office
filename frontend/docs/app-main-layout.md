# `app/(main)/layout.tsx` — Main layout

**Type:** Server Component (layout) · **Route group:** `(main)`

The layout for every route inside the `(main)` route group. It mounts the
provider stack and the app shell, so all pages share the same sidebar / header /
notification chrome.

## What it renders

```
LayoutProvider          # sidebar/notification open state
  └ NotificationProvider  # notification store + toast popups
      └ ModalProvider       # reusable popup mechanism
          └ AppShell          # the visual shell, renders {children}
```

## Notes

- It is a Server Component; the providers it renders are Client Components
  (`"use client"`). Server pages passed as `children` still render fine.
- Routes that should **not** use the shell (e.g. auth screens) can live in a
  different route group with its own layout — that's why `(main)` is a group.
- To disable a region for **all** pages in this group, pass props here, e.g.
  `<AppShell notifications={false}>`. To disable per-page, use the relevant
  hook inside the page (see provider docs).

## Related

- [AppShell](./layout/AppShell.md)
- [LayoutProvider](./providers/LayoutProvider.md)
- [NotificationProvider](./providers/NotificationProvider.md)
- [ModalProvider](./providers/ModalProvider.md)
