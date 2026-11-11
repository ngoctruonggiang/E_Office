import { apiFetch } from "@/lib/api/client";
import { getDeviceId, getRefreshToken } from "@/lib/auth/storage";
import type { AuthResponse, LoginInput, UserProfile } from "../types/auth";

/** POST /auth/login — exchange credentials for a token pair. */
export function login(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ ...input, deviceId: getDeviceId() ?? undefined }),
  });
}

/** GET /users/me — the authenticated user's full profile. */
export function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/users/me");
}

/** Fields editable on the profile page. Empty string clears a signature field. */
export type UpdateProfileInput = {
  displayName?: string;
  signatureName?: string;
  signatureImage?: string;
};

/** PATCH /users/me — update the authenticated user's profile. */
export function updateMe(input: UpdateProfileInput): Promise<UserProfile> {
  return apiFetch<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** POST /auth/logout — revoke the refresh token for this device. */
export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({
      refreshToken: getRefreshToken() ?? undefined,
      deviceId: getDeviceId() ?? undefined,
    }),
  }).catch(() => undefined); // logout is best-effort; tokens are cleared locally regardless
}
