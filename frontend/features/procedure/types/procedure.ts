export type ProcedureStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ActorAssigneeType = 'DIRECT_USER' | 'DYNAMIC_RULE';
export type DynamicActorRuleType = 'DIRECT_MANAGER' | 'DEPARTMENT_TITLE' | 'REQUESTOR_DEPT_TITLE';
export type DynamicActorFallbackStrategy = 'PARENT_MANAGER' | 'SPECIFIC_USER' | 'BLOCK_SUBMISSION';
export type VariableMappingType = 'NUMBER' | 'STRING' | 'BOOLEAN';

export interface DynamicActorRuleConfig {
  [key: string]: unknown;
  ruleType: DynamicActorRuleType;
  departmentId?: string;
  departmentName?: string;
  title?: string;
  fallbackStrategy?: DynamicActorFallbackStrategy;
  fallbackUserId?: string;
  fallbackUserName?: string;
}

export interface UserDirectoryItem {
  id: string;
  displayName: string | null;
  email: string;
  department: string | null;
  title: string | null;
  role: string;
  isActive: boolean;
  signatureImage: string | null;
}

export interface ProcedureActorMapping {
  id?: string;
  procedureVersionId?: string;
  taskDefinitionKey: string;
  taskName: string;
  order: number;
  assigneeType: ActorAssigneeType;
  defaultUserId?: string | null;
  defaultUser?: {
    id: string;
    displayName: string | null;
    email: string;
    department: string | null;
    title: string | null;
    role?: string;
    isActive?: boolean;
  } | null;
  ruleConfig?: DynamicActorRuleConfig | null;
  allowOverride: boolean;
  required: boolean;
  isMultiInstance?: boolean;
  collectionVariable?: string | null;
}

export interface ProcedureVariableMapping {
  id?: string;
  procedureVersionId?: string;
  operatonVarName: string;
  formFieldKey: string;
  variableType: VariableMappingType;
  fallbackValue?: string | null;
}

export interface FormFieldSummary {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface FormVersionSummary {
  id: string;
  formId: string;
  version: number;
  layoutSchema?: Record<string, unknown> | null;
  form?: { id: string; name: string };
  fields: FormFieldSummary[];
}

export interface FormSummary {
  id: string;
  name: string;
  versions: FormVersionSummary[];
}

export interface WorkflowSummary {
  id?: string;
  name?: string;
  key?: string;
  definitionId: string;
  definitionKey: string;
  deploymentId?: string;
  version: number;
  category: string;
  conditionVariables: string[];
  tasks: Array<{
    id: string;
    taskKey?: string;
    name: string;
    isMultiInstance?: boolean;
    collectionVariable?: string | null;
  }>;
}

export interface ProcedureVersionDetail {
  id: string;
  procedureId: string;
  version: number;
  status: ProcedureStatus;
  formVersionId: string | null;
  formVersion?: FormVersionSummary | null;
  operatonDefinitionId: string | null;
  operatonDefinitionKey: string | null;
  operatonDefinitionVersion: number | null;
  operatonDeploymentId: string | null;
  bpmnSnapshotXml?: string | null;
  workflow?: WorkflowSummary | null;
  actorMappings: ProcedureActorMapping[];
  variableMappings: ProcedureVariableMapping[];
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  procedure?: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    departmentId?: string | null;
    icon?: string | null;
    color?: string | null;
    activeVersionId?: string | null;
  };
}

export interface ProcedureListItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  icon?: string | null;
  color?: string | null;
  activeVersionId?: string | null;
  activeVersion?: {
    id: string;
    version: number;
    status: ProcedureStatus;
    publishedAt?: string | null;
    formVersionId?: string | null;
    formName?: string | null;
    operatonDefinitionKey?: string | null;
  } | null;
  versions: Array<{
    id: string;
    version: number;
    status: ProcedureStatus;
    publishedAt?: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationErrorItem {
  code: string;
  field: string;
  message: string;
}

export interface ValidationWarningItem {
  code: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorItem[];
  warnings: ValidationWarningItem[];
}
