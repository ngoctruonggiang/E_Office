"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormRenderer } from "@/features/forms/components/FormRenderer";
import { useFormDefinition } from "@/features/forms/hooks/useFormDefinition";
import type { FormValues } from "@/features/forms/types/form";
import {
  uploadDocument,
  type RequestDocSection,
} from "@/features/documents/api/documents";
import { setSignature } from "@/features/signing/api/signature";
import {
  emptySigningDraft,
  type SigningDraft,
} from "@/features/signing/types/signature";
import { SignaturePlacementSection } from "@/features/signing/components/SignaturePlacementSection";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import {
  createRequest,
  createRequestFromProcedure,
  previewFlow,
  updateActualActors,
  submitProcedureRequest,
  getFlowStatus,
  submitDraft,
} from "../../api/requests";
import {
  initialFlowDrafts,
  toCreateSteps,
  type FlowStepDraft,
} from "../../types/create";
import type {
  FlowSimulationResult,
  RequestActualActorItem,
} from "../../types/procedure-runtime";
import type { RequestDetail } from "../../types/detail";
import { SelectProcedureStep } from "./SelectProcedureStep";
import { DocumentUpload } from "./DocumentUpload";
import { ApprovalFlowBuilder } from "./ApprovalFlowBuilder";
import { FlowPreviewAndActorStep } from "./FlowPreviewAndActorStep";
import { ReviewAndSubmitStep } from "./ReviewAndSubmitStep";

const PROCEDURE_STEPS = [
  "Chọn Thủ tục",
  "Nhập Biểu mẫu",
  "Tài liệu & Ký số",
  "Luồng duyệt & Tác nhân",
  "Xác nhận & Nộp",
] as const;

const LEGACY_STEPS = [
  "Chọn Biểu mẫu",
  "Nhập Biểu mẫu",
  "Thiết lập Luồng",
] as const;

