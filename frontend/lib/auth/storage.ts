/**
 * Client-side token store. The NestJS backend issues JWT access/refresh tokens
 * (see be/src/modules/auth) — we keep them in localStorage and attach the
 * access token as a Bearer header on every API call (see lib/api/client.ts).
 *
 * Tokens live in localStorage (not httpOnly cookies) because this is a pure
 * SPA talking to a separate API origin; revisit if the API moves same-origin.
 */
const ACCESS_KEY = "gafood.accessToken";
const REFRESH_KEY = "gafood.refreshToken";
const DEVICE_KEY = "gafood.deviceId";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
};

const isBrowser = typeof window !== "undefined";

export function getAccessToken(): string | null {
  return isBrowser ? window.localStorage.getItem(ACCESS_KEY) : null;
}

export function getRefreshToken(): string | null {
  return isBrowser ? window.localStorage.getItem(REFRESH_KEY) : null;
}

export function getDeviceId(): string | null {
  return isBrowser ? window.localStorage.getItem(DEVICE_KEY) : null;
}

export function setTokens(tokens: StoredTokens): void {
  if (!isBrowser) return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  window.localStorage.setItem(DEVICE_KEY, tokens.deviceId);
}

export function clearTokens(): void {
  if (!isBrowser) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(DEVICE_KEY);
}
