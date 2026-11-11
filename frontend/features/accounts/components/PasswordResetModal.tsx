"use client";

import { useState } from "react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/client";
import { setUserPassword } from "../api/accounts";
import type { UserLite } from "@/features/users/types/user";

export type PasswordResetModalProps = {
  account: UserLite;
};

/** Admin password reset for an account. */
export function PasswordResetModal({ account }: PasswordResetModalProps) {
  const t = useT();
  const { close } = useModal();
  const { notify } = useNotifications();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await setUserPassword(account.id, password);
      notify({ title: t("staff.passwordReset"), kind: "success" });
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("staff.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          {t("staff.resetPassword")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {account.displayName ?? account.email}
        </p>
      </div>

      <Field label={t("staff.newPassword")} required hint="≥ 8">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} loading={busy} disabled={password.length < 8}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
