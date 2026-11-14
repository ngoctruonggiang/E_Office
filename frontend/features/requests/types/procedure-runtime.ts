export interface FlowSimulationStage {
  taskDefinitionKey: string;
  taskName: string;
  order: number;
  isMultiInstance: boolean;
  collectionVariable?: string | null;
  allowOverride: boolean;
  defaultActor: {
    userId: string;
    fullName?: string;
    department?: string | null;
    title?: string | null;
  } | null;
}

export interface FlowSimulationResult {
  variables: Record<string, any>;
  activeTaskKeys: string[];
  bypassedTaskKeys: string[];
  activeFlowIds: string[];
  bypassedFlowIds: string[];
  stages: FlowSimulationStage[];
}

export interface RequestActualActorItem {
  id?: string;
  taskDefinitionKey: string;
  taskName: string;
  userId: string;
  userName?: string;
  department?: string | null;
  title?: string | null;
  isOverridden: boolean;
  order: number;
  allowOverride?: boolean;
  resolutionOrigin?: string;
}

export interface OperatonFlowStatus {
  processInstanceId?: string | null;
  status: string;
  bpmn20Xml?: string | null;
  activeTaskKeys: string[];
  completedTaskKeys: string[];
  activeTasks: Array<{
    id: string;
    operatonTaskId: string;
    taskDefinitionKey: string;
    taskName: string;
    assignee?: {
      id: string;
      name: string;
      department?: string | null;
      title?: string | null;
    };
    createdAt: string;
  }>;
  actualActors: Array<{
    taskDefinitionKey: string;
    taskName: string;
    assignee: {
      id: string;
      name: string;
      department?: string | null;
      title?: string | null;
    };
    isOverridden: boolean;
    order: number;
  }>;
  history: Array<{
    id: string;
    action: string;
    actorName: string;
    timestamp: string;
    comment?: string;
  }>;
}

export interface DutyTaskItem {
  taskId: string;
  taskDefinitionKey: string;
  taskName: string;
  createdAt: string;
  dueDate?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  requiresSignature: boolean;
  pendingSignatureCount: number;
  request: {
    id: string;
    status: string;
    procedureName: string;
    procedureCode?: string;
    requester: {
      id: string;
      name: string;
      department?: string | null;
      title?: string | null;
    };
    createdAt: string;
  };
}

export interface DutyListResponse {
  items: DutyTaskItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SignAndApproveInput {
  signatureFieldIds?: string[];
  signatureImage?: string;
  signatureName?: string;
  comment?: string;
}

export interface ResubmitProcedureInput {
  values?: Record<string, any>;
  comment?: string;
}

