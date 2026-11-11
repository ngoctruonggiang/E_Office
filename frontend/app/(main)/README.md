# (main) route group

Routes rendered inside the main app shell.

Planned `layout.tsx` shell (not yet implemented):

```
┌──────────┬───────────────────────────────┬──────────────┐
│          │  Header (some features)       │              │
│ Sidebar  ├───────────────────────────────┤ Notification │
│ (left    │                               │ panel        │
│  nav)    │  main  ←─ px (horizontal pad) ─→ (right       │
│          │                               │  sidebar)    │
└──────────┴───────────────────────────────┴──────────────┘
```

Shell components live in `components/layout/`:
- `Sidebar` — left navigation menu
- `Header` — top bar for header features
- `NotificationPanel` — right sidebar for notifications

`main` content has horizontal padding on both sides.
