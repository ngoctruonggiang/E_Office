"use client";

import {
  Plus,
  Trash2,
  Users,
  Eye,
  ArrowDown,
  GitBranch,
  Flag
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UserPicker } from "@/features/users/components/UserPicker";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { SignaturePlacementSection } from "@/features/signing/components/SignaturePlacementSection";
import type { SigningDraft } from "@/features/signing/types/signature";
import type { FlowMode } from "../../types/detail";
import type { FlowStepDraft } from "../../types/create";
import { cn } from "@/lib/utils/cn";

export type ApprovalFlowBuilderProps = {
  steps: FlowStepDraft[];
  onStepsChange: (steps: FlowStepDraft[]) => void;
  viewers: string[];
  onViewersChange: (viewers: string[]) => void;
  /** Creator can't be an approver or a viewer. */
  creatorId: string;
  /** Hide the viewers section (e.g. when viewers are managed elsewhere). */
  showViewers?: boolean;
  /** When provided, renders the online-signing document + position placement. */
  signing?: {
    draft: SigningDraft;
    onChange: (draft: SigningDraft) => void;
  };
};

export function ApprovalFlowBuilder({
  steps,
  onStepsChange,
  viewers,
  onViewersChange,
  creatorId,
  showViewers = true,
  signing
}: ApprovalFlowBuilderProps) {
  const t = useT();
  const { open } = useModal();
  const { resolveName } = useUserDirectory();

  const allApprovers = steps.flatMap((s) => s.userIds);

  const setStep = (i: number, patch: Partial<FlowStepDraft>) =>
    onStepsChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  // The required final step is always the last draft. New (optional) steps are
  // inserted just before it; the final step itself can't be removed.
  const addStage = () =>
    onStepsChange([
      ...steps.slice(0, -1),
      { mode: "SEQUENTIAL", userIds: [], required: false },
      ...steps.slice(-1)
    ]);

  const removeStage = (i: number) =>
    onStepsChange(steps.filter((_, idx) => idx !== i));

  const pickApprovers = (i: number) => {
    // Exclude creator, all viewers, and approvers already used in OTHER steps.
    const others = steps.flatMap((s, idx) => (idx === i ? [] : s.userIds));
    // The final step closes the request via a single approver.
    const isFinal = i === steps.length - 1;
    open(
      <UserPicker
        title={isFinal ? t("create.selectApprover") : t("create.selectApprovers")}
        initialSelected={steps[i].userIds}
        excludeIds={[creatorId, ...viewers, ...others]}
        single={isFinal}
        onConfirm={(ids) => setStep(i, { userIds: ids })}
      />
    );
  };

  const pickViewers = () => {
    open(
      <UserPicker
        title={t("create.selectViewers")}
        initialSelected={viewers}
        excludeIds={[creatorId, ...allApprovers]}
        onConfirm={onViewersChange}
      />
    );
  };

  const ModeToggle = ({ i, mode }: { i: number; mode: FlowMode }) => (
    <div className="flex overflow-hidden rounded-md border border-border">
      {(["SEQUENTIAL", "PARALLEL"] as FlowMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setStep(i, { mode: m })}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors",
            mode === m
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          {m === "SEQUENTIAL" ? (
            <ArrowDown size={12} />
          ) : (
            <GitBranch size={12} />
          )}
          {t(`flowMode.${m}`)}
        </button>
      ))}
    </div>
  );

  const Chip = ({ id, onRemove }: { id: string; onRemove: () => void }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
      {resolveName(id)}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full text-secondary-foreground/70 hover:text-destructive"
      >
        ×
      </button>
    </span>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t("create.approvalDesc")}
      </p>

      {/* Steps: optional ones first, then the required final step (last). */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const isFinal = i === steps.length - 1;
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border bg-card p-3",
                isFinal ? "border-primary/40 bg-accent/40" : "border-border"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {isFinal
                      ? t("create.finalStep")
                      : `${t("create.stage")} ${i + 1}`}
                  </span>
                  {isFinal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Flag size={11} />
                      {t("create.finalStepBadge")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* The final step has a single approver, so mode is moot. */}
                  {!isFinal && <ModeToggle i={i} mode={step.mode} />}
                  {!isFinal && (
                    <button
                      type="button"
                      onClick={() => removeStage(i)}
                      title={t("create.removeStage")}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              <Input
                value={step.name ?? ""}
                onChange={(e) => setStep(i, { name: e.target.value })}
                placeholder={t("create.stepNamePlaceholder")}
                className="py-1.5 text-xs my-4"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {step.userIds.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t("create.noApprovers")}
                  </span>
                )}
                {step.userIds.map((id) => (
                  <Chip
                    key={id}
                    id={id}
                    onRemove={() =>
                      setStep(i, {
                        userIds: step.userIds.filter((x) => x !== id)
                      })
                    }
                  />
                ))}
                {(!isFinal || step.userIds.length === 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => pickApprovers(i)}
                  >
                    <Users size={14} />
                    {isFinal
                      ? t("create.addApprover")
                      : t("create.addApprovers")}
                  </Button>
                )}
              </div>
              {isFinal && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("create.finalStepDesc")}
                </p>
              )}
            </div>
          );
        })}

        <Button type="button" variant="outline" size="sm" onClick={addStage}>
          <Plus size={15} />
          {t("create.addStage")}
        </Button>
      </div>

      {/* Online signing document + signature positions */}
      {signing && (
        <SignaturePlacementSection
          approverIds={allApprovers}
          resolveName={resolveName}
          draft={signing.draft}
          onChange={signing.onChange}
        />
      )}

      {/* Viewers */}
      {showViewers && (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Eye size={15} className="text-muted-foreground" />
          {t("create.viewers")}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {viewers.length === 0 && (
            <span className="text-xs text-muted-foreground">
              {t("create.noViewers")}
            </span>
          )}
          {viewers.map((id) => (
            <Chip
              key={id}
              id={id}
              onRemove={() => onViewersChange(viewers.filter((x) => x !== id))}
            />
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={pickViewers}>
            <Plus size={14} />
            {t("create.addViewers")}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
