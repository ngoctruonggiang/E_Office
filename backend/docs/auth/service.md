# Auth — Services

The auth feature is built around the **`AuthProvider` interface** so the whole
flow can later be swapped for an external IdP (OAuth2/OIDC) by changing one
binding in `auth.module.ts`. Today it is implemented by `LocalAuthProvider`.

```
AuthController → AuthService → AuthProvider (LocalAuthProvider) → TokenService + UserService
                                                                   JwtStrategy (guards)
```

## AuthService (`auth.service.ts`)
Thin facade controllers depend on; delegates to the bound `AuthProvider` and
normalises the device id.

| Method | Description |
| --- | --- |
| `resolveDeviceId(provided?)` | Returns the provided id trimmed, or a new UUID. |
| `register(dto, deviceId)` | → `provider.register(...)`. |
| `login(dto, deviceId)` | → `provider.login(...)`. |
| `refresh(dto, deviceId)` | → `provider.refresh(...)`. |
| `logout(user, accessExpiresInSec, allDevices?)` | → `provider.logout(...)`. |

## AuthProvider interface (`interfaces/auth-provider.interface.ts`)
The SSO seam. Bound via the `AUTH_PROVIDER` DI token.

```ts
register(input): Promise<AuthResult>
login(input): Promise<AuthResult>
refresh(input): Promise<AuthResult>   // validate + rotate
logout(input): Promise<void>
```
Also exports the shared types `AuthenticatedUser`, `JwtPayload`, `AuthTokens`,
`AuthResult`.

## LocalAuthProvider (`providers/local-auth.provider.ts`)
Email + password implementation. Hashes with **bcrypt** (cost 12).

| Method | Behaviour |
| --- | --- |
| `register` | Rejects duplicate email (`409`), hashes password, creates user, issues tokens + caches session. |
| `login` | Looks up user, `bcrypt.compare` (runs even when user is missing to blunt timing attacks), checks `isActive`, issues tokens. |
| `refresh` | Delegates rotation to `TokenService`, rebuilds the response from the new access token's claims. |
| `logout` | Blacklists the access token and revokes the device's (or all) refresh tokens. |

## TokenService (`token/token.service.ts`)
Owns JWT signing/verification and all Redis token state. Access and refresh
tokens use **separate secrets**.

| Method | Behaviour |
| --- | --- |
| `issueTokenPair(subject, deviceId)` | Signs access (15m) + refresh (7d) sharing a `jti`/`deviceId`; stores a **SHA‑256 hash** of the refresh token at `auth:refresh:{userId}:{deviceId}`. |
| `rotateRefreshToken(token, deviceId, resolveSubject)` | Verifies the refresh JWT, checks it matches the stored hash, detects reuse (→ revoke all), issues a fresh pair (overwriting the old hash). |
| `revokeRefreshToken(userId, deviceId)` | Deletes one device's refresh key. |
| `revokeAllRefreshTokens(userId)` | Pattern‑deletes every refresh key for the user. |
| `blacklistAccessToken(jti, expiresInSec)` | Sets `auth:blacklist:{jti}` with TTL = remaining lifetime. |
| `isAccessTokenBlacklisted(jti)` | Checked by `JwtStrategy` on every request. |
| `cacheSession(user)` | Stores a lightweight session snapshot in Redis. |

## JwtStrategy (`strategies/jwt.strategy.ts`)
Passport strategy validating **access** tokens. Beyond signature/expiry it
rejects tokens whose `jti` is blacklisted, then returns the `AuthenticatedUser`
attached to `req.user`.

## Guards
- **`JwtAuthGuard`** — global (`APP_GUARD`); enforces a valid access token
  unless the route is `@Public()`.
- **`RedisThrottleGuard`** — per‑route Redis rate limiter driven by
  `@RateLimit({ limit, ttl })`.
