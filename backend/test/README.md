# End-to-end tests

These are full integration (e2e) tests: they boot the real `AppModule`, keep
the real `JwtAuthGuard`, and drive the public HTTP API with `supertest`. They
talk to a **real Postgres and Redis** — nothing is mocked except the two rate
limiters (so a suite can register the users it needs).

## Prerequisites

- Postgres reachable at `DATABASE_URL` with migrations applied
  (`npm run prisma:migrate`).
- Redis reachable at `REDIS_*` (token storage + access-token blacklist).

The dev `docker-compose.dev.yml` services satisfy both.

> Tests create their own data with random emails / unique form names, so they
> are self-isolating and do **not** truncate existing tables.

## Run

```bash
npm run test:e2e                       # whole suite
npx jest --config ./test/jest-e2e.json users        # one flow
npx jest --config ./test/jest-e2e.json --runInBand   # serial (less DB contention)
```

## Layout

`utils/` holds the shared harness; each `*.e2e-spec.ts` maps to one of the
requested flows.

| File | Flow |
| --- | --- |
| `utils/test-app.ts` | Boots the app; stubs the rate limiters; exposes Prisma. |
| `utils/auth.helper.ts` | `registerUser`, `createRandomUsers`, `loginUser` (Flow 0). |
| `utils/fixtures.ts` | Form / request / flow-step payload builders. |
| `utils/api.ts` | Thin per-endpoint supertest wrappers. |
| `users.e2e-spec.ts` | **0** — register 10 users; tokens authenticate; dupes 409. |
| `request-lifecycle.e2e-spec.ts` | **1** — form → request with approver + viewer → mine/duty/viewable by `formId`. |
| `approval-flow.e2e-spec.ts` | **2** — complex SEQUENTIAL+PARALLEL flow: turn-taking, half-way, fully approved, rejection. |
| `form-versioning.e2e-spec.ts` | **3** — in-place edits vs new versions; old requests stay pinned. |
| `request-update.e2e-spec.ts` | **4** — editing values keeps the approval flow intact. |
| `request-clone.e2e-spec.ts` | **5** — `clone-reserve` vs `clone-reset` of a half-way request, checked via both the approval-flow and request controllers. |

## Notes

- `POST /requests/:id/approval` returns **201** (NestJS default for POST), so
  approval actions assert `201`, not `200`.
- The global `ThrottlerGuard` is an `APP_GUARD` `useClass` binding that
  `overrideGuard` cannot replace, so `test-app.ts` raises `THROTTLE_LIMIT` via
  env before the module compiles. The per-route Redis limiter is neutralised
  with `overrideGuard(RedisThrottleGuard)`.
