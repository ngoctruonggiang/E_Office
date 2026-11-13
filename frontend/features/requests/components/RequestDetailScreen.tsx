"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
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
import { RequestDocumentPreview } from "./RequestDocumentPreview";
import { CommentThread } from "@/features/comments/components/CommentThread";
import { ApprovalFlowBuilder } from "./create/ApprovalFlowBuilder";
import { RequestActionBar } from "./RequestActionBar";
import { CloneHistory } from "./CloneHistory";

type DetailTab = "overview" | "documents" | "comments";

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
  const [rightTab, setRightTab] = useState<DetailTab>("overview");
  const [draftSteps, setDraftSteps] = useState<FlowStepDraft[]>(
    initialFlowDrafts(),
  );
  const [seededFromId, setSeededFromId] = useState<string | null>(null);
  const [signingDraft, setSigningDraft] =
    useState<SigningDraft>(emptySigningDraft);

  const isOwner = !!user && user.id === detail?.createdById;
  const isCraftMode = isOwner && detail?.status === "DRAFT";
  const isDraftClone = isCraftMode && !!detail?.clonedFromId;
  const isReserveDraft = isDraftClone && detail?.cloneMode === "reserve";
  const isResetDraft = isDraftClone && !isReserveDraft;
  const draftSeeding = Boolean(
    isResetDraft && detail?.clonedFromId && seededFromId !== detail.clonedFromId,
  );
  const isInFlight =
    detail?.status === "PENDING" || detail?.status === "REQUEST_CHANGES";
  const isAssignee =
    !!detail && !!user && isApprovalAssignee(detail.flow, user.id);
  const isViewer = !!detail && !!user && detail.viewerIds.includes(user.id);
  const isOpen = isCraftMode || isInFlight;
  const awaitingRevision = detail?.status === "REQUEST_CHANGES" && isOwner;

  const canEditForm = isCraftMode;
  const canAddMain = isOwner && isCraftMode;
  const canRemoveMain = isOwner && isCraftMode;
  const canAddSecondary = isOwner || isAssignee || isViewer;
  const canRemoveSecondary = isOwner;
  const canAddViewers =
    (isOwner && isOpen) || (isAssignee && !isOwner && isInFlight);
  const canRemoveViewers = isOwner && isOpen;
  const canConfirmDraft = isDraftClone;

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

  const approverIds = [
    ...(detail
      ? detail.flow.steps.flatMap((s) =>
          s.assignees.filter((a) => a.type !== "CLOSE").map((a) => a.id),
        )
      : []),
    ...draftSteps.flatMap((s) => s.userIds),
  ];

  useEffect(() => {
    const clonedFromId = detail?.clonedFromId;
    if (!isResetDraft || !clonedFromId) return;
    let active = true;
    getRequest(clonedFromId)
      .then((parent) => {
        if (!active) return;
        setDraftSteps(fromFlowSteps(parent.flow.steps));
      })
      .catch(() => {})
      .finally(() => active && setSeededFromId(clonedFromId));
    return () => {
      active = false;
    };
  }, [isResetDraft, detail?.clonedFromId]);

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
        /* signing is optional */
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
        <PageHeader
          title={t("detail.empty")}
          onBack={() => router.back()}
          backLabel={t("detail.back")}
        />
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
    if (isResetDraft) {
      const finalStep = draftSteps[draftSteps.length - 1];
      if (!finalStep || finalStep.userIds.length === 0) {
        notify({ title: t("create.finalStepNeedsApprover"), kind: "error" });
        return;
      }
    }

    const steps = toCreateSteps(draftSteps);

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

  const hasAnyDocument = Boolean(
    detail.signatureDocumentId ||
      mainDocumentIds.length > 0 ||
      secondaryDocumentIds.length > 0,
  );
  const totalDocs =
    (detail.signatureDocumentId ? 1 : 0) +
    mainDocumentIds.length +
    secondaryDocumentIds.length;

  const rightTabs: TabItem[] = [
    { value: "overview", label: t("detail.tabOverview") },
    {
      value: "documents",
      label: t("detail.tabDocuments"),
      badge: totalDocs > 0 ? totalDocs : undefined,
    },
    { value: "comments", label: t("detail.tabComments") },
  ];

  const openFullSignModal = () => {
    if (!detail.signatureDocumentId) return;
    open(
      <SignDocumentModal
        requestId={detail.id}
        documentId={detail.signatureDocumentId}
        currentUserId={user?.id ?? ""}
        mode="view"
        docName={detail.formName}
      />,
      { size: "4xl" },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        onBack={() => router.back()}
        backLabel={t("detail.back")}
        title={detail.formName}
        badge={<StatusBadge status={detail.status} />}
        meta={
          <span>
            <span className="font-mono">#{shortId(detail.id)}</span>
            {" · v"}
            {detail.version}
            {" · "}
            {resolveName(detail.createdById)}
            {" · "}
            {formatDateTime(detail.createdAt, locale)}
          </span>
        }
        actions={
          user ? (
            <RequestActionBar
              detail={detail}
              userId={user.id}
              onActed={reload}
              canEditForm={canEditForm}
              isEditingForm={editingForm}
              onEditForm={() => {
                setRightTab("overview");
                setEditingForm(true);
              }}
              canShare={canAddViewers}
              onShare={shareViewers}
              canConfirmDraft={canConfirmDraft}
              onConfirmDraft={confirmDraft}
            />
          ) : undefined
        }
      />

      {awaitingRevision && (
        <InlineNotice
          kind="warning"
          title={t("detail.revisionNoticeTitle")}
          description={t("detail.revisionNoticeDesc")}
        />
      )}

      {isDraftClone && (
        <InlineNotice
          kind="info"
          title={t("detail.draftCloneNoticeTitle")}
          description={t("detail.draftCloneNoticeDesc")}
        />
      )}

      {/* Split-view workspace (RAMP Section 6.1–6.3) */}
      {isResetDraft ? (
        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                {t("draft.flowTitle")}
              </h2>
              {draftSeeding ? (
                <LoadingState />
              ) : user ? (
                <ApprovalFlowBuilder
                  steps={draftSteps}
                  onStepsChange={setDraftSteps}
                  viewers={detail.viewerIds}
                  onViewersChange={() => {}}
                  showViewers={false}
                  creatorId={user.id}
                  signing={{ draft: signingDraft, onChange: setSigningDraft }}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <CloneHistory requestId={detail.id} currentId={detail.id} />
            <div className="divide-y divide-border-subtle rounded-lg border border-border bg-surface">
              <div className="p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("detail.formData")}
                </h2>
                <RequestFormData
                  requestId={detail.id}
                  formId={detail.formId}
                  formVersionId={detail.formVersionId}
                  values={detail.values}
                  editing={editingForm}
                  onEditingChange={setEditingForm}
                  onSaved={reload}
                />
              </div>
              <div className="p-4">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("detail.mainDocuments")}
                </h2>
                <p className="mb-3 text-xs text-muted-foreground">
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
              </div>
              <div className="p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("detail.viewers")}
                </h2>
                <RequestViewers
                  requestId={detail.id}
                  viewerIds={detail.viewerIds}
                  canRemove={canRemoveViewers}
                  onChanged={reload}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          {/* Left panel: Document preview (or Form Data when no documents attached) */}
          <div className="lg:col-span-7">
            {hasAnyDocument ? (
              <RequestDocumentPreview
                requestId={detail.id}
                signatureDocumentId={detail.signatureDocumentId}
                mainDocumentIds={mainDocumentIds}
                secondaryDocumentIds={secondaryDocumentIds}
                currentUserId={user?.id ?? ""}
                docName={detail.formName}
                onOpenFullModal={
                  detail.signatureDocumentId ? openFullSignModal : undefined
                }
              />
            ) : (
              <div className="rounded-lg border border-border bg-surface p-5">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("detail.formData")}
                </h2>
                <RequestFormData
                  requestId={detail.id}
                  formId={detail.formId}
                  formVersionId={detail.formVersionId}
                  values={detail.values}
                  editing={editingForm}
                  onEditingChange={setEditingForm}
                  onSaved={reload}
                />
              </div>
            )}
          </div>

          {/* Right panel: Grouped details, approval flow, documents & comments */}
          <div className="space-y-4 lg:col-span-5">
            <CloneHistory requestId={detail.id} currentId={detail.id} />

            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="px-3 pt-1">
                <Tabs
                  items={rightTabs}
                  value={rightTab}
                  onValueChange={(v) => setRightTab(v as DetailTab)}
                />
              </div>

              {rightTab === "overview" && (
                <div className="divide-y divide-border-subtle">
                  {hasAnyDocument && (
                    <div className="p-4">
                      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("detail.formData")}
                      </h2>
                      <RequestFormData
                        requestId={detail.id}
                        formId={detail.formId}
                        formVersionId={detail.formVersionId}
                        values={detail.values}
                        editing={editingForm}
                        onEditingChange={setEditingForm}
                        onSaved={reload}
                      />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("detail.approvalFlow")}
                      </h2>
                      {detail.signatureDocumentId && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={openFullSignModal}
                        >
                          <FileSignature size={13} />
                          {t("signing.open")}
                        </Button>
                      )}
                    </div>
                    <ApprovalFlowPanel flow={detail.flow} />
                  </div>
                </div>
              )}

              {rightTab === "documents" && (
                <div className="divide-y divide-border-subtle">
                  <div className="p-4">
                    <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("detail.mainDocuments")}
                    </h2>
                    <p className="mb-3 text-xs text-muted-foreground">
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
                  </div>

                  <div className="p-4">
                    <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("detail.secondaryDocuments")}
                    </h2>
                    <p className="mb-3 text-xs text-muted-foreground">
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
                  </div>

                  <div className="p-4">
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("detail.viewers")}
                    </h2>
                    <RequestViewers
                      requestId={detail.id}
                      viewerIds={detail.viewerIds}
                      canRemove={canRemoveViewers}
                      onChanged={reload}
                    />
                  </div>
                </div>
              )}

              {rightTab === "comments" && (
                <div className="p-4">
                  <CommentThread requestId={detail.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
