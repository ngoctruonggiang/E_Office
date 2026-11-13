'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileCheck2,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Save,
  Send,
  Variable,
} from 'lucide-react';
import {
  fetchHelperForms,
  fetchHelperWorkflows,
  fetchProcedureVersion,
  publishProcedureVersion,
  saveProcedureVersionDraft,
  updateProcedure,
  validateProcedureVersion,
} from '../../api/procedure';
import type {
  FormSummary,
  FormFieldSummary,
  ProcedureActorMapping,
  ProcedureVariableMapping,
  ProcedureVersionDetail,
  ValidationResult,
  WorkflowSummary,
} from '../../types/procedure';
import { ActorMappingTab } from './ActorMappingTab';
import { FormAndWorkflowTab } from './FormAndWorkflowTab';
import { GeneralInfoTab } from './GeneralInfoTab';
import { PublishConfirmModal } from './PublishConfirmModal';
import { ValidationDrawer } from './ValidationDrawer';
import { VariableMappingTab } from './VariableMappingTab';

interface ProcedureBuilderProps {
  versionId: string;
}

export function ProcedureBuilder({ versionId }: ProcedureBuilderProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [versionDetail, setVersionDetail] = useState<ProcedureVersionDetail | null>(null);
  const [availableForms, setAvailableForms] = useState<FormSummary[]>([]);
  const [availableWorkflows, setAvailableWorkflows] = useState<WorkflowSummary[]>([]);

  const [activeTab, setActiveTab] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Form State
  const [generalInfo, setGeneralInfo] = useState({
    code: '',
    name: '',
    description: '',
    departmentId: '',
    icon: 'file-text',
    color: '#2563eb',
  });
  const [selectedFormVersionId, setSelectedFormVersionId] = useState<string | null>(null);
  const [selectedWorkflowDefId, setSelectedWorkflowDefId] = useState<string | null>(null);
  const [actorMappings, setActorMappings] = useState<ProcedureActorMapping[]>([]);
  const [variableMappings, setVariableMappings] = useState<ProcedureVariableMapping[]>([]);

  // Load all initial data
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchProcedureVersion(versionId),
      fetchHelperForms(),
      fetchHelperWorkflows(),
    ])
      .then(([vDetail, forms, workflows]) => {
        if (!isMounted) return;
        setVersionDetail(vDetail);
        setAvailableForms(forms);
        setAvailableWorkflows(workflows);

        // Populate state
        if (vDetail.procedure) {
          setGeneralInfo({
            code: vDetail.procedure.code,
            name: vDetail.procedure.name,
            description: vDetail.procedure.description || '',
            departmentId: vDetail.procedure.departmentId || '',
            icon: vDetail.procedure.icon || 'file-text',
            color: vDetail.procedure.color || '#2563eb',
          });
        }
        setSelectedFormVersionId(vDetail.formVersionId);
        setSelectedWorkflowDefId(vDetail.operatonDefinitionId);
        setActorMappings(vDetail.actorMappings || []);
        setVariableMappings(vDetail.variableMappings || []);
      })
      .catch((err: unknown) => {
        console.error('Failed to load procedure details:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [versionId]);

  const isReadOnly = versionDetail?.status !== 'DRAFT';

  // Handle saving draft
  const handleSaveDraft = async () => {
    if (!versionDetail) return;
    setIsSaving(true);
    try {
      // 1. Update general info if procedure exists
      if (versionDetail.procedureId) {
        await updateProcedure(versionDetail.procedureId, {
          name: generalInfo.name,
          description: generalInfo.description,
          icon: generalInfo.icon,
          color: generalInfo.color,
          departmentId: generalInfo.departmentId || undefined,
        });
      }

      // 2. Update version mappings
      const updated = await saveProcedureVersionDraft(versionId, {
        formVersionId: selectedFormVersionId || undefined,
        operatonDefinitionId: selectedWorkflowDefId || undefined,
        actorMappings: actorMappings.map((am, idx) => ({
          taskDefinitionKey: am.taskDefinitionKey,
          taskName: am.taskName,
          order: idx + 1,
          assigneeType: am.assigneeType,
          defaultUserId: am.defaultUserId || null,
          ruleConfig: am.ruleConfig,
          allowOverride: am.allowOverride,
          required: am.required,
          isMultiInstance: am.isMultiInstance,
          collectionVariable: am.collectionVariable,
        })),
        variableMappings: variableMappings.map((vm) => ({
          operatonVarName: vm.operatonVarName,
          formFieldKey: vm.formFieldKey,
          variableType: vm.variableType,
          fallbackValue: vm.fallbackValue || null,
        })),
      });

      setVersionDetail(updated);
      alert('Đã lưu bản nháp thủ tục thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu';
      alert(`Lỗi khi lưu bản nháp: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle validate
  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const res = await validateProcedureVersion(versionId);
      setValidationResult(res);
      setIsValidationDrawerOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      alert(`Lỗi khi thẩm định: ${msg}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Handle publish click
  const handleOpenPublish = async () => {
    setIsValidating(true);
    try {
      const res = await validateProcedureVersion(versionId);
      setValidationResult(res);
      if (!res.isValid) {
        setIsValidationDrawerOpen(true);
      } else {
        setIsPublishModalOpen(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      alert(`Lỗi thẩm định: ${msg}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Confirm publish
  const handleConfirmPublish = async () => {
    setIsPublishing(true);
    try {
      await publishProcedureVersion(versionId);
      setIsPublishModalOpen(false);
      alert('Chúc mừng! Đã xuất bản thành công phiên bản thủ tục.');
      router.push('/procedures');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      alert(`Lỗi xuất bản: ${msg}`);
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading || !versionDetail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-500">Đang tải cấu hình Thủ tục...</p>
      </div>
    );
  }

  // Find form fields and workflow tasks from selected objects
  let currentFields: FormFieldSummary[] = [];
  for (const f of availableForms) {
    const v = f.versions?.find((ver) => ver.id === selectedFormVersionId);
    if (v?.fields) {
      currentFields = v.fields;
      break;
    }
  }

  const conditionVars: string[] = versionDetail.workflow?.conditionVariables || [];
  const workflowTasks = versionDetail.workflow?.tasks || [];

  const tabs = [
    { label: '1. Thông tin chung', icon: FileText },
    { label: '2. Form & Workflow', icon: GitBranch },
    { label: '3. Ánh xạ Tham số', icon: Variable, count: conditionVars.length },
    { label: '4. Người duyệt (Actors)', icon: Layers, count: workflowTasks.length },
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Bar / Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/procedures" className="hover:text-primary transition flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Danh mục Thủ tục</span>
            </Link>
            <span>/</span>
            <span className="font-mono">{versionDetail.procedure?.code}</span>
            <span>/</span>
            <span>Phiên bản {versionDetail.version}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span
                style={{ color: generalInfo.color }}
                className="w-3 h-3 rounded-full inline-block bg-current"
              />
              {generalInfo.name || 'Thủ tục không tên'}
            </h1>

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                versionDetail.status === 'PUBLISHED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : versionDetail.status === 'ARCHIVED'
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {versionDetail.status}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Lưu nháp</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            className="px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
            <span>Thẩm định</span>
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleOpenPublish}
              disabled={isPublishing}
              className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Xuất bản (Publish)</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === idx;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs whitespace-nowrap transition ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content Panels ── */}
      <div className="pt-2">
        {activeTab === 0 && (
          <GeneralInfoTab
            code={generalInfo.code}
            name={generalInfo.name}
            description={generalInfo.description}
            departmentId={generalInfo.departmentId}
            icon={generalInfo.icon}
            color={generalInfo.color}
            onChange={(fields) => setGeneralInfo((prev) => ({ ...prev, ...fields }))}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 1 && (
          <FormAndWorkflowTab
            availableForms={availableForms}
            availableWorkflows={availableWorkflows}
            selectedFormVersionId={selectedFormVersionId}
            selectedWorkflowDefinitionId={selectedWorkflowDefId}
            onSelectFormVersion={(fvId) => {
              setSelectedFormVersionId(fvId);
            }}
            onSelectWorkflow={(wId) => {
              setSelectedWorkflowDefId(wId);
            }}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 2 && (
          <VariableMappingTab
            conditionVariables={conditionVars}
            formFields={currentFields}
            mappings={variableMappings}
            onChange={setVariableMappings}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 3 && (
          <ActorMappingTab
            workflowTasks={workflowTasks}
            mappings={actorMappings}
            onChange={setActorMappings}
            isReadOnly={isReadOnly}
          />
        )}
      </div>

      {/* ── Slide-over Drawers & Modals ── */}
      <ValidationDrawer
        isOpen={isValidationDrawerOpen}
        onClose={() => setIsValidationDrawerOpen(false)}
        result={validationResult}
        onSelectTab={(tabIdx) => {
          setActiveTab(tabIdx);
          setIsValidationDrawerOpen(false);
        }}
      />

      <PublishConfirmModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onConfirm={handleConfirmPublish}
        isPublishing={isPublishing}
        versionDetail={{
          ...versionDetail,
          actorMappings,
          variableMappings,
        }}
      />
    </div>
  );
}
