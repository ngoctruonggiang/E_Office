"use client";

import { useState } from "react";
import { Eye, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { ApiError } from "@/lib/api/client";
import { removeRequestViewer } from "../api/requests";

/**
 * The request's viewable list (watchers). Read-only display; when `canRemove`
 * (the requestor while the request is editable) each chip gets a remove button.
 * Adding viewers — by the requestor or a sharing approval assignee — lives in
 * the top action bar (the "Share" action).
 */
export function RequestViewers({
  requestId,
  viewerIds,
  canRemove = false,
  onChanged,
}: {
  requestId: string;
  viewerIds: string[];
  canRemove?: boolean;
  onChanged?: () => void;
}) {
  const t = useT();
  const { notify } = useNotifications();
  const { resolveName } = useUserDirectory();
  const [busy, setBusy] = useState(false);

  const remove = async (userId: string) => {
    setBusy(true);
    try {
      await removeRequestViewer(requestId, userId);
      notify({ title: t("toast.viewerRemoved"), kind: "success" });
      onChanged?.();
    } catch (err) {
      notify({
        title: t("toast.actionFailed"),
        message:
          err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  if (viewerIds.length === 0) {
    return <EmptyState compact title={t("viewers.none")} />;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {viewerIds.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
        >
          <Eye size={12} className="text-muted-foreground" />
          {resolveName(id)}
          {canRemove && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove(id)}
              title={t("common.delete")}
              className="rounded-full text-secondary-foreground/70 hover:text-destructive disabled:opacity-50"
            >
              <X size={13} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
