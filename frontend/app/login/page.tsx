"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/client";

const demoAccounts = [
  {
    title: "👑 Administrator",
    email: "admin@gafood.local",
    password: "admin@P@ssw0rd123",
  },
  {
    title: "👤 User",
    email: "user@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "👤 User 1",
    email: "user1@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "👤 User 2",
    email: "user2@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "👤 User 3",
    email: "user3@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "👤 User 4",
    email: "user4@example.com",
    password: "P@ssw0rd123",
  },
];

type DemoAccountsProps = {
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
};

function DemoAccounts({
  setEmail,
  setPassword,
}: DemoAccountsProps)  {
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  return (<div className="w-64">
  <Button
    type="button"
    variant="outline"
    className="w-full"
    onClick={() => setShowDemoAccounts((v) => !v)}
  >
    Demo Accounts
  </Button>

  {showDemoAccounts && (
    <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-foreground">
        Demo accounts
      </p>

      <div className="space-y-2">
        {demoAccounts.map((account) => (
          <button
            key={account.email}
            type="button"
            className="w-full rounded-md border border-border p-3 text-left transition hover:bg-accent"
            onClick={() => {
              setEmail(account.email);
              setPassword(account.password);
            }}
          >
            <div className="font-medium">{account.title}</div>
            <div className="text-xs text-muted-foreground">
              {account.email}
            </div>
          </button>
        ))}
      </div>
    </div>
  )}
</div>)
}

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading, signIn } = useAuth();

  const [email, setEmail] = useState("admin@gafood.local");
  const [password, setPassword] = useState("admin@P@ssw0rd123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → leave the login page.
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
            : t("common.error")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="flex w-full max-w-3xl items-start justify-center gap-4">
          <DemoAccounts setEmail={(email: string) => setEmail(email)} setPassword={(password: string ) => setPassword(password)} />
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                g
              </span>
              <h1 className="text-xl font-semibold text-foreground">
                {t("auth.signInTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("auth.signInSubtitle")}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
            >
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

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                loading={submitting}
                className="w-full justify-center"
              >
                {submitting ? t("auth.signingIn") : t("auth.signInButton")}
              </Button>
            </form>
          </div>
          </div>
      </div>
    </div>
  );
}
