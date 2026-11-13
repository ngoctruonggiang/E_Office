"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { getSsoConfig } from "@/features/auth/api/auth";

const keycloakAccounts = [
  {
    title: "Nguyễn Văn Mua Sắm (Trưởng phòng Mua hàng)",
    email: "buyer@gafood.local",
    password: "user123",
    department: "Phòng Mua Hàng",
  },
  {
    title: "Lê Thị Kế Toán (Kế toán trưởng)",
    email: "accountant@gafood.local",
    password: "user123",
    department: "Phòng Tài Chính Kế Toán",
  },
  {
    title: "Trần Văn Nhân Viên (Chuyên viên Hành chính)",
    email: "staff@gafood.local",
    password: "user123",
    department: "Phòng Hành Chính Nhân Sự",
  },
  {
    title: "Quản Trị Viên (Keycloak Admin)",
    email: "admin@gafood.local",
    password: "admin123",
    department: "Ban Giám Đốc",
  },
];

const demoAccounts = [
  {
    title: "Administrator (Local Auth)",
    email: "admin@gafood.local",
    password: "admin@P@ssw0rd123",
  },
  {
    title: "User 1 (Local Auth)",
    email: "user1@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "User 2 (Local Auth)",
    email: "user2@example.com",
    password: "P@ssw0rd123",
  },
];

function generateRandomString(length: number) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map((x) => possible[x % possible.length]).join("");
}

async function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(str: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading, signIn, signInWithSso } = useAuth();

  const [email, setEmail] = useState("admin@gafood.local");
  const [password, setPassword] = useState("admin@P@ssw0rd123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [showDemos, setShowDemos] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? t("auth.invalidCredentials")
          : err instanceof Error
            ? err.message
            : t("common.error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeycloakSso = async () => {
    try {
      setSsoLoading(true);
      setError(null);
      const config = await getSsoConfig();
      const verifier = generateRandomString(64);
      sessionStorage.setItem("pkce_verifier", verifier);
      const hashed = await sha256(verifier);
      const challenge = base64UrlEncode(hashed);
      const redirectUri = `${window.location.origin}/auth/sso/callback`;

      const url = new URL(config.authUrl);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid profile email");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");

      window.location.href = url.toString();
    } catch (err: any) {
      setError(err.message || "Không thể kết nối tới Keycloak IAM");
      setSsoLoading(false);
    }
  };

  const handleQuickKeycloakLogin = async (account: (typeof keycloakAccounts)[0]) => {
    try {
      setSsoLoading(true);
      setError(null);
      const config = await getSsoConfig();
      const body = new URLSearchParams();
      body.append("grant_type", "password");
      body.append("client_id", config.clientId);
      body.append("username", account.email);
      body.append("password", account.password);
      body.append("scope", "openid profile email");

      const tokenRes = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!tokenRes.ok) {
        throw new Error("Xác thực với Keycloak thất bại");
      }

      const tokenData = await tokenRes.json();
      await signInWithSso({
        accessToken: tokenData.access_token,
        idToken: tokenData.id_token,
      });
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Lỗi khi đăng nhập nhanh Keycloak");
    } finally {
      setSsoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-secondary">
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
              g
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-highlight ring-2 ring-surface-secondary"
              />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t("auth.signInTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.signInSubtitle")}
            </p>
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
            {/* Nút đăng nhập SSO Keycloak chuẩn OIDC/PKCE */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              loading={ssoLoading}
              onClick={handleKeycloakSso}
              className="w-full border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-medium flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} />
              <span>Đăng nhập bằng Keycloak SSO</span>
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-subtle" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-surface px-2 text-muted-foreground">Hoặc đăng nhập mật khẩu</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <Field label={t("auth.emailLabel")} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  placeholder={t("auth.emailPlaceholder")}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label={t("auth.passwordLabel")} htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  placeholder={t("auth.passwordPlaceholder")}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error && <InlineNotice kind="danger" title={error} />}

              <Button
                type="submit"
                variant="accent"
                size="lg"
                loading={submitting}
                className="w-full"
              >
                {submitting ? t("auth.signingIn") : t("auth.signInButton")}
              </Button>
            </form>
          </div>

          {/* Quick SSO & Demo Accounts picker */}
          <div className="rounded-lg border border-border-subtle bg-surface">
            <button
              type="button"
              onClick={() => setShowDemos((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>Tài khoản mẫu (Keycloak SSO & Local)</span>
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform",
                  showDemos && "rotate-180",
                )}
              />
            </button>
            {showDemos && (
              <div className="divide-y divide-border-subtle border-t border-border-subtle">
                <div className="bg-surface-secondary px-3 py-1 text-[11px] font-semibold text-primary uppercase">
                  Tài khoản Keycloak IAM (Có Phòng ban & Chức danh)
                </div>
                {keycloakAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    disabled={ssoLoading}
                    onClick={() => handleQuickKeycloakLogin(account)}
                    className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-xs transition-colors hover:bg-surface-secondary"
                  >
                    <div>
                      <div className="font-medium text-foreground">{account.title}</div>
                      <div className="text-[11px] text-muted-foreground">{account.email}</div>
                    </div>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Đăng nhập SSO &rarr;
                    </span>
                  </button>
                ))}

                <div className="bg-surface-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase">
                  Tài khoản Cục bộ (Local Auth)
                </div>
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setShowDemos(false);
                    }}
                    className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-xs transition-colors hover:bg-surface-secondary"
                  >
                    <span className="font-medium text-foreground">
                      {account.title}
                    </span>
                    <span className="text-muted-foreground">
                      {account.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
