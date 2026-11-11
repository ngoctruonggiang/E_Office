# gafood frontend — documentation

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript.

This folder documents the project structure, the layout shell, and every
shared component / provider. There is **one doc per source file**.

## Project structure

```
fe/
├── app/                        # Routing only (App Router). No business logic.
│   ├── (main)/                 # Route group rendered inside the app shell
│   │   ├── layout.tsx          # Provider stack + <AppShell>
│   │   └── page.tsx            # Dashboard (demo of modal + notifications)
│   ├── layout.tsx              # Root layout: <html>/<body>, fonts
│   └── globals.css             # Tailwind v4 entry + theme tokens
│
├── components/                 # Shared, feature-agnostic UI
│   ├── layout/                 # App shell regions
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── NotificationPanel.tsx
│   ├── ui/                     # Generic presentational primitives
│   │   ├── Modal.tsx
│   │   └── Toast.tsx
│   └── providers/              # React context providers
│       ├── LayoutProvider.tsx
│       ├── ModalProvider.tsx
│       └── NotificationProvider.tsx
│
├── features/                   # Feature modules (UI + data, split per feature)
│   ├── forms/                  # Generic form render engine (see docs/features/forms.md)
│   │   └── {components,api,hooks,lib,types}
│   └── <feature>/{components,api,hooks,types}
│
├── lib/                        # Shared library code
│   └── api/
│       └── client.ts           # apiFetch wrapper + ApiError
├── hooks/                      # Shared React hooks
├── types/                      # Shared TypeScript types
│   └── notification.ts
└── config/                     # App configuration
    └── navigation.ts           # Sidebar nav items
```

### Layering rules

- `app/` only wires routes; pages compose feature components.
- A feature must not import another feature's internals — promote shared code
  to `components/`, `lib/`, `hooks/`, or `types/`.
- Feature-specific UI lives in `features/<feature>/components`; reusable UI
  lives in `components/`.
- `@/*` is aliased to the **project root** (see `tsconfig.json`), so imports
  look like `@/components/...`, `@/config/...`, `@/types/...`.

## The layout shell

```
┌─────────┬───────────────────────────┬───────────────┐
│         │ Header                    │               │
│ Sidebar ├───────────────────────────┤ Notifications │
│         │ main (px horizontal pad)  │               │
└─────────┴───────────────────────────┴───────────────┘
```

- **Sidebar** (left) — navigation. Full height.
- **Header** (top, over main) — global header features + shell toggles.
- **main** — page content, with horizontal padding on both sides.
- **NotificationPanel** (right) — notification list. Full height.

Each region can be **statically** enabled/disabled via `<AppShell>` props, and
the sidebar / notification panel can be **toggled at runtime** from the header.

### Provider stack

`app/(main)/layout.tsx` wraps content in:

```
LayoutProvider → NotificationProvider → ModalProvider → AppShell
```

## Index

| File | Doc |
|------|-----|
| `app/(main)/layout.tsx` | [app-main-layout.md](./app-main-layout.md) |
| `components/layout/AppShell.tsx` | [layout/AppShell.md](./layout/AppShell.md) |
| `components/layout/Sidebar.tsx` | [layout/Sidebar.md](./layout/Sidebar.md) |
| `components/layout/Header.tsx` | [layout/Header.md](./layout/Header.md) |
| `components/layout/NotificationPanel.tsx` | [layout/NotificationPanel.md](./layout/NotificationPanel.md) |
| `components/ui/Modal.tsx` | [ui/Modal.md](./ui/Modal.md) |
| `components/ui/Toast.tsx` | [ui/Toast.md](./ui/Toast.md) |
| `components/providers/LayoutProvider.tsx` | [providers/LayoutProvider.md](./providers/LayoutProvider.md) |
| `components/providers/ModalProvider.tsx` | [providers/ModalProvider.md](./providers/ModalProvider.md) |
| `components/providers/NotificationProvider.tsx` | [providers/NotificationProvider.md](./providers/NotificationProvider.md) |
| `config/navigation.ts` | [config/navigation.md](./config/navigation.md) |
| `types/notification.ts` | [types/notification.md](./types/notification.md) |
| `features/forms/*` (form render engine) | [features/forms.md](./features/forms.md) |
