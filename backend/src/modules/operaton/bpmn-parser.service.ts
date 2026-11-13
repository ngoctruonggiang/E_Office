import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import {
  ParsedBpmnGateway,
  ParsedBpmnOutgoing,
  ParsedBpmnStructure,
  ParsedBpmnTask,
  RequiredVariableInfo,
} from './operaton.types';

@Injectable()
export class BpmnParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  parse(xmlContent: string): ParsedBpmnStructure {
    if (!xmlContent || typeof xmlContent !== 'string' || !xmlContent.trim()) {
      throw new BadRequestException('BPMN XML cannot be empty');
    }

    let parsed: any;
    try {
      parsed = this.parser.parse(xmlContent);
    } catch (err: any) {
      throw new BadRequestException(`Malformed BPMN XML: ${err.message}`);
    }

    // Locate root definitions
    const definitionsKey = Object.keys(parsed || {}).find(
      (k) => k.toLowerCase() === 'bpmn:definitions' || k.toLowerCase() === 'definitions',
    );
    if (!definitionsKey) {
      throw new BadRequestException('BPMN XML missing definitions root element');
    }

    const definitions = parsed[definitionsKey];
    const category =
      definitions['@_targetNamespace'] ||
      definitions['@_category'] ||
      'e-Office';

    // Locate process
    const processKey = Object.keys(definitions || {}).find(
      (k) => k.toLowerCase() === 'bpmn:process' || k.toLowerCase() === 'process',
    );
    if (!processKey) {
      throw new BadRequestException('BPMN XML missing process element');
    }

    const rawProcess = definitions[processKey];
    const process = Array.isArray(rawProcess) ? rawProcess[0] : rawProcess;

    const processId = process['@_id'] || 'unnamed_process';
    const processName = process['@_name'] || processId;

    // Sequence Flows index for gateway & task outgoing mapping
    const rawSequenceFlows = this.ensureArray(
      process['bpmn:sequenceFlow'] || process['sequenceFlow'],
    );
    const flowMap = new Map<string, { id: string; name?: string; sourceRef: string; targetRef: string; conditionExpression?: string }>();

    for (const flow of rawSequenceFlows) {
      const flowId = flow['@_id'];
      if (!flowId) continue;
      const cond =
        flow['bpmn:conditionExpression']?.['#text'] ||
        flow['conditionExpression']?.['#text'] ||
        (typeof flow['bpmn:conditionExpression'] === 'string' ? flow['bpmn:conditionExpression'] : undefined) ||
        (typeof flow['conditionExpression'] === 'string' ? flow['conditionExpression'] : undefined);

      flowMap.set(flowId, {
        id: flowId,
        name: flow['@_name'],
        sourceRef: flow['@_sourceRef'],
        targetRef: flow['@_targetRef'],
        conditionExpression: cond ? this.cleanCondition(cond) : undefined,
      });
    }

    // Start event validation
    const rawStart = process['bpmn:startEvent'] || process['startEvent'];
    const startEvents = this.ensureArray(rawStart);
    if (startEvents.length === 0) {
      throw new BadRequestException('BPMN XML must have at least one startEvent');
    }
    const startEventId = startEvents[0]['@_id'];

    // End events validation
    const rawEnd = process['bpmn:endEvent'] || process['endEvent'];
    const endEvents = this.ensureArray(rawEnd);
    if (endEvents.length === 0) {
      throw new BadRequestException('BPMN XML must have at least one endEvent');
    }
    const endEventIds = endEvents.map((e) => e['@_id']);

    // Parse User Tasks
    const rawUserTasks = this.ensureArray(
      process['bpmn:userTask'] || process['userTask'],
    );
    const tasks: ParsedBpmnTask[] = [];

    for (const ut of rawUserTasks) {
      const taskKey = ut['@_id'];
      if (!taskKey) continue;
      const name = ut['@_name'] || taskKey;

      const rawAssignee = ut['@_camunda:assignee'] || ut['@_assignee'];
      const assigneeVariable = this.extractVariablePlaceholder(rawAssignee);

      const mi =
        ut['bpmn:multiInstanceLoopCharacteristics'] ||
        ut['multiInstanceLoopCharacteristics'];
      const isMultiInstance = !!mi;
      let collectionVariable: string | undefined;

      if (isMultiInstance) {
        const rawColl = mi['@_camunda:collection'] || mi['@_collection'];
        collectionVariable = this.extractVariablePlaceholder(rawColl);
      }

      // Extension properties (allowOverride, defaultRole)
      const props = this.extractProperties(ut);

      tasks.push({
        taskKey,
        name,
        assigneeVariable,
        isMultiInstance,
        collectionVariable,
        defaultRole: props.get('defaultRole'),
        allowOverride: props.get('allowOverride') === 'true',
      });
    }

