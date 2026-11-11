import { apiFetch } from "@/lib/api/client";
import type { UserLite } from "@/features/users/types/user";

// Admin account management (POST/PATCH /users, POST /users/:id/password).
// Listing reuses features/users `listUsers`.

export function createUser(input: {
  email: string;
  password: string;
  displayName?: string;
  role?: string;
}): Promise<UserLite> {
  return apiFetch<UserLite>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function adminUpdateUser(
  id: string,
  input: { displayName?: string; role?: string; isActive?: boolean },
): Promise<UserLite> {
  return apiFetch<UserLite>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setUserPassword(id: string, password: string): Promise<void> {
  return apiFetch<void>(`/users/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}
