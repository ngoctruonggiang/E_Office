"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const demoAccounts = [
  {
    title: "Administrator",
    email: "admin@gafood.local",
    password: "admin@P@ssw0rd123",
  },
  {
    title: "User",
    email: "user@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "User 1",
    email: "user1@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "User 2",
    email: "user2@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "User 3",
    email: "user3@example.com",
    password: "P@ssw0rd123",
  },
  {
    title: "User 4",
    email: "user4@example.com",
    password: "P@ssw0rd123",
  },
];

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading, signIn } = useAuth();

  const [email, setEmail] = useState("admin@gafood.local");
  const [password, setPassword] = useState("admin@P@ssw0rd123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-border bg-surface p-6"
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

          {/* Compact collapsible demo account picker */}
          <div className="rounded-lg border border-border-subtle bg-surface">
            <button
              type="button"
              onClick={() => setShowDemos((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{t("auth.demoAccounts")}</span>
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
