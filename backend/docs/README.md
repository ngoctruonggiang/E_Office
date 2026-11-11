# Backend Documentation

Reference docs for every feature module in this NestJS backend. Each module has
two docs: one for its **controller + DTOs** (the HTTP surface) and one for its
**services** (the business logic).

## Modules

| Module | Controller + DTOs | Services |
| --- | --- | --- |
| Auth | [auth/controller.md](./auth/controller.md) | [auth/service.md](./auth/service.md) |
| User | [user/controller.md](./user/controller.md) | [user/service.md](./user/service.md) |
| Form Builder | [form-builder/controller.md](./form-builder/controller.md) | [form-builder/service.md](./form-builder/service.md) |
| Request | [request/controller.md](./request/controller.md) | [request/service.md](./request/service.md) |
| Approval Flow | [approval-flow/controller.md](./approval-flow/controller.md) | [approval-flow/service.md](./approval-flow/service.md) |
| Document | [document/controller.md](./document/controller.md) | [document/service.md](./document/service.md) |

Shared building blocks (Prisma, Redis, guards, filters) are documented in
[infrastructure.md](./infrastructure.md).

## Project structure

Feature modules live under `src/modules`; shared infrastructure under `src/core`.

```
src/
  main.ts, app.module.ts, app.controller.ts, app.service.ts
  core/
    prisma/     PrismaModule + PrismaService
    redis/      RedisModule + RedisService + key namespaces
    common/     decorators, guards, exception filter (shared, cross-cutting)
  modules/
    auth/       JWT auth, token service, AuthProvider seam, guards, strategy
    user/       profile
    form-builder/   forms, versions, fields, options, validations
    request/        requests (EAV form responses) + clone
    approval-flow/  approval engine + status
    document/       file uploads (soft/hard delete)
```

## Conventions used across all modules

- **Auth by default.** A global `JwtAuthGuard` protects every route; endpoints
  that must be open are marked `@Public()` (only auth register/login/refresh and
  the health check). The authenticated principal is injected with
  `@CurrentUser()` and has the shape
  `{ userId, email, role, jti, deviceId, accessExp }`.
- **Validation.** A global `ValidationPipe` runs with
  `whitelist + forbidNonWhitelisted + transform`, so request bodies are coerced
  into the DTO classes and unknown properties are rejected (HTTP 400).
- **Errors.** A global `AllExceptionsFilter` returns a uniform envelope:
  `{ statusCode, error, message, path, timestamp }`.
- **IDs** are UUID strings. **Timestamps** are ISO‑8601.

## Data model at a glance

```
Form ── FormVersion ─┬─ FormField ─┬─ FieldOption
    (versioned,        │             └─ FieldValidation
     basic fields only) └─ FormResponse (a REQUEST)
                             ├─ FormResponseValue   (EAV: fieldKey -> value)
                             ├─ RequestViewer
                             ├─ RequestDocument ── Document
                             └─ FlowInstance ── Task (per-assignee action)
                                      │
                                      └─ Flow ─ FlowStep ─ FlowAssignee
                                         (built by the requester on create —
                                          not a fixed flow on the Form)
```
