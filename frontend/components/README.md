# Shared components

Reusable, feature-agnostic components.

```
components/
├── ui/          # Generic presentational primitives (Button, Input, Card, ...)
├── layout/      # App shell: Sidebar (left nav), Header, NotificationPanel (right)
└── providers/   # React context providers (theme, query client, ...)
```

Anything used by more than one feature belongs here. Feature-specific UI stays
inside `features/<feature>/components`.
