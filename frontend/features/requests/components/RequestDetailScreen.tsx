"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSignature,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserPicker } from "@/features/users/components/UserPicker";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import {
  getDocument,
  softDeleteDocument,
  uploadDocument,
} from "@/features/documents/api/documents";
import { SignDocumentModal } from "@/features/signing/components/SignDocumentModal";
import { getSignature, setSignature } from "@/features/signing/api/signature";
import { fetchDocumentBytes } from "@/features/signing/lib/fetch-bytes";
import {
  emptySigningDraft,
  type SigningDraft,
} from "@/features/signing/types/signature";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, shortId } from "@/lib/utils/format";
import { useRequestDetail } from "../hooks/useRequestDetail";
import { addRequestViewers, getRequest, submitDraft } from "../api/requests";
import {
  fromFlowSteps,
  initialFlowDrafts,
  toCreateSteps,
  type FlowStepDraft,
} from "../types/create";
import { isApprovalAssignee } from "../lib/flow";
import { RequestFormData } from "./RequestFormData";
import { RequestDocuments } from "./RequestDocuments";
import { RequestViewers } from "./RequestViewers";
import { ApprovalFlowPanel } from "./ApprovalFlowPanel";
import { CommentThread } from "@/features/comments/components/CommentThread";
import { ApprovalFlowBuilder } from "./create/ApprovalFlowBuilder";
import { RequestActionBar } from "./RequestActionBar";
import { CloneHistory } from "./CloneHistory";

