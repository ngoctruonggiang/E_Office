import { apiFetch } from "@/lib/api/client";
import type {
  DynamicActorRuleConfig,
  FormSummary,
  ProcedureListItem,
  ProcedureVersionDetail,
  UserDirectoryItem,
  ValidationResult,
  WorkflowSummary,
} from "../types/procedure";

export interface CreateProcedurePayload {
  code: string;
  name: string;
  description?: string;
  departmentId?: string;
  icon?: string;
  color?: string;
}

export interface UpdateProcedurePayload {
  name?: string;
  description?: string;
  departmentId?: string;
  icon?: string;
  color?: string;
}

export interface UpdateProcedureVersionPayload {
  formVersionId?: string;
  operatonDefinitionId?: string;
  actorMappings: Array<{
    taskDefinitionKey: string;
    taskName: string;
    order: number;
    assigneeType: 'DIRECT_USER' | 'DYNAMIC_RULE';
    defaultUserId?: string | null;
    ruleConfig?: DynamicActorRuleConfig | Record<string, unknown> | null;
    allowOverride: boolean;
    required: boolean;
    isMultiInstance?: boolean;
    collectionVariable?: string | null;
  }>;
  variableMappings: Array<{
    operatonVarName: string;
    formFieldKey: string;
    variableType: 'NUMBER' | 'STRING' | 'BOOLEAN';
    fallbackValue?: string | null;
  }>;
}

export interface CreateProcedureResult extends ProcedureListItem {
  draftVersion?: {
    id: string;
    version: number;
    status: string;
  };
}

/** List procedures with pagination and filtering. */
export function fetchProcedures(params?: {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  status?: string;
}): Promise<{ items: ProcedureListItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
  const q = new URLSearchParams();
  if (params?.page) q.append('page', String(params.page));
  if (params?.limit) q.append('limit', String(params.limit));
  if (params?.search) q.append('search', params.search);
  if (params?.departmentId) q.append('departmentId', params.departmentId);
  if (params?.status) q.append('status', params.status);
  return apiFetch(`/procedures?${q.toString()}`);
}

/** Get single procedure by ID. */
export function fetchProcedure(id: string): Promise<ProcedureListItem> {
  return apiFetch<ProcedureListItem>(`/procedures/${encodeURIComponent(id)}`);
}

/** Create a new procedure (with initial draft version). */
export function createProcedure(payload: CreateProcedurePayload): Promise<CreateProcedureResult> {
  return apiFetch<CreateProcedureResult>('/procedures', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Update general procedure metadata. */
export function updateProcedure(id: string, payload: UpdateProcedurePayload): Promise<ProcedureListItem> {
  return apiFetch<ProcedureListItem>(`/procedures/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Delete procedure. */
export function deleteProcedure(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/procedures/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Get version details. */
export function fetchProcedureVersion(versionId: string): Promise<ProcedureVersionDetail> {
  return apiFetch<ProcedureVersionDetail>(`/procedures/versions/${encodeURIComponent(versionId)}`);
}

/** Update draft configuration. */
export function saveProcedureVersionDraft(
  versionId: string,
  payload: UpdateProcedureVersionPayload,
): Promise<ProcedureVersionDetail> {
  return apiFetch<ProcedureVersionDetail>(`/procedures/versions/${encodeURIComponent(versionId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** Validate draft version before publishing. */
export function validateProcedureVersion(versionId: string): Promise<ValidationResult> {
  return apiFetch<ValidationResult>(`/procedures/versions/${encodeURIComponent(versionId)}/validate`, {
    method: 'POST',
  });
}

/** Publish draft version. */
export function publishProcedureVersion(versionId: string): Promise<{ success: boolean; message: string; procedureVersion: ProcedureVersionDetail }> {
  return apiFetch<{ success: boolean; message: string; procedureVersion: ProcedureVersionDetail }>(
    `/procedures/versions/${encodeURIComponent(versionId)}/publish`,
    {
      method: 'POST',
    },
  );
}

/** Create new draft version. */
export function createDraftVersion(procedureId: string): Promise<ProcedureVersionDetail> {
  return apiFetch<ProcedureVersionDetail>(`/procedures/${encodeURIComponent(procedureId)}/draft`, {
    method: 'POST',
  });
}

/** Fetch user directory with department & title for assignee autocomplete picker. */
export function fetchProcedureDirectory(params?: { search?: string; departmentId?: string }): Promise<UserDirectoryItem[]> {
  const q = new URLSearchParams();
  if (params?.search) q.append('search', params.search);
  if (params?.departmentId) q.append('departmentId', params.departmentId);
  return apiFetch<UserDirectoryItem[]>(`/procedures/helpers/directory?${q.toString()}`);
}

/** Helper: Available Forms. */
export function fetchHelperForms(): Promise<FormSummary[]> {
  return apiFetch<FormSummary[]>('/procedures/helpers/forms');
}

/** Helper: Available Workflows. */
export function fetchHelperWorkflows(): Promise<WorkflowSummary[]> {
  return apiFetch<WorkflowSummary[]>('/procedures/helpers/workflows');
}

/** Helper: Available Departments and Job Titles for Dynamic Actor rules. */
export function fetchOrgTitles(): Promise<{
  departments: Array<{ id: string; name: string }>;
  titles: string[];
}> {
  return apiFetch<{
    departments: Array<{ id: string; name: string }>;
    titles: string[];
  }>('/procedures/helpers/org-titles');
}

/** Test resolve actors for a draft procedure version. */
export function testResolveActors(
  versionId: string,
  requestorId?: string,
): Promise<{
  procedureVersionId: string;
  requestorId: string;
  resolvedActors: Array<{
    taskDefinitionKey: string;
    taskName: string;
    assigneeType: string;
    userId: string | null;
    userName?: string;
    resolutionOrigin: string;
    fallbackApplied: boolean;
    warning?: string;
  }>;
}> {
  return apiFetch(`/procedures/versions/${encodeURIComponent(versionId)}/resolve-actors`, {
    method: 'POST',
    body: JSON.stringify({ requestorId }),
  });
}
