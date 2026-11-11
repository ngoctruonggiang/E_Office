# Infrastructure & Shared Building Blocks

Cross‑cutting providers used by every feature module. Both data providers are
`@Global`, so feature modules inject them without re‑importing.

## PrismaModule / PrismaService (`src/core/prisma/`)
- `PrismaService extends PrismaClient` and ties the client lifecycle to Nest
  (`$connect` on init, `$disconnect` on destroy).
- Multi‑file schema lives in `prisma/schema/` (PostgreSQL). `package.json`
  points Prisma at that folder via `"prisma": { "schema": "prisma/schema" }`.

## RedisModule / RedisService (`src/core/redis/`)
A single shared `ioredis` connection (`REDIS_CLIENT` token) wrapped by
`RedisService`:

| Method | Use |
| --- | --- |
| `set/get/del/exists` | primitive string ops with TTL |
| `setJson/getJson` | session caching |
| `delByPattern` | logout‑all (scan + pipelined delete) |
| `incrementWithTtl` | fixed‑window rate‑limit counter |

Key namespaces are centralised in `redis.constants.ts` (`RedisKeys`):
`auth:refresh:{userId}:{deviceId}`, `auth:blacklist:{jti}`,
`auth:session:{userId}`, and `ratelimit:{route}:{ip}`.

Redis is used for: refresh‑token storage (hashed), access‑token blacklist,
session cache, and auth‑endpoint rate limiting.

## Global guards, filters & pipes
Registered in `app.module.ts` / `main.ts`:

| Provider | Scope | Role |
| --- | --- | --- |
| `JwtAuthGuard` | `APP_GUARD` | Requires a valid access token unless `@Public()`. Rejects blacklisted `jti`s. |
| `ThrottlerGuard` | `APP_GUARD` | Baseline in‑process rate limit (`@nestjs/throttler`). |
| `AllExceptionsFilter` | `APP_FILTER` | Uniform error envelope; hides stack traces. |
| `ValidationPipe` | global (main.ts) | `whitelist + forbidNonWhitelisted + transform`. |

## Common decorators & guards (`src/core/common/`)
| Item | Purpose |
| --- | --- |
| `@Public()` | Marks a route as open (skips `JwtAuthGuard`). |
| `@CurrentUser()` | Injects the authenticated principal from `req.user`. |
| `@Roles(...roles)` + `RolesGuard` | Role‑restricted routes (e.g. admin hard‑delete). |
| `@RateLimit({ limit, ttl })` + `RedisThrottleGuard` | Per‑route distributed (Redis) rate limit. |
| `AllExceptionsFilter` | The global exception filter. |

## Local development
```bash
docker compose -f docker-compose.dev.yml up -d   # postgres + redis
npm run prisma:generate
npx prisma migrate deploy
npm run start:dev
```
Environment variables are documented in `.env.example` (database, Redis, JWT
secrets/TTLs, throttle limits, `UPLOAD_DIR`).
