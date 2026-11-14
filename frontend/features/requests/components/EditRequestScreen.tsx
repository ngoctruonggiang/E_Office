"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  Paperclip,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormRenderer } from "@/features/forms/components/FormRenderer";
import {
  useFormDefinition,
  useFormVersion,
} from "@/features/forms/hooks/useFormDefinition";
import type { FormValues, RequestValue } from "@/features/forms/types/form";
import { fromRequestValues } from "@/features/forms/lib/values";
import {
  downloadDocument,
  detachRequestDocument,
  uploadDocument,
} from "@/features/documents/api/documents";
import { formatBytes, formatDateTime, shortId } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useRequestDetail } from "../hooks/useRequestDetail";
import { useComments } from "@/features/comments/hooks/useComments";
import {
  updateRequest,
  resubmitProcedureRequest,
  submitDraft,
} from "../api/requests";
import { DocumentRow } from "./RequestDocuments";
import { DocumentUpload } from "./create/DocumentUpload";

export function EditRequestScreen({ id }: { id: string }) {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const { open } = useModal();
  const { notify } = useNotifications();
  const { resolveName } = useUserDirectory();

  const { detail, loading, error, reload } = useRequestDetail(id);
  const { comments } = useComments(id);

  const [activeTab, setActiveTab] = useState<"form" | "documents">("form");
  const [currentValues, setCurrentValues] = useState<RequestValue[]>([]);
  const [currentRaw, setCurrentRaw] = useState<FormValues | null>(null);
  const [newMainFiles, setNewMainFiles] = useState<File[]>([]);
  const [newSecondaryFiles, setNewSecondaryFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load pinned form version
  const pinned = useFormVersion(detail?.formVersionId ?? "");
  const latest = useFormDefinition(
    detail?.formVersionId ? "" : (detail?.formId ?? ""),
  );
  const { form, loading: formLoading } = detail?.formVersionId ? pinned : latest;

  // Build initial form values map
  const valueMap = useMemo(() => {
    return detail ? fromRequestValues(detail.values) : {};
  }, [detail?.values]);

  // Reviewer comment feedback
  const reviewComment = useMemo(() => {
    if (!comments.length) return null;
    const revs = comments.filter(
      (c) =>
        c.body.includes("[REQUEST_CHANGES]") ||
        (user && c.authorId !== user.id && c.body.trim().length > 0),
    );
    return revs[revs.length - 1] ?? null;
  }, [comments, user]);

  const mainDocumentIds = useMemo(() => {
    return detail
      ? detail.documents
          .filter((d) => d.section === "MAIN" && !d.signing)
          .map((d) => d.documentId)
      : [];
  }, [detail]);

  const secondaryDocumentIds = useMemo(() => {
    return detail
      ? detail.documents
          .filter((d) => d.section === "SECONDARY" && !d.signing)
          .map((d) => d.documentId)
      : [];
  }, [detail]);

  const isOwner = Boolean(user && detail && user.id === detail.createdById);
  const isEditable =
    isOwner &&
    detail &&
    (detail.status === "REQUEST_CHANGES" || detail.status === "DRAFT");

  const handleSave = async (silent = false): Promise<boolean> => {
    if (!detail) return false;
    setSaving(true);
    try {
      // 1. Save form values if provided
      if (currentValues.length > 0) {
        await updateRequest(id, currentValues);
      }
      // 2. Upload any staged main files
      for (const file of newMainFiles) {
        await uploadDocument(file, { requestId: id, section: "MAIN" });
      }
      // 3. Upload any staged secondary files
      for (const file of newSecondaryFiles) {
        await uploadDocument(file, { requestId: id, section: "SECONDARY" });
      }

      setNewMainFiles([]);
      setNewSecondaryFiles([]);
      await reload();

      if (!silent) {
        notify({
          title: "Đã lưu bản sửa đổi thành công",
          message: "Các thông tin và tệp đính kèm đã được cập nhật.",
          kind: "success",
        });
      }
      return true;
    } catch (err: any) {
      notify({
        title: "Không thể lưu thay đổi",
        message: err instanceof Error ? err.message : "",
        kind: "error",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttached = async (docId: string) => {
    try {
      await detachRequestDocument(id, docId);
      notify({ title: "Đã gỡ tệp đính kèm", kind: "success" });
      await reload();
    } catch (err: any) {
      notify({
        title: "Không thể gỡ tệp",
        message: err instanceof Error ? err.message : "",
        kind: "error",
      });
    }
  };

  const handleResubmit = () => {
    if (!detail) return;
    open(
      <ConfirmDialog
        title="Xác nhận nộp lại hồ sơ"
        description="Bạn xác nhận đã hoàn tất chỉnh sửa biểu mẫu và tài liệu? Hồ sơ sẽ được chuyển lại cho người duyệt để tiếp tục quy trình."
        confirmLabel="Nộp lại hồ sơ"
        onConfirm={async () => {
          setSubmitting(true);
          try {
            const saved = await handleSave(true);
            if (!saved) return;

            if (detail.status === "REQUEST_CHANGES") {
              await resubmitProcedureRequest(id, {
                comment: "Đã hoàn tất chỉnh sửa và nộp lại hồ sơ",
              });
            } else if (detail.procedureVersionId) {
              await resubmitProcedureRequest(id, {
                comment: "Đã nộp hồ sơ yêu cầu phê duyệt",
              });
            } else {
              await submitDraft(id, {
                steps: [],
                viewerIds: detail.viewerIds,
              });
            }

            notify({
              title: "Đã nộp lại hồ sơ thành công",
              message: "Hồ sơ đã được chuyển lại vào luồng phê duyệt.",
              kind: "success",
            });
            router.push(`/requests/${id}`);
          } catch (err: any) {
            notify({
              title: "Không thể nộp lại hồ sơ",
              message: err instanceof Error ? err.message : "",
              kind: "error",
            });
          } finally {
            setSubmitting(false);
          }
        }}
      />,
    );
  };

  if (loading) return <LoadingState />;

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          title={t("detail.empty")}
          description={error?.message || "Không tìm thấy hồ sơ yêu cầu"}
          action={
            <Button variant="outline" onClick={() => router.push("/requests/mine")}>
              Quay lại danh sách
            </Button>
          }
        />
      </div>
    );
  }

  if (!isEditable) {
    return (
      <div className="mx-auto max-w-4xl p-6 space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-base font-semibold">
            Hồ sơ không ở trạng thái cho phép chỉnh sửa
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Hồ sơ này đang ở trạng thái{" "}
            <strong>
              {t(`requestStatus.${detail.status}`) || detail.status}
            </strong>
            . Bạn chỉ có thể chỉnh sửa khi hồ sơ ở trạng thái Bản nháp hoặc Yêu cầu chỉnh sửa.
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.push(`/requests/${id}`)}>
              Quay lại xem chi tiết hồ sơ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => router.push(`/requests/${id}`)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} /> Quay lại chi tiết hồ sơ
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground">
              Chỉnh sửa hồ sơ: {detail.formName}
            </h1>
            <StatusBadge status={detail.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            #{shortId(detail.id)} · Phiên bản {detail.version} · Tạo bởi{" "}
            {resolveName(detail.createdById)} ·{" "}
            {formatDateTime(detail.createdAt, locale)}
          </p>
        </div>

        {/* Top actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/requests/${id}`)}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={saving}
            onClick={() => void handleSave(false)}
          >
            <Save size={15} /> Lưu thay đổi
          </Button>
          <Button
            type="button"
            variant="accent"
            loading={submitting}
            onClick={handleResubmit}
          >
            <RefreshCw size={15} /> Nộp lại hồ sơ
          </Button>
        </div>
      </div>

      {/* Reviewer feedback banner if changes were requested */}
      {detail.status === "REQUEST_CHANGES" && reviewComment && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={18} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Ý kiến yêu cầu chỉnh sửa từ người duyệt:
                </span>
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {reviewComment.author.displayName || reviewComment.author.email}
                </span>
                <span className="text-[11px] text-amber-700/70 dark:text-amber-400/70">
                  · {formatDateTime(reviewComment.createdAt, locale)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-amber-950 dark:text-amber-100">
                {reviewComment.body
                  .replace("[REQUEST_CHANGES]", "")
                  .replace("[SUBMIT]", "")
                  .trim()}
              </p>

              {/* Reviewer attached files if any */}
              {reviewComment.attachments && reviewComment.attachments.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200 dark:border-amber-900/50">
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Tệp đính kèm hướng dẫn:
                  </span>
                  {reviewComment.attachments.map((att) => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => void downloadDocument(att.documentId, att.name)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 shadow-sm transition hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"
                    >
                      <Paperclip size={12} className="text-amber-700" />
                      <span>{att.name}</span>
                      <Download size={11} className="text-amber-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs / Step Navigation */}
      <div className="flex items-center border-b border-border bg-surface px-1">
        <button
          type="button"
          onClick={() => setActiveTab("form")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors",
            activeTab === "form"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Pencil size={15} />
          1. Nhập Biểu mẫu
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors",
            activeTab === "documents"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Paperclip size={15} />
          2. Tài liệu đính kèm
          {(mainDocumentIds.length > 0 ||
            secondaryDocumentIds.length > 0 ||
            newMainFiles.length > 0 ||
            newSecondaryFiles.length > 0) && (
            <span className="ml-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {mainDocumentIds.length +
                secondaryDocumentIds.length +
                newMainFiles.length +
                newSecondaryFiles.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: FORM EDITING */}
      {activeTab === "form" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h2 className="text-base font-bold text-foreground">
                {form?.name ?? detail.formName}
              </h2>
              {form?.version && (
                <Badge tone="neutral">Biểu mẫu v{form.version}</Badge>
              )}
            </div>

            {formLoading || !form ? (
              <LoadingState />
            ) : (
              <FormRenderer
                form={form}
                initialValues={currentRaw ?? valueMap}
                mainFiles={newMainFiles}
                secondaryFiles={newSecondaryFiles}
                onAddFiles={(section, incoming) => {
                  if (section === "MAIN") {
                    setNewMainFiles((prev) => [...prev, ...incoming]);
                  } else {
                    setNewSecondaryFiles((prev) => [...prev, ...incoming]);
                  }
                }}
                onRemoveFile={(section, idx) => {
                  if (section === "MAIN") {
                    setNewMainFiles((prev) => prev.filter((_, i) => i !== idx));
                  } else {
                    setNewSecondaryFiles((prev) => prev.filter((_, i) => i !== idx));
                  }
                }}
                onChange={(raw) => {
                  setCurrentRaw(raw);
                }}
                submitLabel="Tiếp tục: Quản lý tài liệu đính kèm"
                onSubmit={(formattedVals, raw) => {
                  setCurrentValues(formattedVals);
                  setCurrentRaw(raw);
                  setActiveTab("documents");
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/requests/${id}`)}
            >
              <ArrowLeft size={15} />
              Quay lại chi tiết
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                loading={saving}
                onClick={() => void handleSave(false)}
              >
                <Save size={15} />
                Lưu tạm
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setActiveTab("documents")}
              >
                Tiếp tục: Tài liệu đính kèm
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCUMENTS MANAGEMENT */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
            {/* MAIN DOCUMENTS SECTION */}
            <section className="space-y-4 p-6">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Tài liệu Đính kèm chính (Hồ sơ, Tờ trình)
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tệp đính kèm cốt lõi của hồ sơ. Bạn có thể xóa tệp cũ hoặc tải lên tệp mới thay thế.
                </p>
              </div>

              {/* Already attached main files */}
              {mainDocumentIds.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tệp hiện có trong hồ sơ:
                  </span>
                  <div className="space-y-1.5">
                    {mainDocumentIds.map((docId) => (
                      <DocumentRow
                        key={docId}
                        id={docId}
                        canRemove={true}
                        onRemove={() => void handleRemoveAttached(docId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Staged new main files */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tải lên tệp chính mới:
                </span>
                <DocumentUpload
                  files={newMainFiles}
                  onChange={setNewMainFiles}
                />
              </div>
            </section>

            {/* SECONDARY DOCUMENTS SECTION */}
            <section className="space-y-4 p-6">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Tài liệu bổ sung (Minh chứng, Phụ lục kèm theo)
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Các tệp hỗ trợ tham khảo trong quá trình thẩm định.
                </p>
              </div>

              {/* Already attached secondary files */}
              {secondaryDocumentIds.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tệp bổ sung hiện có:
                  </span>
                  <div className="space-y-1.5">
                    {secondaryDocumentIds.map((docId) => (
                      <DocumentRow
                        key={docId}
                        id={docId}
                        canRemove={true}
                        onRemove={() => void handleRemoveAttached(docId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Staged new secondary files */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tải lên tệp bổ sung mới:
                </span>
                <DocumentUpload
                  files={newSecondaryFiles}
                  onChange={setNewSecondaryFiles}
                />
              </div>
            </section>
          </div>

          {/* Bottom navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("form")}
            >
              <ArrowLeft size={15} />
              Quay lại Biểu mẫu
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                loading={saving}
                onClick={() => void handleSave(false)}
              >
                <Save size={15} />
                Lưu tạm thay đổi
              </Button>
              <Button
                type="button"
                variant="accent"
                loading={submitting}
                onClick={handleResubmit}
              >
                <RefreshCw size={15} />
                Nộp lại hồ sơ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