    // Parse Gateways (exclusiveGateway, parallelGateway, inclusiveGateway)
    const gateways: ParsedBpmnGateway[] = [];

    this.parseGatewaysOfType(
      process,
      ['bpmn:exclusiveGateway', 'exclusiveGateway'],
      'ExclusiveGateway',
      flowMap,
      gateways,
    );
    this.parseGatewaysOfType(
      process,
      ['bpmn:parallelGateway', 'parallelGateway'],
      'ParallelGateway',
      flowMap,
      gateways,
    );
    this.parseGatewaysOfType(
      process,
      ['bpmn:inclusiveGateway', 'inclusiveGateway'],
      'InclusiveGateway',
      flowMap,
      gateways,
    );

    // Extract Required Variables (var_*) from conditions
    const requiredVariables = this.extractRequiredVariables(flowMap);

    return {
      processId,
      processName,
      category,
      startEventId,
      endEventIds,
      tasks,
      gateways,
      requiredVariables,
    };
  }

  private parseGatewaysOfType(
    process: any,
    tagVariants: string[],
    type: ParsedBpmnGateway['type'],
    flowMap: Map<string, { id: string; name?: string; sourceRef: string; targetRef: string; conditionExpression?: string }>,
    gateways: ParsedBpmnGateway[],
  ): void {
    let rawGateways: any[] = [];
    for (const tag of tagVariants) {
      if (process[tag]) {
        rawGateways = rawGateways.concat(this.ensureArray(process[tag]));
      }
    }

    for (const gw of rawGateways) {
      const gwId = gw['@_id'];
      if (!gwId) continue;

      const outgoings: ParsedBpmnOutgoing[] = [];
      for (const flow of flowMap.values()) {
        if (flow.sourceRef === gwId) {
          outgoings.push({
            targetRef: flow.targetRef,
            name: flow.name,
            conditionExpression: flow.conditionExpression,
          });
        }
      }

      gateways.push({
        id: gwId,
        name: gw['@_name'],
        type,
        outgoings,
      });
    }
  }

  private extractRequiredVariables(
    flowMap: Map<string, { id: string; name?: string; sourceRef: string; targetRef: string; conditionExpression?: string }>,
  ): RequiredVariableInfo[] {
    const varMap = new Map<string, RequiredVariableInfo>();

    for (const flow of flowMap.values()) {
      if (!flow.conditionExpression) continue;
      const regex = /var_([a-zA-Z0-9_]+)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(flow.conditionExpression)) !== null) {
        const fullVar = `var_${match[1]}`;
        if (!varMap.has(fullVar)) {
          // Infer type by operators
          const isNumeric = /[><=]=?\s*\d+/.test(flow.conditionExpression);
          const expectedType = isNumeric ? 'Long' : 'String';
          varMap.set(fullVar, { name: fullVar, expectedType });
        }
      }
    }

    return Array.from(varMap.values());
  }

  private cleanCondition(raw: string): string {
    return raw
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .trim();
  }

  private extractVariablePlaceholder(expr?: string): string | undefined {
    if (!expr) return undefined;
    const match = /\$\{([^}]+)\}/.exec(expr);
    return match ? match[1].trim() : expr.trim();
  }

  private extractProperties(element: any): Map<string, string> {
    const propMap = new Map<string, string>();
    const ext = element['bpmn:extensionElements'] || element['extensionElements'];
    if (!ext) return propMap;

    const camundaProps = ext['camunda:properties'] || ext['properties'];
    if (!camundaProps) return propMap;

    const rawProps = this.ensureArray(camundaProps['camunda:property'] || camundaProps['property']);
    for (const p of rawProps) {
      if (p && p['@_name']) {
        propMap.set(p['@_name'], p['@_value'] ?? '');
      }
    }

    return propMap;
  }

  private ensureArray<T>(value: T | T[] | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}

