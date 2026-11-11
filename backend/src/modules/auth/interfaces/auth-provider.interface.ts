/**
 * ─────────────────────────────────────────────────────────────────────────
 *  AuthProvider — the seam that makes this module SSO-ready.
 *
 *  All authentication flows are expressed in terms of this interface. Today it
 *  is implemented by `LocalAuthProvider` (email + password, JWT issued by us).
 *  Tomorrow it can be implemented by an `OidcAuthProvider` / `OAuth2Provider`
 *  that delegates to an external Identity Provider (Keycloak, Auth0, Cognito…)
 *  WITHOUT touching controllers, guards or the user module — only the binding
 *  in `auth.module.ts` changes.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** DI token used to bind a concrete provider in the module. */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

/** The principal attached to `req.user` after a successful guard check. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  /** JWT id of the access token — needed for blacklisting on logout. */
  jti: string;
  /** Device/session identifier — one refresh token per device. */
  deviceId: string;
  /** Access-token expiry (epoch seconds) — used to size the blacklist TTL. */
  accessExp: number;
}

/** Claims embedded in our JWTs. */
export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  jti: string;
  deviceId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResult {
  user: Pick<AuthenticatedUser, 'userId' | 'email' | 'role'>;
  tokens: AuthTokens;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
  deviceId: string;
}

export interface LoginInput {
  email: string;
  password: string;
  deviceId: string;
}

export interface RefreshInput {
  refreshToken: string;
  deviceId: string;
}

export interface LogoutInput {
  userId: string;
  deviceId: string;
  /** Access-token jti + remaining seconds, so we can blacklist it. */
  accessJti: string;
  accessExpiresInSec: number;
  /** When true, revoke refresh tokens for every device. */
  allDevices?: boolean;
}

export interface AuthProvider {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  /** Validates + rotates the refresh token, returning a fresh token pair. */
  refresh(input: RefreshInput): Promise<AuthResult>;
  logout(input: LogoutInput): Promise<void>;
}
