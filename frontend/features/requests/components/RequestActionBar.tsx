"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  RefreshCw,
  Ban,
  Forward,
  Flag,
  Copy,
  Pencil,
  Share2,
  Send,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { SignDocumentModal } from "@/features/signing/components/SignDocumentModal";
import { ApiError } from "@/lib/api/client";
import {
  actOnRequest,
  reviseRequest,
  cloneRequest,
  cancelRequest,
  requestChangesSelf,
} from "../api/requests";
import { availableActions } from "../lib/flow";
import type { RequestDetail, TaskAction } from "../types/detail";

/**
 * Contextual request action bar (Design Rules 1.4, 7.2 & AP #9):
 * surfaces at most 1 primary CTA (GAFOOD accent), 1 secondary button, and
 * groups overflow / destructive actions inside an overflow menu (`...`).
 */
export function RequestActionBar({
  detail,
  userId,
  onActed,
  canEditForm = false,
  isEditingForm = false,
  onEditForm,
  canShare = false,
  onShare,
  canConfirmDraft = false,
  onConfirmDraft,
}: {
  detail: RequestDetail;
  userId: string;
  onActed: () => void;
  canEditForm?: boolean;
  isEditingForm?: boolean;
  onEditForm?: () => void;
  canShare?: boolean;
  onShare?: () => void;
  canConfirmDraft?: boolean;
  onConfirmDraft?: () => Promise<void>;
}) {
  const t = useT();
  const router = useRouter();
  const { open, close } = useModal();
  const { notify } = useNotifications();
  const [busy, setBusy] = useState(false);

  const actions = availableActions(detail.flow, detail.createdById, userId);
  const isOwner = detail.createdById === userId;
  const awaitingRevision = detail.status === "REQUEST_CHANGES" && isOwner;

  const fail = (err: unknown) =>
    notify({
      title: t("toast.actionFailed"),
      message: err instanceof ApiError || err instanceof Error ? err.message : "",
      kind: "error",
    });

  const act = async (action: TaskAction, successKey: string) => {
    setBusy(true);
    try {
      await actOnRequest(detail.id, action);
      notify({ title: t(successKey), kind: "success" });
      onActed();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const doRevise = (mode: "reset" | "reserve") => async () => {
    try {
      const clone = await reviseRequest(detail.id, mode);
      notify({ title: t("toast.cloned"), kind: "success" });
      close();
      router.push(`/requests/${clone.id}`);
    } catch (err) {
      fail(err);
    }
  };

  const doCloneReset = async () => {
    setBusy(true);
    try {
      const clone = await cloneRequest(detail.id, "reset");
      notify({ title: t("toast.cloned"), kind: "success" });
      router.push(`/requests/${clone.id}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const doConfirmDraft = async () => {
    if (!onConfirmDraft) return;
    setBusy(true);
    try {
      await onConfirmDraft();
    } finally {
      setBusy(false);
    }
  };

  const canSelfCancel =
    isOwner &&
    (detail.status === "DRAFT" ||
      detail.status === "PENDING" ||
      detail.status === "REQUEST_CHANGES");
  const canSelfRequestChanges = isOwner && detail.status === "PENDING";
  const canCloneReset =
    detail.status === "APPROVED" ||
    detail.status === "REJECTED" ||
    detail.status === "CANCELLED";

  const runSelf =
    (fn: () => Promise<unknown>, successKey: string) => async () => {
      setBusy(true);
      try {
        await fn();
        notify({ title: t(successKey), kind: "success" });
        onActed();
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    };

  const hasApprovalActions = !!actions.task;
  const hasAnything =
    canConfirmDraft ||
    (canEditForm && !isEditingForm) ||
    canShare ||
    awaitingRevision ||
    hasApprovalActions ||
    canSelfCancel ||
    canSelfRequestChanges ||
    canCloneReset;
  if (!hasAnything) return null;

  const primaryAction = actions.primary[0];
  const isClose = actions.task?.type === "CLOSE";
  const hasSigningDoc = !!detail.signatureDocumentId;

  const openSignModal = (mode: "approve" | "reject") =>
    open(
      <SignDocumentModal
        requestId={detail.id}
        documentId={detail.signatureDocumentId!}
        currentUserId={userId}
        mode={mode}
        onActed={onActed}
        docName={detail.formName}
      />,
      { size: "4xl" },
    );

  // Determine the single primary CTA
  let primaryCta: React.ReactNode = null;
  if (canConfirmDraft) {
    primaryCta = (
      <Button variant="accent" loading={busy} onClick={doConfirmDraft}>
        <Send size={15} />
        {t("draft.submit")}
      </Button>
    );
  } else if (awaitingRevision) {
    primaryCta = (
      <Button
        variant="accent"
        disabled={busy}
        onClick={() => open(<ReviseDialog onPick={doRevise} />)}
      >
        <RefreshCw size={15} />
        {t("revise.action")}
      </Button>
    );
  } else if (!awaitingRevision && primaryAction) {
    primaryCta = (
      <Button
        variant="accent"
        loading={busy}
        onClick={() => {
          if (primaryAction === "APPROVE" && hasSigningDoc) {
            openSignModal("approve");
            return;
          }
          act(
            primaryAction,
            isClose
              ? "toast.closed"
              : primaryAction === "COMPLETE"
                ? "toast.completed"
                : "toast.approved",
          );
        }}
      >
        {isClose ? <Flag size={15} /> : <Check size={15} />}
        {isClose ? t("detail.closeFlow") : t(`taskAction.${primaryAction}`)}
      </Button>
    );
  } else if (canCloneReset) {
    primaryCta = (
      <Button variant="outline" loading={busy} onClick={doCloneReset}>
        <Copy size={15} />
        {t("clone.reset")}
      </Button>
    );
  }

  // Determine at most 1 prominent secondary action; rest go into overflow menu
  let secondaryButton: React.ReactNode = null;
  let secondaryUsedBy: "edit" | "requestChanges" | "share" | null = null;
  if (canEditForm && !isEditingForm && onEditForm) {
    secondaryUsedBy = "edit";
    secondaryButton = (
      <Button variant="outline" disabled={busy} onClick={onEditForm}>
        <Pencil size={14} />
        {t("common.edit")}
      </Button>
    );
  } else if (!awaitingRevision && actions.canRequestChanges) {
    secondaryUsedBy = "requestChanges";
    secondaryButton = (
      <Button
        variant="outline"
        loading={busy}
        onClick={() =>
          open(
            <ConfirmDialog
              title={t("requestChanges.title")}
              description={t("requestChanges.desc")}
              confirmLabel={t("taskAction.REQUEST_CHANGES")}
              onConfirm={() => act("REQUEST_CHANGES", "toast.changesRequested")}
            />,
          )
        }
      >
        <RefreshCw size={14} />
        {t("taskAction.REQUEST_CHANGES")}
      </Button>
    );
  } else if (canShare && onShare && !primaryCta) {
    secondaryUsedBy = "share";
    secondaryButton = (
      <Button variant="outline" disabled={busy} onClick={onShare}>
        <Share2 size={14} />
        {t("viewers.share")}
      </Button>
    );
  }

  // Overflow menu items
  const menuItems: ActionMenuItem[] = [];

  if (canEditForm && !isEditingForm && onEditForm && secondaryUsedBy !== "edit") {
    menuItems.push({
      id: "edit-form",
      label: t("common.edit"),
      icon: <Pencil size={14} />,
      disabled: busy,
      onSelect: onEditForm,
    });
  }

  if (canShare && onShare && secondaryUsedBy !== "share") {
    menuItems.push({
      id: "share-viewers",
      label: t("viewers.share"),
      icon: <Share2 size={14} />,
      disabled: busy,
      onSelect: onShare,
    });
  }

  if (!awaitingRevision && actions.canForward) {
    menuItems.push({
      id: "forward",
      label: t("taskAction.FORWARD"),
      icon: <Forward size={14} />,
      disabled: busy,
      onSelect: () =>
        notify({
          title: "Tính năng chuyển tiếp đang bảo trì",
          message:
            "Tính năng chuyển tiếp hiện đang được bảo trì. Vui lòng thử lại sau.\n\nTips (không chỉ định): Có thể yêu cầu chỉnh sửa luồng phê duyệt, nhưng điều này sẽ mất trạng thái phê duyệt cũ.",
          kind: "warning",
        }),
    });
  }

  if (!awaitingRevision && canSelfRequestChanges) {
    menuItems.push({
      id: "self-request-changes",
      label: t("taskAction.REQUEST_CHANGES"),
      icon: <RefreshCw size={14} />,
      disabled: busy,
      onSelect: () =>
        open(
          <ConfirmDialog
            title={t("selfChanges.title")}
            description={t("selfChanges.desc")}
            confirmLabel={t("taskAction.REQUEST_CHANGES")}
            onConfirm={runSelf(
              () => requestChangesSelf(detail.id),
              "toast.changesRequested",
            )}
          />,
        ),
    });
  }

  if (!awaitingRevision && actions.canReject) {
    menuItems.push({
      id: "reject",
      label: t("taskAction.REJECT"),
      icon: <X size={14} />,
      tone: "danger",
      disabled: busy,
      dividerBefore: menuItems.length > 0,
      onSelect: () => {
        if (hasSigningDoc) {
          openSignModal("reject");
          return;
        }
        open(
          <ConfirmDialog
            title={t("confirm.rejectTitle")}
            description={t("confirm.rejectDesc")}
            confirmLabel={t("taskAction.REJECT")}
            tone="danger"
            onConfirm={() => act("REJECT", "toast.rejected")}
          />,
        );
      },
    });
  }

  if (canSelfCancel) {
    menuItems.push({
      id: "cancel-request",
      label: t("taskAction.CANCEL"),
      icon: <Ban size={14} />,
      tone: "danger",
      disabled: busy,
      dividerBefore:
        menuItems.length > 0 && menuItems[menuItems.length - 1]?.tone !== "danger",
      onSelect: () =>
        open(
          <ConfirmDialog
            title={t("confirm.cancelTitle")}
            description={t("confirm.cancelDesc")}
            confirmLabel={t("taskAction.CANCEL")}
            tone="danger"
            onConfirm={runSelf(() => cancelRequest(detail.id), "toast.cancelled")}
          />,
        ),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {secondaryButton}
      {primaryCta}
      <ActionMenu items={menuItems} label={t("common.actions")} />
    </div>
  );
}

/** Requestor's clone-strategy picker, shown when reviving a returned request. */
function ReviseDialog({
  onPick,
}: {
  onPick: (mode: "reset" | "reserve") => () => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState<"reset" | "reserve" | null>(null);

  const choose = (mode: "reset" | "reserve") => async () => {
    setBusy(mode);
    try {
      await onPick(mode)();
    } finally {
      setBusy(null);
    }
  };

  const options: { mode: "reset" | "reserve"; title: string; desc: string }[] = [
    {
      mode: "reserve",
      title: t("requestChanges.reserve"),
      desc: t("requestChanges.reserveDesc"),
    },
    {
      mode: "reset",
      title: t("requestChanges.reset"),
      desc: t("requestChanges.resetDesc"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          {t("revise.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("revise.desc")}</p>
      </div>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            disabled={busy !== null}
            onClick={choose(opt.mode)}
            className="w-full cursor-pointer rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-surface-secondary disabled:opacity-50"
          >
            <p className="text-sm font-medium text-foreground">{opt.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
