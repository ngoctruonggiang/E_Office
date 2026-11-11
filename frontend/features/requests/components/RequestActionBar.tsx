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
import { UserPicker } from "@/features/users/components/UserPicker";
import { SignDocumentModal } from "@/features/signing/components/SignDocumentModal";
import { ApiError } from "@/lib/api/client";
import {
  actOnRequest,
  reviseRequest,
  cloneRequest,
  forwardRequest,
  cancelRequest,
  requestChangesSelf,
} from "../api/requests";
import { availableActions } from "../lib/flow";
import type { RequestDetail, TaskAction } from "../types/detail";

/**
 * The request's single top action bar. Hosts every button that interacts with
 * the request: the draft Confirm, edit-form toggle, share (add viewers), the
 * approver's approval actions, and the requestor's revise / clone / cancel.
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
  /** Requestor may edit the form values (top toggle). */
  canEditForm?: boolean;
  isEditingForm?: boolean;
  onEditForm?: () => void;
  /** Requestor or sharing assignee may add viewers. */
  canShare?: boolean;
  onShare?: () => void;
  /** Draft clone: confirm submits it (draft → pending). */
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

  // Clone-reset a finished request into a fresh DRAFT craft and open it.
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

  const doForward = async (toUserId: string) => {
    setBusy(true);
    try {
      await forwardRequest(detail.id, toUserId);
      notify({ title: t("taskAction.FORWARD"), kind: "success" });
      onActed();
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

  // Requestor's standalone actions (independent of any flow task).
  const canSelfCancel =
    isOwner &&
    (detail.status === "DRAFT" ||
      detail.status === "PENDING" ||
      detail.status === "REQUEST_CHANGES");
  const canSelfRequestChanges = isOwner && detail.status === "PENDING";
  // A finished request can be cloned into a fresh DRAFT craft (clone-reset).
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

  const cancelButton = (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() =>
        open(
          <ConfirmDialog
            title={t("confirm.cancelTitle")}
            description={t("confirm.cancelDesc")}
            confirmLabel={t("taskAction.CANCEL")}
            tone="danger"
            onConfirm={runSelf(() => cancelRequest(detail.id), "toast.cancelled")}
          />,
        )
      }
    >
      <Ban size={15} />
      {t("taskAction.CANCEL")}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Draft confirm: submit the cloned draft (draft → pending). */}
      {canConfirmDraft && (
        <Button loading={busy} onClick={doConfirmDraft}>
          <Send size={16} />
          {t("draft.submit")}
        </Button>
      )}

      {/* Edit the form values in place. */}
      {canEditForm && !isEditingForm && (
        <Button variant="outline" disabled={busy} onClick={onEditForm}>
          <Pencil size={15} />
          {t("common.edit")}
        </Button>
      )}

      {/* Share: add viewers to the viewable list. */}
      {canShare && (
        <Button variant="outline" disabled={busy} onClick={onShare}>
          <Share2 size={15} />
          {t("viewers.share")}
        </Button>
      )}

      {/* Requestor handling a returned request: revise (clone reset|reserve). */}
      {awaitingRevision && (
        <Button
          disabled={busy}
          onClick={() => open(<ReviseDialog onPick={doRevise} />)}
        >
          <RefreshCw size={16} />
          {t("revise.action")}
        </Button>
      )}

      {/* Approver's actions on a pending task. */}
      {!awaitingRevision && primaryAction && (
        <Button
          loading={busy}
          onClick={() => {
            // An approval on a request with an online-signing document must go
            // through the APPROVE popup (sign-then-approve).
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
          {isClose ? <Flag size={16} /> : <Check size={16} />}
          {isClose ? t("detail.closeFlow") : t(`taskAction.${primaryAction}`)}
        </Button>
      )}

      {!awaitingRevision && actions.canRequestChanges && (
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
          <RefreshCw size={15} />
          {t("taskAction.REQUEST_CHANGES")}
        </Button>
      )}

      {!awaitingRevision && actions.canForward && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            notify({
              title: "Tính năng chuyển tiếp đang bảo trì",
              message: "Tính năng chuyển tiếp hiện đang được bảo trì. Vui lòng thử lại sau.\n\n Tips (không chỉ định): Có thể yêu cầu chỉnh sửa luồng phê duyệt, nhưng điều này sẽ mất trạng thái phê duyệt cũ.",
              kind: "warning",
            }
          )
            // open(
            //   <UserPicker
            //     title={t("taskAction.FORWARD")}
            //     initialSelected={[]}
            //     excludeIds={[userId]}
            //     single
            //     onConfirm={(ids) => {
            //       if (ids[0]) void doForward(ids[0]);
            //     }}
            //   />,
            // )
          }
        >
          <Forward size={15} />
          {t("taskAction.FORWARD")}
        </Button>
      )}

      {!awaitingRevision && actions.canReject && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            // With an online-signing document, rejecting goes through the
            // document popup (reject sign + reject request).
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
          }}
        >
          <X size={15} />
          {t("taskAction.REJECT")}
        </Button>
      )}

      {/* Requestor's standalone request-changes (pull a pending request back). */}
      {!awaitingRevision && canSelfRequestChanges && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
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
            )
          }
        >
          <RefreshCw size={15} />
          {t("taskAction.REQUEST_CHANGES")}
        </Button>
      )}

      {canSelfCancel && cancelButton}

      {/* Finished request: start a fresh DRAFT craft from it (clone-reset). */}
      {canCloneReset && (
        <Button loading={busy} onClick={doCloneReset}>
          <Copy size={16} />
          {t("clone.reset")}
        </Button>
      )}
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
        <h2 className="text-lg font-semibold text-foreground">
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
            className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
          >
            <p className="text-sm font-medium text-foreground">{opt.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
