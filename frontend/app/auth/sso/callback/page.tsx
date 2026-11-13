"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSsoConfig } from "@/features/auth/api/auth";

function SsoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithSso } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (errorParam) {
      setError(errorDesc || errorParam);
      return;
    }

    if (!code) {
      setError("Không tìm thấy mã xác thực (Authorization Code)");
      return;
    }

    const verifier = sessionStorage.getItem("pkce_verifier");
    if (!verifier) {
      setError("Không tìm thấy PKCE code verifier trong phiên làm việc");
      return;
    }

    let active = true;

    async function handleExchange() {
      try {
        const config = await getSsoConfig();
        const redirectUri = `${window.location.origin}/auth/sso/callback`;

        const body = new URLSearchParams();
        body.append("grant_type", "authorization_code");
        body.append("client_id", config.clientId);
        body.append("code", code!);
        body.append("redirect_uri", redirectUri);
        body.append("code_verifier", verifier!);

        const tokenRes = await fetch(config.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.json().catch(() => ({}));
          throw new Error(errData.error_description || "Đổi token thất bại từ Keycloak");
        }

        const tokenData = await tokenRes.json();
        sessionStorage.removeItem("pkce_verifier");

        if (active) {
          await signInWithSso({
            accessToken: tokenData.access_token,
            idToken: tokenData.id_token,
          });
          router.replace("/");
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Xác thực SSO thất bại");
        }
      }
    }

    handleExchange();

    return () => {
      active = false;
    };
  }, [searchParams, signInWithSso, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-secondary p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-lg">
        {error ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Đăng nhập SSO Thất bại</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => router.replace("/login")}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Quay lại màn hình Đăng nhập
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <h2 className="text-lg font-semibold text-foreground">Đang xác thực với Keycloak IAM...</h2>
            <p className="text-sm text-muted-foreground">Vui lòng chờ trong giây lát khi hệ thống đồng bộ danh bạ</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-secondary p-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <SsoCallbackContent />
    </Suspense>
  );
}
