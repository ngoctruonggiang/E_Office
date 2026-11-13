// Mirrors be/src/modules/auth/dto/auth-response.dto.ts and
// be/src/modules/user/dto/user-response.dto.ts.

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  displayName?: string | null;
  department?: string | null;
  title?: string | null;
};

/** Full profile from GET /users/me. */
export type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  department?: string | null;
  title?: string | null;
  keycloakSub?: string | null;
  signatureName: string | null;
  signatureImage: string | null;
  createdAt: string;
};

export type SsoConfig = {
  enabled: boolean;
  provider: string;
  issuer: string;
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  logoutUrl: string;
};

/** Shape returned by POST /auth/login | /register | /refresh. */
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
  deviceId: string;
};

export type LoginInput = {
  email: string;
  password: string;
};
