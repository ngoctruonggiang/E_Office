# User — Services

## UserService (`user/user.service.ts`)
Owns all persistence for users. The auth layer depends on this service (through
`LocalAuthProvider`) rather than touching Prisma directly. Emails are
lower‑cased on write and lookup.

| Method | Signature | Behaviour |
| --- | --- | --- |
| `create` | `({ email, passwordHash, displayName? }) → UserEntity` | Inserts a user (email lower‑cased). |
| `findByEmail` | `(email) → UserEntity \| null` | Case‑insensitive lookup. |
| `findById` | `(id) → UserEntity \| null` | By id. |
| `getByIdOrThrow` | `(id) → UserEntity` | As above but throws `404 User not found`. |
| `updateProfile` | `(id, UpdateProfileDto) → UserEntity` | Verifies existence then updates `displayName`. |

### Entity
`UserEntity` (`user/entities/user.entity.ts`) mirrors the Prisma `User` model
(`id`, `email`, `passwordHash`, `displayName`, `role`, `isActive`,
`createdAt`, `updatedAt`). It is kept separate so the rest of the app does not
depend on Prisma's generated types directly and so `passwordHash` can be
stripped at the boundary (see `UserResponseDto`).

`role` is a plain string (`"user"` | `"admin"`) — used by `RolesGuard` for
admin‑only routes such as document hard‑delete.
