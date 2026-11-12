"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormRenderer } from "@/features/forms/components/FormRenderer";
import { useFormDefinition } from "@/features/forms/hooks/useFormDefinition";
import { toRequestValues } from "@/features/forms/lib/values";
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
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { createRequest, submitDraft } from "../../api/requests";
import {
  initialFlowDrafts,
  toCreateSteps,
  type FlowStepDraft,
} from "../../types/create";
import { SelectFormStep } from "./SelectFormStep";
import { DocumentUpload } from "./DocumentUpload";
import { ApprovalFlowBuilder } from "./ApprovalFlowBuilder";

const STEP_KEYS = [
  "create.stepSelectForm",
  "create.stepFillForm",
  "create.stepApproval",
] as const;

export function CreateRequestWizard() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const { notify } = useNotifications();

  const [stepIdx, setStepIdx] = useState(0);
  const [formId, setFormId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [mainFiles, setMainFiles] = useState<File[]>([]);
  const [secondaryFiles, setSecondaryFiles] = useState<File[]>([]);
  const [flowSteps, setFlowSteps] = useState<FlowStepDraft[]>(
    initialFlowDrafts(),
  );
  const [viewers, setViewers] = useState<string[]>([]);
  const [signing, setSigning] = useState<SigningDraft>(emptySigningDraft);
  const [submitting, setSubmitting] = useState(false);

  const { form, loading: formLoading } = useFormDefinition(formId ?? "");

  const useSigning = Boolean(signing.file && signing.bytes);

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

  const submit = async () => {
    if (!formId) return;

    const finalStep = flowSteps[flowSteps.length - 1];
    if (!finalStep || finalStep.userIds.length === 0) {
      notify({ title: t("create.finalStepNeedsApprover"), kind: "error" });
      return;
    }

    const steps = toCreateSteps(flowSteps);

    if (!useSigning) {
      notify({ title: t("signing.required"), kind: "error" });
      return;
    }
    const approverIds = steps.flatMap((s) => s.assignees.map((a) => a.userId));
    const missing =
      approverIds.length === 0 ||
      approverIds.some((id) => !signing.fields.some((f) => f.assigneeId === id));
    if (missing) {
      notify({ title: t("signing.missingPositions"), kind: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const created = await createRequest({
        formId,
        values: toRequestValues(values ?? {}),
        submit: false,
      });

      const failed = [
        ...(await uploadFiles(created.id, mainFiles, "MAIN")),
        ...(await uploadFiles(created.id, secondaryFiles, "SECONDARY")),
      ];
      if (failed.length) {
        notify({
          title: t("create.uploadFailed"),
          message: failed.join(", "),
          kind: "error",
        });
      }

      if (useSigning) {
        const doc = await uploadDocument(signing.file!, {
          requestId: created.id,
        });
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
    } catch (err) {
      notify({
        title: t("create.createFailed"),
        message: err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        backHref="/requests/duty"
        backLabel={t("detail.back")}
        title={t("create.title")}
      >
        <Stepper current={stepIdx} />
      </PageHeader>

      {stepIdx === 0 && (
        <SelectFormStep
          selectedId={formId}
          onSelect={(id) => {
            if (id !== formId) {
              setFormId(id);
              setValues(null);
            }
            setStepIdx(1);
          }}
        />
      )}

      {/* Step 2: unified grouped form & attachments workspace */}
      {stepIdx === 1 && (
        <div className="space-y-4">
          <div className="divide-y divide-border-subtle rounded-lg border border-border bg-surface">
            <section className="space-y-3 p-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("create.mainDocuments")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("create.mainDocumentsDesc")}
                </p>
              </div>
              <DocumentUpload files={mainFiles} onChange={setMainFiles} />
            </section>

            <section className="space-y-3 p-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("create.secondaryDocuments")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("create.secondaryDocumentsDesc")}
                </p>
              </div>
              <DocumentUpload
                files={secondaryFiles}
                onChange={setSecondaryFiles}
              />
            </section>

            <section className="space-y-4 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                {form?.name ?? t("create.stepFillForm")}
              </h2>
              {formLoading || !form ? (
                <LoadingState />
              ) : (
                <FormRenderer
                  form={form}
                  initialValues={values ?? undefined}
                  submitLabel={t("create.next")}
                  onSubmit={(_, raw) => {
                    setValues(raw);
                    setStepIdx(2);
                  }}
                />
              )}
            </section>
          </div>

          <div>
            <Button variant="outline" onClick={() => setStepIdx(0)}>
              <ArrowLeft size={15} />
              {t("create.back")}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: approval flow + sticky action bar */}
      {stepIdx === 2 && user && (
        <div className="space-y-5">
          <ApprovalFlowBuilder
            steps={flowSteps}
            onStepsChange={setFlowSteps}
            viewers={viewers}
            onViewersChange={setViewers}
            creatorId={user.id}
            signing={{ draft: signing, onChange: setSigning }}
          />

          <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-border bg-surface/95 py-3 backdrop-blur-sm">
            <Button variant="outline" onClick={() => setStepIdx(1)}>
              <ArrowLeft size={15} />
              {t("create.back")}
            </Button>
            <Button variant="accent" loading={submitting} onClick={submit}>
              <Check size={15} />
              {submitting ? t("create.creating") : t("create.submit")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  const t = useT();
  return (
    <ol className="flex flex-wrap items-center gap-2 pt-1">
      {STEP_KEYS.map((key, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-highlight text-highlight-foreground ring-2 ring-primary/20"
                  : done
                    ? "bg-success text-white"
                    : "bg-surface-secondary text-muted-foreground",
              )}
            >
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {t(key)}
            </span>
            {i < STEP_KEYS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
