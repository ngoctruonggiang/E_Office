"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Pencil } from "lucide-react";
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
import { addRequestViewers, getRequest, submitDraft, getFlowStatus } from "../api/requests";
import type { OperatonFlowStatus } from "../types/procedure-runtime";
import { BpmnFlowViewer } from "./BpmnFlowViewer";
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
  const [operatonFlow, setOperatonFlow] = useState<OperatonFlowStatus | null>(null);

  useEffect(() => {
    if (detail?.id && detail?.procedureVersionId) {
      getFlowStatus(detail.id)
        .then(setOperatonFlow)
        .catch((err) => console.error("Failed to load operaton flow:", err));
    }
  }, [detail?.id, detail?.procedureVersionId]);

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
    (!!detail && !!user && isApprovalAssignee(detail.flow, user.id)) ||
    (operatonFlow?.actualActors?.some((a) => a.assignee?.id === user?.id) ?? false) ||
    (operatonFlow?.activeTasks?.some((t) => t.assignee?.id === user?.id) ?? false) ||
    (detail?.signatureFields?.some((s: any) => s.assigneeId === user?.id) ?? false) ||
    (detail?.actualActors?.some((a: any) => a.userId === user?.id || a.assigneeId === user?.id) ?? false) ||
    (detail?.projectedTasks?.some((t: any) => t.assigneeId === user?.id) ?? false) ||
    user?.role === "admin";
  const isViewer = !!detail && !!user && detail.viewerIds.includes(user.id);
  const isOpen = isCraftMode || isInFlight;
  const awaitingRevision = detail?.status === "REQUEST_CHANGES" && isOwner;

  const canEditForm = isCraftMode || awaitingRevision;
  const canAddMain = isOwner && (isCraftMode || awaitingRevision);
  const canRemoveMain = isOwner && (isCraftMode || awaitingRevision);
  const canAddSecondary = isOwner || isAssignee || isViewer;
  const canRemoveSecondary = isOwner || isAssignee || user?.role === "admin";
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
          description="Người duyệt đã yêu cầu cập nhật lại nội dung. Bạn có thể chỉnh sửa biểu mẫu hoặc bổ sung tài liệu đính kèm, sau đó bấm 'Nộp lại hồ sơ'."
          action={
            <div className="flex items-center gap-2">
              {!editingForm ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRightTab("overview");
                    setEditingForm(true);
                  }}
                  className="bg-white/80 dark:bg-slate-900/80 shadow-sm"
                >
                  <Pencil size={13} className="mr-1.5" />
                  {t("detail.editForm")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingForm(false)}
                >
                  Đóng chế độ sửa
                </Button>
              )}
            </div>
          }
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("detail.formData")}
                  </h2>
                  {canEditForm && !editingForm && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingForm(true)}
                      className="h-7 text-xs"
                    >
                      <Pencil size={12} className="mr-1" />
                      {t("detail.editForm")}
                    </Button>
                  )}
                </div>
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
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("detail.formData")}
                        </h2>
                        {canEditForm && !editingForm && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingForm(true)}
                            className="h-7 text-xs"
                          >
                            <Pencil size={12} className="mr-1" />
                            {t("detail.editForm")}
                          </Button>
                        )}
                      </div>
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

                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {detail.procedureVersionId
                          ? "Tiến trình Quy trình (Operaton BPMN)"
                          : t("detail.approvalFlow")}
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

                    {detail.procedureVersionId ? (
                      <div className="space-y-4">
                        {/* Live BPMN Viewer */}
                        <BpmnFlowViewer
                          xml={operatonFlow?.bpmn20Xml}
                          activeTaskKeys={operatonFlow?.activeTaskKeys || []}
                          completedTaskKeys={
                            operatonFlow?.completedTaskKeys || []
                          }
                          mode="live"
                          className="h-[320px]"
                        />

                        {/* Approval Stage Timeline */}
                        <div className="space-y-2.5">
                          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Các bước phê duyệt thực tế
                          </h3>
                          <div className="space-y-2">
                            {(
                              operatonFlow?.actualActors ||
                              detail.actualActors ||
                              []
                            ).map((actor, idx) => {
                              const isCompleted =
                                operatonFlow?.completedTaskKeys?.includes(
                                  actor.taskDefinitionKey,
                                );
                              const isActive =
                                operatonFlow?.activeTaskKeys?.includes(
                                  actor.taskDefinitionKey,
                                );

                              return (
                                <div
                                  key={actor.taskDefinitionKey}
                                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                                    isCompleted
                                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                                      : isActive
                                      ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30 ring-1 ring-amber-400"
                                      : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40 opacity-70"
                                  }`}
                                >
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                      <span>
                                        Bước {actor.order || idx + 1}:{" "}
                                        {actor.taskName}
                                      </span>
                                      {actor.isOverridden && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                          Đã đổi người
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-slate-500 mt-0.5">
                                      {(actor as any).assignee?.name ||
                                        (actor as any).userName ||
                                        (actor as any).userId}{" "}
                                      ·{" "}
                                      {(actor as any).assignee?.title ||
                                        (actor as any).title ||
                                        "Người duyệt"}
                                    </div>
                                  </div>
                                  <div>
                                    {isCompleted ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                        Đã duyệt
                                      </span>
                                    ) : isActive ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 animate-pulse">
                                        Đang chờ
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800">
                                        Chưa đến lượt
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Operaton Action Audit History */}
                        {operatonFlow?.history &&
                          operatonFlow.history.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Nhật ký xử lý hồ sơ
                              </h3>
                              <div className="space-y-1.5 text-xs">
                                {operatonFlow.history.map((h) => (
                                  <div
                                    key={h.id}
                                    className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-0.5"
                                  >
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {h.actorName}
                                      </span>
                                      <span className="text-slate-400">
                                        {formatDateTime(h.timestamp, locale)}
                                      </span>
                                    </div>
                                    <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] font-bold px-1 rounded bg-slate-200 dark:bg-slate-700">
                                        {h.action}
                                      </span>
                                      <span>
                                        {h.comment || "Không có ghi chú"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    ) : (
                      <ApprovalFlowPanel flow={detail.flow} />
                    )}
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
