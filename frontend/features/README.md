# Features

Feature-based modules. Each feature is self-contained and owns its UI and data access.

```
features/<feature>/
├── components/   # UI components specific to this feature
├── api/          # API calls / data fetching for this feature
├── hooks/        # React hooks specific to this feature
└── types/        # TypeScript types for this feature
```

Rules of thumb:

- A feature should not import from another feature's internals. If something
  needs to be shared across features, promote it to the top-level `components/`,
  `lib/`, `hooks/`, or `types/`.
- `app/` only handles routing — pages compose feature components, they don't
  contain feature logic.
- Cross-feature shared UI lives in `components/` (e.g. `components/ui`).
- The shared HTTP client / API config lives in `lib/api`.