export function RequestDetailScreen({ id }: { id: string }) {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const { open } = useModal();
  const { notify } = useNotifications();
  const { resolveName } = useUserDirectory();
  const { detail, loading, error, reload } = useRequestDetail(id);

  const [editingForm, setEditingForm] = useState(false);
  // Draft-clone approval flow (seeded from the parent it was cloned from).
  const [draftSteps, setDraftSteps] = useState<FlowStepDraft[]>(
    initialFlowDrafts(),
  );
  const [draftSeeding, setDraftSeeding] = useState(false);
  // Online-signing document + positions while editing a reset draft.
  const [signingDraft, setSigningDraft] = useState<SigningDraft>(emptySigningDraft);

  const isOwner = !!user && user.id === detail?.createdById;
  // "Craft mode" = an owned DRAFT (e.g. a cloned draft) being shaped before it
  // is confirmed. This is the ONLY state where form values may be edited.
  const isCraftMode = isOwner && detail?.status === "DRAFT";
  // A cloned draft the requestor finalizes via Confirm (draft → pending).
  const isDraftClone = isCraftMode && !!detail?.clonedFromId;
  // A reset clone's flow is editable; a reserve clone carries its real flow.
  const isReserveDraft = isDraftClone && detail?.cloneMode === "reserve";
  const isResetDraft = isDraftClone && !isReserveDraft;
  // "In-flight" = submitted and still in the approval lifecycle.
  const isInFlight =
    detail?.status === "PENDING" || detail?.status === "REQUEST_CHANGES";
  // An approval assignee on this request (can share viewers + add documents).
  const isAssignee =
    !!detail && !!user && isApprovalAssignee(detail.flow, user.id);
  // A viewer of this request (on the viewable list).
  const isViewer = !!detail && !!user && detail.viewerIds.includes(user.id);
  // The request is open (not finalized) — drafting or in-flight.
  const isOpen = isCraftMode || isInFlight;

  // Values are editable only in craft mode (DRAFT). Once submitted, locked.
  const canEditForm = isCraftMode;
  // MAIN documents are core content: only the creator manages them, and only in
  // craft mode (DRAFT) — locked in-flight, but editable again after a clone.
  const canAddMain = isOwner && isCraftMode;
  const canRemoveMain = isOwner && isCraftMode;
  // SECONDARY documents: anyone with access (creator, assignee, viewer) may add
  // them at any time; only the creator may remove them, also at any time.
  const canAddSecondary = isOwner || isAssignee || isViewer;
  const canRemoveSecondary = isOwner;
  // Viewable list: requestor adds + removes; an assignee may share (add only).
  const canAddViewers =
    (isOwner && isOpen) || (isAssignee && !isOwner && isInFlight);
  const canRemoveViewers = isOwner && isOpen;
  const canConfirmDraft = isDraftClone;

  // Attached docs split by section; the signing document is shown in its own
  // card (in the approval-flow area), so it is excluded from both lists.
  const mainDocumentIds = detail
    ? detail.documents
        .filter((d) => d.section === "MAIN" && !d.signing)
        .map((d) => d.documentId)
    : [];
  const secondaryDocumentIds = detail
    ? detail.documents
        .filter((d) => d.section === "SECONDARY" && !d.signing)
        .map((d) => d.documentId)
    : [];

  // Creator + approvers can't be added as viewers (flow + draft-builder ones).
  const approverIds = [
    ...(detail
      ? detail.flow.steps.flatMap((s) =>
          s.assignees.filter((a) => a.type !== "CLOSE").map((a) => a.id),
        )
      : []),
    ...draftSteps.flatMap((s) => s.userIds),
  ];

  // Seed the editable approval flow from the parent — reset drafts only (a
  // reserve draft carries its real flow, shown read-only).
  useEffect(() => {
    if (!isResetDraft || !detail?.clonedFromId) return;
    let active = true;
    setDraftSeeding(true);
    getRequest(detail.clonedFromId)
      .then((parent) => {
        if (!active) return;
        setDraftSteps(fromFlowSteps(parent.flow.steps));
      })
      .catch(() => {})
      .finally(() => active && setDraftSeeding(false));
    return () => {
      active = false;
    };
  }, [isResetDraft, detail?.clonedFromId]);

  // Load the kept signing document so a reset draft can be repositioned from
  // scratch (the backend drops the parent's positions on a reset clone).
  const resetDraftDocId = isResetDraft ? detail?.signatureDocumentId : null;
  useEffect(() => {
    if (!resetDraftDocId || !detail) return;
    let active = true;
    const requestId = detail.id;
    (async () => {
      try {
        const [sig, bytes, meta] = await Promise.all([
          getSignature(requestId),
          fetchDocumentBytes(resetDraftDocId),
          getDocument(resetDraftDocId).catch(() => null),
        ]);
        if (!active) return;
        setSigningDraft({
          file: null,
          bytes,
          fileName: meta?.name ?? "document.pdf",
          existingDocumentId: resetDraftDocId,
          fields: sig.fields.map((f) => ({
            id: f.id,
            assigneeId: f.assigneeId,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            label: resolveName(f.assigneeId),
          })),
        });
      } catch {
        /* signing is optional; fall back to no preview */
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetDraftDocId, detail?.id]);

  if (loading) return <LoadingState />;
  if (error || !detail) {
    return (
      <div className="space-y-4">
        <BackButton />
        <EmptyState title={t("detail.empty")} description={error?.message} />
      </div>
    );
  }

  const shareViewers = () =>
    open(
      <UserPicker
        title={t("viewers.share")}
        initialSelected={[]}
        excludeIds={[detail.createdById, ...approverIds, ...detail.viewerIds]}
        onConfirm={(ids) => void addViewers(ids)}
      />,
    );

  const addViewers = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await addRequestViewers(detail.id, ids);
      notify({ title: t("toast.viewersAdded"), kind: "success" });
      reload();
    } catch (err) {
      notify({
        title: t("toast.actionFailed"),
        message:
          err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
    }
  };

  const confirmDraft = async () => {
    // The required final step must have at least one approver — they sign /
    // approve to close the request. (Reserve drafts carry their real flow and
    // don't go through this builder, so only guard reset drafts.)
    if (isResetDraft) {
      const finalStep = draftSteps[draftSteps.length - 1];
      if (!finalStep || finalStep.userIds.length === 0) {
        notify({ title: t("create.finalStepNeedsApprover"), kind: "error" });
        return;
      }
    }

    const steps = toCreateSteps(draftSteps);

    // Reset drafts rebuild the flow, so the signing document is mandatory and
    // its boxes must be (re)positioned to cover the (possibly changed) approver
    // list before submitting (the backend re-checks on submit too).
    if (isResetDraft) {
      const hasSigningDoc = !!(
        signingDraft.file || signingDraft.existingDocumentId
      );
      if (!hasSigningDoc) {
        notify({ title: t("signing.required"), kind: "error" });
        return;
      }
      const ids = steps.flatMap((s) => s.assignees.map((a) => a.userId));
      const missing =
        ids.length === 0 ||
        ids.some((id) => !signingDraft.fields.some((f) => f.assigneeId === id));
      if (missing) {
        notify({ title: t("signing.missingPositions"), kind: "error" });
        return;
      }
    }

    try {
      // Sync signing state first (reset draft only): a new file replaces the
      // old signing document (removed to avoid redundant storage); positions
      // are written from scratch.
      if (isResetDraft) {
        let documentId = signingDraft.existingDocumentId ?? null;
        if (signingDraft.file) {
          const doc = await uploadDocument(signingDraft.file, {
            requestId: detail.id,
          });
          if (signingDraft.existingDocumentId) {
            await softDeleteDocument(signingDraft.existingDocumentId).catch(
              () => {},
            );
          }
          documentId = doc.id;
        }
        await setSignature(detail.id, {
          documentId,
          fields: documentId
            ? signingDraft.fields.map((f) => ({
                assigneeId: f.assigneeId,
                page: f.page,
                x: f.x,
                y: f.y,
                width: f.width,
                height: f.height,
              }))
            : [],
        });
      }

      await submitDraft(detail.id, {
        steps: steps.length ? steps : undefined,
        viewerIds: detail.viewerIds.length ? detail.viewerIds : undefined,
      });
      notify({ title: t("toast.submitted"), kind: "success" });
      reload();
    } catch (err) {
      notify({
        title: t("create.createFailed"),
        message:
          err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
    }
  };

  return (
    <div className="space-y-5">
      <BackButton />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {detail.formName}
            </h1>
            <StatusBadge status={detail.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{shortId(detail.id)}</span> · v
            {detail.version}
          </p>
        </div>

        {user && (
          <RequestActionBar
            detail={detail}
            userId={user.id}
            onActed={reload}
            canEditForm={canEditForm}
            isEditingForm={editingForm}
            onEditForm={() => setEditingForm(true)}
            canShare={canAddViewers}
            onShare={shareViewers}
            canConfirmDraft={canConfirmDraft}
            onConfirmDraft={confirmDraft}
          />
        )}
      </div>

      {/* Body: info + docs + viewers (left), flow (right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.requestInfo")}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("detail.createdBy")}
                  </dt>
                  <dd className="text-foreground">
                    {resolveName(detail.createdById)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("detail.createdAt")}
                  </dt>
                  <dd className="text-foreground">
                    {formatDateTime(detail.createdAt, locale)}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-border pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("detail.formData")}
                </p>
                <RequestFormData
                  requestId={detail.id}
                  formId={detail.formId}
                  values={detail.values}
                  editing={editingForm}
                  onEditingChange={setEditingForm}
                  onSaved={reload}
                />
              </div>
            </CardBody>
          </Card>

          {/* Online signing document (read-only: view / refresh / download). */}
          {detail.signatureDocumentId && !isResetDraft && (
            <Card>
              <CardHeader>
                <CardTitle>{t("signing.section")}</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="mb-3 text-sm text-muted-foreground">
                  {t("signing.sectionDesc")}
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    open(
                      <SignDocumentModal
                        requestId={detail.id}
                        documentId={detail.signatureDocumentId!}
                        currentUserId={user?.id ?? ""}
                        mode="view"
                        docName={detail.formName}
                      />,
                      { size: "4xl" },
                    )
                  }
                >
                  <FileSignature size={15} />
                  {t("signing.open")}
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.mainDocuments")}</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="mb-3 text-sm text-muted-foreground">
                {t("detail.mainDocumentsDesc")}
              </p>
              <RequestDocuments
                documentIds={mainDocumentIds}
                canAdd={canAddMain}
                canRemove={canRemoveMain}
                section="MAIN"
                requestId={detail.id}
                onChanged={reload}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.secondaryDocuments")}</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="mb-3 text-sm text-muted-foreground">
                {t("detail.secondaryDocumentsDesc")}
              </p>
              <RequestDocuments
                documentIds={secondaryDocumentIds}
                canAdd={canAddSecondary}
                canRemove={canRemoveSecondary}
                section="SECONDARY"
                requestId={detail.id}
                onChanged={reload}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.viewers")}</CardTitle>
            </CardHeader>
            <CardBody>
              <RequestViewers
                requestId={detail.id}
                viewerIds={detail.viewerIds}
                canRemove={canRemoveViewers}
                onChanged={reload}
              />
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <CloneHistory requestId={detail.id} currentId={detail.id} />
          <CollapsibleCard
            title={
              isResetDraft ? t("draft.flowTitle") : t("detail.approvalFlow")
            }
          >
            {isResetDraft && draftSeeding ? (
              <LoadingState />
            ) : isResetDraft && user ? (
              <ApprovalFlowBuilder
                steps={draftSteps}
                onStepsChange={setDraftSteps}
                viewers={detail.viewerIds}
                onViewersChange={() => {}}
                showViewers={false}
                creatorId={user.id}
                signing={{ draft: signingDraft, onChange: setSigningDraft }}
              />
            ) : (
              <ApprovalFlowPanel flow={detail.flow} />
            )}
          </CollapsibleCard>

          {/* Request-level conversation: anyone with access can take part. */}
          <CollapsibleCard title={t("comments.title")} className="mt-5">
            <CommentThread requestId={detail.id} />
          </CollapsibleCard>
        </div>
      </div>
    </div>
  );

  function BackButton() {
    return (
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        {t("detail.back")}
      </button>
    );
  }
}

/** A Card whose body can be collapsed by clicking the header (open by default). */
function CollapsibleCard({
  title,
  defaultOpen = true,
  className,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={className}>
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <CardTitle>{title}</CardTitle>
          {open ? (
            <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {open && <CardBody>{children}</CardBody>}
    </Card>
  );
}
