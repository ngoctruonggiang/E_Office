import { apiFetch } from "@/lib/api/client";
import type {
  DeployBpmnResult,
  DeployWorkflowPayload,
  OperatonHealthStatus,
  OperatonProcessDefinitionSummary,
  ParsedBpmnStructure,
} from "../types/workflow";

/** Check health and connectivity of Operaton BPMN Engine (GET /operaton/health). */
export function fetchOperatonHealth(): Promise<OperatonHealthStatus> {
  return apiFetch<OperatonHealthStatus>('/operaton/health');
}

/** List deployed workflows for a category, default "e-Office" (GET /operaton/definitions). */
export function fetchOperatonDefinitions(
  category = 'e-Office',
  latestOnly = true,
): Promise<OperatonProcessDefinitionSummary[]> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (latestOnly) params.append('latestOnly', 'true');
  return apiFetch<OperatonProcessDefinitionSummary[]>(
    `/operaton/definitions?${params.toString()}`,
  );
}

/** Fetch raw BPMN 2.0 XML for a definition (GET /operaton/definitions/:id/xml). */
export function fetchOperatonDefinitionXml(
  id: string,
): Promise<{ bpmn20Xml: string }> {
  return apiFetch<{ bpmn20Xml: string }>(
    `/operaton/definitions/${encodeURIComponent(id)}/xml`,
  );
}

/** Fetch parsed structure (tasks, gateways, variables) (GET /operaton/definitions/:id/structure). */
export function fetchOperatonDefinitionStructure(
  id: string,
): Promise<ParsedBpmnStructure> {
  return apiFetch<ParsedBpmnStructure>(
    `/operaton/definitions/${encodeURIComponent(id)}/structure`,
  );
}

/** Deploy a BPMN workflow from Web Modeler or XML (POST /operaton/deploy). */
export function deployOperatonWorkflow(
  payload: DeployWorkflowPayload,
): Promise<DeployBpmnResult> {
  return apiFetch<DeployBpmnResult>('/operaton/deploy', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

