# User — Controller & DTOs

`UserController` (`src/modules/user/user.controller.ts`), base path `/users`.
Both endpoints require a valid access token and operate on the **current user**.

## Endpoints

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/users/me` | JWT | — | `UserResponseDto` |
| PATCH | `/users/me` | JWT | `UpdateProfileDto` | `UserResponseDto` |

### GET /users/me
Returns the authenticated user's profile (`404` only if the account was deleted
mid‑session).

### PATCH /users/me
Updates the caller's own profile. Currently only `displayName` is editable.

## DTOs

### UpdateProfileDto (request)
| Field | Type | Rules |
| --- | --- | --- |
| `displayName?` | string | 1–80 chars |

### UserResponseDto (response)
Never contains `passwordHash`.
```jsonc
{
  "id": "...",
  "email": "...",
  "displayName": "..." | null,
  "role": "user",
  "isActive": true,
  "createdAt": "2026-..."
}
```
Built via `UserResponseDto.fromEntity(user)`, the single mapping point that
strips sensitive fields.
