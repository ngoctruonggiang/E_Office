import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeployBpmnResult,
  OperatonProcessDefinitionSummary,
  OperatonTaskResponse,
  ProcessInstanceResponse,
} from './operaton.types';

@Injectable()
export class OperatonClientService {
  private readonly logger = new Logger(OperatonClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl =
      process.env.OPERATON_REST_URL?.replace(/\/$/, '') ||
      'http://localhost:8080/engine-rest';
    this.timeoutMs = parseInt(process.env.OPERATON_TIMEOUT_MS || '10000', 10);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async getVersion(): Promise<{ version: string }> {
    return this.request<{ version: string }>('/version', { method: 'GET' });
  }

  async getDefinitions(
    category?: string,
    latestOnly = true,
  ): Promise<OperatonProcessDefinitionSummary[]> {
    const params = new URLSearchParams();
    if (category) {
      params.append('category', category);
    }
    if (latestOnly) {
      params.append('latestVersion', 'true');
    }

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<OperatonProcessDefinitionSummary[]>(
      `/process-definition${queryStr}`,
      { method: 'GET' },
    );
  }

  async getDefinitionXml(id: string): Promise<{ id: string; bpmn20Xml: string }> {
    return this.request<{ id: string; bpmn20Xml: string }>(
      `/process-definition/${encodeURIComponent(id)}/xml`,
      { method: 'GET' },
    );
  }

  async deploy(
    deploymentName: string,
    source: string,
    bpmnXml: string,
    deployChangedOnly = false,
  ): Promise<DeployBpmnResult> {
    const formData = new FormData();
    formData.append('deployment-name', deploymentName);
    formData.append('deployment-source', source);
    if (deployChangedOnly) {
      formData.append('deploy-changed-only', 'true');
    }

    const blob = new Blob([bpmnXml], { type: 'application/octet-stream' });
    formData.append('data', blob, 'process.bpmn');

    const res = await this.rawRequest('/deployment/create', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    const deployedDefs: OperatonProcessDefinitionSummary[] = [];

    if (data.deployedProcessDefinitions) {
      for (const defId of Object.keys(data.deployedProcessDefinitions)) {
        deployedDefs.push(data.deployedProcessDefinitions[defId]);
      }
    }

    return {
      deploymentId: data.id,
      deploymentName: data.name,
      deploymentTime: data.deploymentTime,
      deployedProcessDefinitions: deployedDefs,
    };
  }

  async startInstance(
    processKeyOrId: string,
    businessKey: string,
    variables?: Record<string, { value: any; type: string }>,
  ): Promise<ProcessInstanceResponse> {
    const path = processKeyOrId.includes(':')
      ? `/process-definition/${encodeURIComponent(processKeyOrId)}/start`
      : `/process-definition/key/${encodeURIComponent(processKeyOrId)}/start`;

    const body: any = { businessKey };
    if (variables && Object.keys(variables).length > 0) {
      body.variables = variables;
    }

    return this.request<ProcessInstanceResponse>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async getActiveTasks(processInstanceId: string): Promise<OperatonTaskResponse[]> {
    return this.request<OperatonTaskResponse[]>(
      `/task?processInstanceId=${encodeURIComponent(processInstanceId)}`,
      { method: 'GET' },
    );
  }

  async completeTask(
    taskId: string,
    variables?: Record<string, { value: any; type: string }>,
  ): Promise<void> {
    const body: any = {};
    if (variables && Object.keys(variables).length > 0) {
      body.variables = variables;
    }

    await this.rawRequest(`/task/${encodeURIComponent(taskId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async deleteProcessInstance(
    processInstanceId: string,
    reason?: string,
  ): Promise<void> {
    const params = new URLSearchParams();
    params.append('skipCustomListeners', 'true');
    params.append('failIfNotExists', 'false');

    await this.rawRequest(
      `/process-instance/${encodeURIComponent(processInstanceId)}?${params.toString()}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Cancelled by e-Office' }),
      },
    );
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const res = await this.rawRequest(path, options);
    return res.json() as Promise<T>;
  }

  private async rawRequest(path: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorBody: string;
        try {
          errorBody = await res.text();
        } catch {
          errorBody = res.statusText;
        }

        if (res.status === 404) {
          throw new NotFoundException(`Operaton resource not found: ${path}`);
        }

        this.logger.error(
          `Operaton REST call failed: ${options.method} ${path} -> [${res.status}] ${errorBody}`,
        );
        throw new BadGatewayException(
          `Operaton REST error [${res.status}]: ${errorBody}`,
        );
      }

      return res;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new GatewayTimeoutException(
          `Operaton request timed out after ${this.timeoutMs}ms: ${options.method} ${path}`,
        );
      }
      if (err instanceof NotFoundException || err instanceof BadGatewayException) {
        throw err;
      }
      throw new BadGatewayException(
        `Failed to connect to Operaton Engine at ${url}: ${err.message}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
