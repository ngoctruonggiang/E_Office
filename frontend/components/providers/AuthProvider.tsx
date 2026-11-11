"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { setAuthFailureHandler } from "@/lib/api/client";
import {
  clearTokens,
  getAccessToken,
  setTokens,
} from "@/lib/auth/storage";
import * as authApi from "@/features/auth/api/auth";
import type { LoginInput, UserProfile } from "@/features/auth/types/auth";

type AuthContextValue = {
  user: UserProfile | null;
  /** True until the initial "am I logged in?" check resolves. */
  loading: boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the current user. On mount it bootstraps from a stored access token by
 * calling GET /users/me; a failed/expired token (after the client's transparent
 * refresh) clears state. Registers an auth-failure handler so any 401 that
 * can't be refreshed kicks the user back to /login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap session from a stored token.
  useEffect(() => {
    let active = true;
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then((me) => active && setUser(me))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // When the API client loses auth irrecoverably, drop the user and redirect.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      router.replace("/login");
    });
    return () => setAuthFailureHandler(null);
  }, [router]);

  const signIn = useCallback(async (input: LoginInput) => {
    const res = await authApi.login(input);
    setTokens({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      deviceId: res.deviceId,
    });
    const me = await authApi.getMe();
    setUser(me);
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    clearTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
