"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Spinner";
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

    // The required final step must have at least one approver — it's the one
    // who signs/approves to close the request.
    const finalStep = flowSteps[flowSteps.length - 1];
    if (!finalStep || finalStep.userIds.length === 0) {
      notify({ title: t("create.finalStepNeedsApprover"), kind: "error" });
      return;
    }

    const steps = toCreateSteps(flowSteps);

    // A signing document is mandatory: it must be uploaded AND every approver
    // must have at least one signature position on it before creating.
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
      // Always create a DRAFT first: main documents are locked once the request
      // is submitted, so they must be attached in craft mode (DRAFT). After the
      // documents (and optional signing positions) are in place, submit.
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
      <h1 className="text-2xl font-semibold text-foreground">
        {t("create.title")}
      </h1>

      <Stepper current={stepIdx} />

      {/* Step 1: select form */}
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

      {/* Step 2: fill form + attachments */}
      {stepIdx === 1 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("create.mainDocuments")}</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="mb-3 text-sm text-muted-foreground">
                {t("create.mainDocumentsDesc")}
              </p>
              <DocumentUpload files={mainFiles} onChange={setMainFiles} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("create.secondaryDocuments")}</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="mb-3 text-sm text-muted-foreground">
                {t("create.secondaryDocumentsDesc")}
              </p>
              <DocumentUpload
                files={secondaryFiles}
                onChange={setSecondaryFiles}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{form?.name ?? t("create.stepFillForm")}</CardTitle>
            </CardHeader>
            <CardBody>
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
            </CardBody>
          </Card>

          <div>
            <Button variant="outline" onClick={() => setStepIdx(0)}>
              <ArrowLeft size={16} />
              {t("create.back")}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: approval flow + viewers */}
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

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStepIdx(1)}>
              <ArrowLeft size={16} />
              {t("create.back")}
            </Button>
            <Button loading={submitting} onClick={submit}>
              <Check size={16} />
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
    <ol className="flex items-center gap-2">
      {STEP_KEYS.map((key, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check size={13} /> : i + 1}
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
