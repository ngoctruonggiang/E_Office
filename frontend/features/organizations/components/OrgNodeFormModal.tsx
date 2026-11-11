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
import { createOrg, updateOrg } from "../api/organizations";
import type { OrgNode, OrgTreeNode } from "../types/organization";

type Mode =
  | { kind: "createRoot" }
  | { kind: "createChild"; parentId: string }
  | { kind: "rename"; node: OrgNode | OrgTreeNode };

export type OrgNodeFormModalProps = {
  mode: Mode;
  onSaved: () => void;
};

/** Create a root company, add a sub-unit, or rename/re-type a node. */
export function OrgNodeFormModal({ mode, onSaved }: OrgNodeFormModalProps) {
  const t = useT();
  const { close } = useModal();
  const { notify } = useNotifications();

  const existing = mode.kind === "rename" ? mode.node : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState(
    existing?.type ?? (mode.kind === "createRoot" ? "company" : "department"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleKey =
    mode.kind === "createRoot"
      ? "staff.newCompany"
      : mode.kind === "createChild"
        ? "staff.addChild"
        : "staff.rename";

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === "rename") {
        await updateOrg(mode.node.id, { name: name.trim(), type });
        notify({ title: t("staff.nodeUpdated"), kind: "success" });
      } else if (mode.kind === "createChild") {
        await createOrg({ name: name.trim(), type, parentId: mode.parentId });
        notify({ title: t("staff.nodeCreated"), kind: "success" });
      } else {
        await createOrg({ name: name.trim(), type: "company" });
        notify({ title: t("staff.companyCreated"), kind: "success" });
      }
      onSaved();
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("staff.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t(titleKey)}</h2>

      <Field
        label={mode.kind === "createRoot" ? t("staff.company") : t("staff.nodeName")}
        required
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>

      {mode.kind !== "createRoot" && (
        <Field label={t("staff.nodeType")}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="company">{t("staff.typeCompany")}</option>
            <option value="department">{t("staff.typeDepartment")}</option>
            <option value="group">{t("staff.typeGroup")}</option>
          </Select>
        </Field>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={submit}
          loading={busy}
          disabled={name.trim().length === 0}
        >
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
