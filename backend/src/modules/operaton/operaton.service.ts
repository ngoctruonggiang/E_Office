import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BpmnParserService } from './bpmn-parser.service';
import { DeployWorkflowDto } from './dto/deploy-workflow.dto';
import { OperatonClientService } from './operaton-client.service';
import {
  DeployBpmnResult,
  OperatonHealthStatus,
  OperatonProcessDefinitionSummary,
  ParsedBpmnStructure,
} from './operaton.types';

@Injectable()
export class OperatonService {
  private readonly logger = new Logger(OperatonService.name);
  private readonly defaultCategory =
    process.env.OPERATON_DEFAULT_CATEGORY || 'e-Office';

  constructor(
    private readonly client: OperatonClientService,
    private readonly parser: BpmnParserService,
  ) {}

  async getHealth(): Promise<OperatonHealthStatus> {
    try {
      const ver = await this.client.getVersion();
      return {
        status: 'UP',
        engineVersion: ver.version,
        restEndpoint: this.client.getBaseUrl(),
        databaseStatus: 'CONNECTED',
      };
    } catch (err: any) {
      this.logger.warn(`Operaton health check failed: ${err.message}`);
      return {
        status: 'DOWN',
        restEndpoint: this.client.getBaseUrl(),
        databaseStatus: 'DISCONNECTED',
        error: err.message,
      };
    }
  }

  async getDefinitions(
    category?: string,
    latestOnly = true,
  ): Promise<OperatonProcessDefinitionSummary[]> {
    const targetCategory = category || this.defaultCategory;
    return this.client.getDefinitions(targetCategory, latestOnly);
  }

  async getDefinitionXml(id: string): Promise<string> {
    const res = await this.client.getDefinitionXml(id);
    return res.bpmn20Xml;
  }

  async getDefinitionStructure(id: string): Promise<ParsedBpmnStructure> {
    const xml = await this.getDefinitionXml(id);
    return this.parser.parse(xml);
  }

  async deployWorkflow(dto: DeployWorkflowDto): Promise<DeployBpmnResult> {
    // 1. Validate XML schema & extract structure before sending to Operaton
    const structure = this.parser.parse(dto.bpmnXml);
    if (!structure.tasks || structure.tasks.length === 0) {
      throw new BadRequestException(
        'BPMN workflow must contain at least one user approval step (UserTask)',
      );
    }

    const category = dto.category || this.defaultCategory;

    // 2. Deploy to Operaton Engine
    this.logger.log(
      `Deploying workflow "${dto.deploymentName}" (category: ${category}) with ${structure.tasks.length} user steps`,
    );

    return this.client.deploy(dto.deploymentName, category, dto.bpmnXml);
  }

  getClient(): OperatonClientService {
    return this.client;
  }

  getParser(): BpmnParserService {
    return this.parser;
  }
}

