// Mirrors be/src/modules/auth/dto/auth-response.dto.ts and
// be/src/modules/user/dto/user-response.dto.ts.

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

/** Full profile from GET /users/me. */
export type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  signatureName: string | null;
  signatureImage: string | null;
  createdAt: string;
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
