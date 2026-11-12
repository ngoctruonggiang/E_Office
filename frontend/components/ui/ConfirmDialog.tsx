"use client";

import { useState } from "react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { Button } from "./Button";

export type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
};

/** Reusable confirm popup. Open via `useModal().open(<ConfirmDialog … />)`. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  onConfirm,
}: ConfirmDialogProps) {
  const t = useT();
  const { close } = useModal();
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={close} disabled={busy}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
        <Button
          variant={tone === "danger" ? "danger-solid" : "primary"}
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              close();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </div>
    </div>
  );
}