export function CreateRequestWizard() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { notify } = useNotifications();

  const [mode, setMode] = useState<"procedure" | "legacy">("procedure");
  const [stepIdx, setStepIdx] = useState(0);

  // Procedure draft state
  const [procedureRequest, setProcedureRequest] = useState<RequestDetail | null>(null);
  const [procedureId, setProcedureId] = useState<string | null>(null);
  const [procedureName, setProcedureName] = useState<string>("");
  const [procedureCode, setProcedureCode] = useState<string>("");
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<FlowSimulationResult | null>(null);
  const [actors, setActors] = useState<RequestActualActorItem[]>([]);

  // Common Form & Upload state
  const [formId, setFormId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [mainFiles, setMainFiles] = useState<File[]>([]);
  const [secondaryFiles, setSecondaryFiles] = useState<File[]>([]);

  // Signing state
  const [signing, setSigning] = useState<SigningDraft>(emptySigningDraft);

  // Legacy flow state
  const [flowSteps, setFlowSteps] = useState<FlowStepDraft[]>(initialFlowDrafts());
  const [viewers, setViewers] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const { form, loading: formLoading } = useFormDefinition(formId ?? "");

  // Auto-init procedure if passed via query param ?procedureId=...
  useEffect(() => {
    const qProcId = searchParams.get("procedureId");
    if (qProcId && !procedureRequest) {
      setMode("procedure");
      createRequestFromProcedure({ procedureId: qProcId })
        .then((created) => {
          setProcedureRequest(created);
          setProcedureId(qProcId);
          setProcedureName(created.procedure?.name || "Quy trình thủ tục");
          setProcedureCode(created.procedure?.code || "");
          setFormId(created.formId);
          setActors(created.actualActors || []);
          setStepIdx(1);
          // Load flow status
          getFlowStatus(created.id)
            .then((status) => {
              setBpmnXml(status.bpmn20Xml || null);
            })
            .catch(() => {});
        })
        .catch((err) => {
          notify({
            title: "Không thể tạo hồ sơ từ Thủ tục này",
            message: err instanceof Error ? err.message : "",
            kind: "error",
          });
        });
    }
  }, [searchParams]);

  const uploadFiles = async (
    requestId: string,
    list: File[],
    section: RequestDocSection,
  ) => {
    const failed: string[] = [];
    for (const file of list) {
      try {
        await uploadDocument(file, { requestId, section });
      } catch {
        failed.push(file.name);
      }
    }
    return failed;
  };

  // Handle Procedure Selection in Step 0
  const handleSelectProcedure = async (proc: any) => {
    try {
      setSubmitting(true);
      const created = await createRequestFromProcedure({ procedureId: proc.id });
      setMode("procedure");
      setProcedureRequest(created);
      setProcedureId(proc.id);
      setProcedureName(proc.name);
      setProcedureCode(proc.code);
      setFormId(created.formId);
      setActors(created.actualActors || []);
      setStepIdx(1);

      // Load bpmn xml
      const status = await getFlowStatus(created.id);
      setBpmnXml(status.bpmn20Xml || null);
    } catch (err: any) {
      notify({
        title: "Lỗi khởi tạo hồ sơ thủ tục",
        message: err.message || "",
        kind: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Legacy Form Selection in Step 0
  const handleSelectLegacyForm = (id: string) => {
    setMode("legacy");
    setFormId(id);
    setProcedureRequest(null);
    setValues(null);
    setStepIdx(1);
  };

  // When form values change or step transitions, run simulation in procedure mode
  const runSimulation = async (inputValues: Record<string, any>) => {
    if (!procedureRequest) return;
    setSimulating(true);
    try {
      const res = await previewFlow(procedureRequest.id, inputValues);
      setSimulation(res);
    } catch (err: any) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  // Actor override callback in Step 3
  const handleUpdateActor = async (taskDefinitionKey: string, newUserId: string) => {
    if (!procedureRequest) return;
    try {
      await updateActualActors(procedureRequest.id, [
        { taskDefinitionKey, userId: newUserId },
      ]);
      // Update local state
      setActors((prev) =>
        prev.map((a) =>
          a.taskDefinitionKey === taskDefinitionKey
            ? { ...a, userId: newUserId, isOverridden: true }
            : a,
        ),
      );
      // Reload flow status
      const updated = await getFlowStatus(procedureRequest.id);
      if (updated.actualActors) {
        setActors(
          updated.actualActors.map((a) => ({
            taskDefinitionKey: a.taskDefinitionKey,
            taskName: a.taskName,
            userId: a.assignee.id,
            userName: a.assignee.name,
            department: a.assignee.department,
            title: a.assignee.title,
            isOverridden: a.isOverridden,
            order: a.order,
          })),
        );
      }
      notify({ title: "Đã cập nhật người duyệt thay thế", kind: "success" });
    } catch (err: any) {
      notify({
        title: "Không thể thay đổi người duyệt",
        message: err.message || "",
        kind: "error",
      });
    }
  };

  // Submit Procedure Request
  const handleSubmitProcedure = async () => {
    if (!procedureRequest) return;
    setSubmitting(true);

    try {
      // 1. Upload attached files
      const failed = [
        ...(await uploadFiles(procedureRequest.id, mainFiles, "MAIN")),
        ...(await uploadFiles(procedureRequest.id, secondaryFiles, "SECONDARY")),
      ];
      if (failed.length) {
        notify({
          title: "Tải file đính kèm thất bại",
          message: failed.join(", "),
          kind: "error",
        });
      }

      // 2. Handle PDF Signing Document if attached
      if (signing.file && signing.bytes) {
        const doc = await uploadDocument(signing.file, {
          requestId: procedureRequest.id,
        });
        await setSignature(procedureRequest.id, {
          documentId: doc.id,
          fields: signing.fields.map((f) => ({
            assigneeId: f.assigneeId,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
          })),
        });
      }

      // 3. Submit request & launch Operaton process
      await submitProcedureRequest(procedureRequest.id, values ?? {});

      notify({
        title: "Đã nộp hồ sơ yêu cầu phê duyệt thành công!",
        kind: "success",
      });
      router.push(`/requests/${procedureRequest.id}`);
    } catch (err: any) {
      notify({
        title: "Nộp hồ sơ thất bại",
        message: err.message || "",
        kind: "error",
      });
      setSubmitting(false);
    }
  };

  // Submit Legacy Form Request
  const handleSubmitLegacy = async () => {
    if (!formId) return;

    const finalStep = flowSteps[flowSteps.length - 1];
    if (!finalStep || finalStep.userIds.length === 0) {
      notify({ title: t("create.finalStepNeedsApprover"), kind: "error" });
      return;
    }

    const steps = toCreateSteps(flowSteps);
    const useSigning = Boolean(signing.file && signing.bytes);

    if (!useSigning) {
      notify({ title: t("signing.required"), kind: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const created = await createRequest({
        formId,
        values: values ? Object.entries(values).map(([fieldKey, value]) => ({ fieldKey, value })) : [],
        submit: false,
      });

      await uploadFiles(created.id, mainFiles, "MAIN");
      await uploadFiles(created.id, secondaryFiles, "SECONDARY");

      if (useSigning && signing.file) {
        const doc = await uploadDocument(signing.file, { requestId: created.id });
        await setSignature(created.id, {
          documentId: doc.id,
          fields: signing.fields.map((f) => ({
            assigneeId: f.assigneeId,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
          })),
        });
      }

      await submitDraft(created.id, {
        steps: steps.length ? steps : undefined,
        viewerIds: viewers.length ? viewers : undefined,
      });
      notify({ title: t("create.created"), kind: "success" });
      router.push(`/requests/${created.id}`);
    } catch (err: any) {
      notify({
        title: t("create.createFailed"),
        message: err.message || "",
        kind: "error",
      });
      setSubmitting(false);
    }
  };

  const stepsList = mode === "procedure" ? PROCEDURE_STEPS : LEGACY_STEPS;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        backHref="/requests/duty"
        backLabel={t("detail.back")}
        title={
          mode === "procedure"
            ? procedureName
              ? `Tạo Hồ sơ: ${procedureName}`
              : "Tạo Hồ sơ theo Quy trình Thủ tục"
            : t("create.title")
        }
      >
        <Stepper current={stepIdx} steps={stepsList} />
      </PageHeader>

      {/* STEP 0: Select Procedure or Form */}
      {stepIdx === 0 && (
        <SelectProcedureStep
          selectedProcedureId={procedureId}
          selectedFormId={formId}
          onSelectProcedure={handleSelectProcedure}
          onSelectForm={handleSelectLegacyForm}
        />
      )}

      {/* STEP 1: Fill Dynamic Form */}
      {stepIdx === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {form?.name ?? "Thông tin Khai báo"}
            </h2>
            {formLoading || !form ? (
              <LoadingState />
            ) : (
              <FormRenderer
                form={form}
                initialValues={values ?? undefined}
                submitLabel="Tiếp tục: Đính kèm tài liệu & Ký số"
                onSubmit={(_, raw) => {
                  setValues(raw);
                  if (mode === "procedure") {
                    runSimulation(raw);
                  }
                  setStepIdx(2);
                }}
              />
            )}
          </div>

          <div>
            <Button variant="outline" onClick={() => setStepIdx(0)}>
              <ArrowLeft size={15} />
              Quay lại Chọn mẫu
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Document Upload & PDF Signature Placement */}
      {stepIdx === 2 && (
        <div className="space-y-6">
          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <section className="space-y-3 p-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tài liệu Đính kèm chính (Hồ sơ, Tờ trình)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hỗ trợ tải lên các tệp PDF, DOCX, bảng tính XLSX hoặc hình ảnh minh chứng.
                </p>
              </div>
              <DocumentUpload files={mainFiles} onChange={setMainFiles} />
            </section>

            <section className="space-y-3 p-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tài liệu Phụ (Chứng từ đính kèm)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hóa đơn, báo giá, phụ lục hợp đồng.
                </p>
              </div>
              <DocumentUpload
                files={secondaryFiles}
                onChange={setSecondaryFiles}
              />
            </section>

            {/* Signature Placement section */}
            <section className="space-y-3 p-5">
              <SignaturePlacementSection
                approverIds={actors.map((a) => a.userId)}
                resolveName={(id) =>
                  actors.find((a) => a.userId === id)?.userName || id
                }
                draft={signing}
                onChange={setSigning}
              />
            </section>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStepIdx(1)}>
              <ArrowLeft size={15} />
              Quay lại Biểu mẫu
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                if (mode === "procedure" && values) {
                  runSimulation(values);
                }
                setStepIdx(3);
              }}
            >
              Tiếp tục: Xem trước Luồng & Tác nhân
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Flow Preview & Actor Override (or ApprovalFlowBuilder in Legacy) */}
      {stepIdx === 3 && (
        <div className="space-y-6">
          {mode === "procedure" ? (
            <FlowPreviewAndActorStep
              bpmnXml={bpmnXml}
              simulation={simulation}
              actors={actors}
              onUpdateActor={handleUpdateActor}
            />
          ) : (
            user && (
              <ApprovalFlowBuilder
                steps={flowSteps}
                onStepsChange={setFlowSteps}
                viewers={viewers}
                onViewersChange={setViewers}
                creatorId={user.id}
                signing={{ draft: signing, onChange: setSigning }}
              />
            )
          )}

          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
            <Button variant="outline" onClick={() => setStepIdx(2)}>
              <ArrowLeft size={15} />
              Quay lại Tài liệu
            </Button>
            {mode === "procedure" ? (
              <Button variant="accent" onClick={() => setStepIdx(4)}>
                Tiếp tục: Xác nhận & Nộp hồ sơ
                <ArrowRight size={15} />
              </Button>
            ) : (
              <Button
                variant="accent"
                loading={submitting}
                onClick={handleSubmitLegacy}
              >
                <Check size={15} />
                Hoàn tất & Gửi phê duyệt
              </Button>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: Review and Submit (Procedure mode) */}
      {stepIdx === 4 && mode === "procedure" && (
        <div className="space-y-6">
          <ReviewAndSubmitStep
            procedureName={procedureName}
            procedureCode={procedureCode}
            values={values || {}}
            files={[...mainFiles, ...secondaryFiles]}
            signingPdfName={signing.file?.name}
            simulation={simulation}
            actors={actors}
          />

          <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 py-3 backdrop-blur-sm">
            <Button variant="outline" onClick={() => setStepIdx(3)}>
              <ArrowLeft size={15} />
              Quay lại Luồng duyệt
            </Button>
            <Button
              variant="accent"
              loading={submitting}
              onClick={handleSubmitProcedure}
            >
              <Send size={15} />
              {submitting ? "Đang nộp hồ sơ..." : "Nộp yêu cầu phê duyệt"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({
  current,
  steps,
}: {
  current: number;
  steps: readonly string[];
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2 pt-1">
      {steps.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-300 dark:ring-indigo-800"
                  : done
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500",
              )}
            >
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-xs md:text-sm",
                active
                  ? "font-semibold text-slate-900 dark:text-slate-100"
                  : "text-slate-500",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 h-px w-4 md:w-8 bg-slate-200 dark:bg-slate-700" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
