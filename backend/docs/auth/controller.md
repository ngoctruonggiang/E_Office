# Auth — Controller & DTOs

`AuthController` (`src/modules/auth/auth.controller.ts`), base path `/auth`.

The controller is annotated with `@UseGuards(RedisThrottleGuard)`, so every
endpoint is rate‑limited per client IP using a Redis fixed‑window counter
(distributed, works across instances). The three credential endpoints are
`@Public()` (they skip the global JWT guard); `logout`/`logout-all` require a
valid access token.

## Endpoints

| Method | Path | Auth | Rate limit | Body | Returns |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | public | 5 / 60s | `RegisterDto` | `AuthResponseDto` (201) |
| POST | `/auth/login` | public | 5 / 60s | `LoginDto` | `AuthResponseDto` (200) |
| POST | `/auth/refresh` | public | 10 / 60s | `RefreshTokenDto` | `AuthResponseDto` (200) |
| POST | `/auth/logout` | JWT | — | — | 204 |
| POST | `/auth/logout-all` | JWT | — | — | 204 |

### POST /auth/register
Creates a user and immediately issues a token pair. `409` if the email already
exists. The server generates a `deviceId` when the client doesn't supply one.

### POST /auth/login
Validates credentials (bcrypt). Returns `401 Invalid credentials` for both an
unknown email and a wrong password (no user enumeration). `401` if the account
is disabled.

### POST /auth/refresh
Rotates the refresh token: validates the supplied refresh JWT, confirms it is
the currently stored token for the device, and returns a brand‑new pair. Reuse
of an already‑rotated token revokes every session for that user. `deviceId` must
match the token's device.

### POST /auth/logout
Blacklists the current access token (by `jti`, until its natural expiry) and
deletes the device's refresh token from Redis.

### POST /auth/logout-all
Same as logout but revokes the refresh tokens of **all** the user's devices.

## DTOs

### RegisterDto (request)
| Field | Type | Rules |
| --- | --- | --- |
| `email` | string | valid email |
| `password` | string | 8–72 chars |
| `displayName?` | string | ≤ 80 |
| `deviceId?` | string | ≤ 128 (server generates if omitted) |

### LoginDto (request)
`email` (email), `password` (non‑empty), `deviceId?` (≤ 128).

### RefreshTokenDto (request)
`refreshToken` (non‑empty), `deviceId?` (≤ 128).

### AuthResponseDto (response)
```jsonc
{
  "accessToken": "<JWT, 15m>",
  "refreshToken": "<JWT, 7d>",
  "tokenType": "Bearer",
  "expiresIn": 900,            // access-token seconds
  "user": { "id": "...", "email": "...", "role": "user" },
  "deviceId": "..."            // persist and reuse on refresh/logout
}
```
