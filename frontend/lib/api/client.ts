/** Base URL of the NestJS backend. Override with NEXT_PUBLIC_API_URL. */
import {
  clearTokens,
  getAccessToken,
  getDeviceId,
  getRefreshToken,
  setTokens,
} from "@/lib/auth/storage";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Notified when auth is lost (refresh failed) so the app can redirect to login. */
type AuthFailureListener = () => void;
let onAuthFailure: AuthFailureListener | null = null;
export function setAuthFailureHandler(fn: AuthFailureListener | null): void {
  onAuthFailure = fn;
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.map(String).join(", ");
    if (m) return String(m);
  }
  return fallback;
}

async function parseBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return await res.text().catch(() => undefined);
  }
}

/**
 * Single-flight refresh: many requests can 401 at once, but only one refresh
 * call runs; the rest await its result.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refreshToken,
            deviceId: getDeviceId() ?? undefined,
          }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
          deviceId: string;
        };
        setTokens(data);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export type ApiFetchOptions = RequestInit & {
  /** Skip attaching the Bearer token (used by login/register/refresh). */
  auth?: boolean;
  /** Internal: prevents infinite refresh recursion. */
  _retry?: boolean;
};

/**
 * Thin fetch wrapper: JSON in/out, Bearer auth, transparent token refresh on
 * 401, typed result and typed errors. Pass a `FormData` body and the
 * Content-Type is left to the browser (multipart boundary).
 */
export async function apiFetch<T>(
  path: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, _retry, headers, body, ...rest } = init;

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    body,
    headers: finalHeaders,
  });

  // Try one transparent refresh on an expired/invalid access token.
  if (res.status === 401 && auth && !_retry) {
    const ok = await refreshTokens();
    if (ok) {
      return apiFetch<T>(path, { ...init, _retry: true });
    }
    clearTokens();
    onAuthFailure?.();
  }

  if (!res.ok) {
    const errBody = await parseBody(res);
    throw new ApiError(
      res.status,
      extractMessage(errBody, `${res.status} ${res.statusText}`),
      errBody,
    );
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text || !text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
