'use client';

import React from 'react';
import { CheckCircle2, FileText, GitBranch } from 'lucide-react';
import type { FormSummary, FormVersionSummary, WorkflowSummary } from '../../types/procedure';

interface FormAndWorkflowTabProps {
  availableForms: FormSummary[];
  availableWorkflows: WorkflowSummary[];
  selectedFormVersionId: string | null;
  selectedWorkflowDefinitionId: string | null;
  onSelectFormVersion: (formVersionId: string, formVersion: FormVersionSummary) => void;
  onSelectWorkflow: (definitionId: string, workflow: WorkflowSummary) => void;
  isReadOnly?: boolean;
}

export function FormAndWorkflowTab({
  availableForms,
  availableWorkflows,
  selectedFormVersionId,
  selectedWorkflowDefinitionId,
  onSelectFormVersion,
  onSelectWorkflow,
  isReadOnly,
}: FormAndWorkflowTabProps) {
  // Find currently selected form & version
  let currentForm: FormSummary | null = null;
  let currentVersion: FormVersionSummary | null = null;

  for (const f of availableForms) {
    const v = f.versions?.find((ver) => ver.id === selectedFormVersionId);
    if (v) {
      currentForm = f;
      currentVersion = v;
      break;
    }
  }

  // Find currently selected workflow
  const currentWorkflow = availableWorkflows.find(
    (w) => (w.id || w.definitionId) === selectedWorkflowDefinitionId,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Left Column: Form Engine Selection ── */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              1. Biểu mẫu Nhập liệu (Form Engine)
            </h3>
            <p className="text-xs text-slate-400">
              Chọn biểu mẫu layout động đã thiết kế từ Phase 2
            </p>
          </div>
        </div>

        {/* Form Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Chọn Biểu mẫu & Phiên bản <span className="text-red-500">*</span>
          </label>
          <select
            disabled={isReadOnly}
            value={selectedFormVersionId || ''}
            onChange={(e) => {
              const vId = e.target.value;
              for (const f of availableForms) {
                const v = f.versions?.find((ver) => ver.id === vId);
                if (v) {
                  onSelectFormVersion(vId, { ...v, form: { id: f.id, name: f.name } });
                  break;
                }
              }
            }}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-800 dark:text-slate-100"
          >
            <option value="">-- Chọn Biểu mẫu áp dụng --</option>
            {availableForms.map((f) => (
              <optgroup key={f.id} label={f.name}>
                {f.versions?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {f.name} — Phiên bản {v.version} ({v.fields?.length || 0} trường)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Selected Form Preview */}
        {currentVersion ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{currentForm?.name} (Phiên bản {currentVersion.version})</span>
              <span className="text-primary">{currentVersion.fields?.length || 0} trường dữ liệu</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {currentVersion.fields?.map((fld) => (
                <div
                  key={fld.id || fld.key}
                  className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">{fld.label || fld.key}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                      {fld.key}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold">
                      {fld.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-400">
            Vui lòng chọn một biểu mẫu để xem trước danh sách trường dữ liệu
          </div>
        )}
      </div>

      {/* ── Right Column: Workflow Selection ── */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              2. Động cơ Quy trình (Operaton BPMN)
            </h3>
            <p className="text-xs text-slate-400">
              Chọn sơ đồ quy trình chuẩn BPMN 2.0 thuộc nhóm &quot;e-Office&quot;
            </p>
          </div>
        </div>

        {/* Workflow Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Chọn Quy trình Phê duyệt <span className="text-red-500">*</span>
          </label>
          <select
            disabled={isReadOnly}
            value={selectedWorkflowDefinitionId || ''}
            onChange={(e) => {
              const defId = e.target.value;
              const w = availableWorkflows.find((wf) => (wf.id || wf.definitionId) === defId);
              if (w) onSelectWorkflow(defId, w);
            }}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-800 dark:text-slate-100"
          >
            <option value="">-- Chọn Quy trình BPMN --</option>
            {availableWorkflows.map((w) => {
              const targetId = w.id || w.definitionId;
              return (
                <option key={targetId} value={targetId}>
                  {w.name || w.key || w.definitionKey} — Phiên bản {w.version} ({w.category || 'e-Office'})
                </option>
              );
            })}
          </select>
        </div>

        {/* Selected Workflow Preview */}
        {currentWorkflow ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {currentWorkflow.name || currentWorkflow.key || currentWorkflow.definitionKey} (v{currentWorkflow.version})
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-semibold">
                Operaton Engine
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Definition Key:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {currentWorkflow.key || currentWorkflow.definitionKey}
                </span>
              </div>
              {currentWorkflow.deploymentId && (
                <div className="flex justify-between">
                  <span>Deployment ID:</span>
                  <span className="font-mono text-[11px] text-slate-500">{currentWorkflow.deploymentId}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2 text-xs text-primary font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Sơ đồ BPMN đã sẵn sàng để cấu hình ánh xạ ở Tab tiếp theo.</span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-400">
            Vui lòng chọn một quy trình BPMN để xem thông số luồng
          </div>
        )}
      </div>
    </div>
  );
}
