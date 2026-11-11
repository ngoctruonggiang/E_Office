"use client";

import { useState } from "react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/client";
import { createUser, adminUpdateUser } from "../api/accounts";
import type { UserLite } from "@/features/users/types/user";

export type AccountFormModalProps = {
  /** Existing account to edit; omit to create. */
  account?: UserLite;
  onSaved: () => void;
};

/** Create or edit an account (admin). Email + password are create-only. */
export function AccountFormModal({ account, onSaved }: AccountFormModalProps) {
  const t = useT();
  const { close } = useModal();
  const { notify } = useNotifications();
  const editing = Boolean(account);

  const [email, setEmail] = useState(account?.email ?? "user@example.com");
  const [displayName, setDisplayName] = useState(account?.displayName ?? "");
  const [password, setPassword] = useState("P@ssw0rd123");
  const [role, setRole] = useState(account?.role ?? "user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing && account) {
        await adminUpdateUser(account.id, {
          displayName: displayName.trim(),
          role,
        });
        notify({ title: t("staff.accountUpdated"), kind: "success" });
      } else {
        await createUser({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
          role,
        });
        notify({ title: t("staff.accountCreated"), kind: "success" });
      }
      onSaved();
      close();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("staff.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = editing
    ? true
    : email.trim().length > 0 && password.length >= 8;

  return (
    <div className="w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {editing ? t("staff.editAccount") : t("staff.newAccount")}
      </h2>

      <Field label={t("staff.email")} required>
        <Input
          type="email"
          value={email}
          disabled={editing}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
        />
      </Field>

      <Field label={t("staff.displayName")}>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Jane Doe"
        />
      </Field>

      {!editing && (
        <Field
          label={t("staff.password")}
          required
          hint="≥ 8"
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      )}

      <Field label={t("staff.systemRole")}>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">{t("staff.roleUser")}</option>
          <option value="admin">{t("staff.roleAdmin")}</option>
        </Select>
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} loading={busy} disabled={!canSubmit}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
