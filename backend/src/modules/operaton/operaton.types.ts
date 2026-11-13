export interface OperatonHealthStatus {
  status: 'UP' | 'DOWN';
  engineVersion?: string;
  restEndpoint: string;
  databaseStatus?: 'CONNECTED' | 'DISCONNECTED';
  error?: string;
}

export interface OperatonProcessDefinitionSummary {
  id: string;
  key: string;
  category: string;
  description?: string | null;
  name: string;
  version: number;
  resource: string;
  deploymentId: string;
  suspended: boolean;
  versionTag?: string | null;
  historyTimeToLive?: number | null;
}

export interface ParsedBpmnTask {
  taskKey: string;
  name: string;
  assigneeVariable?: string;
  isMultiInstance: boolean;
  collectionVariable?: string;
  defaultRole?: string;
  allowOverride: boolean;
}

export interface ParsedBpmnOutgoing {
  targetRef: string;
  name?: string;
  conditionExpression?: string;
}

export interface ParsedBpmnGateway {
  id: string;
  name?: string;
  type: 'ExclusiveGateway' | 'ParallelGateway' | 'InclusiveGateway';
  outgoings: ParsedBpmnOutgoing[];
}

export interface RequiredVariableInfo {
  name: string;
  expectedType: 'Long' | 'Double' | 'String' | 'Boolean' | 'Date';
}

export interface ParsedBpmnStructure {
  processId: string;
  processName: string;
  category?: string;
  startEventId?: string;
  endEventIds: string[];
  tasks: ParsedBpmnTask[];
  gateways: ParsedBpmnGateway[];
  requiredVariables: RequiredVariableInfo[];
  conditionVariables?: string[];
}

export interface DeployBpmnResult {
  deploymentId: string;
  deploymentName: string;
  deploymentTime: string;
  deployedProcessDefinitions: OperatonProcessDefinitionSummary[];
}

export interface StartProcessInstanceDto {
  businessKey: string;
  variables?: Record<string, { value: any; type: string }>;
}

export interface ProcessInstanceResponse {
  id: string;
  definitionId: string;
  businessKey?: string;
  ended: boolean;
  suspended: boolean;
}

export interface OperatonTaskResponse {
  id: string;
  name: string;
  assignee?: string;
  created: string;
  due?: string | null;
  executionId: string;
  processDefinitionId: string;
  processInstanceId: string;
  taskDefinitionKey: string;
  suspended: boolean;
  taskState?: string;
}

