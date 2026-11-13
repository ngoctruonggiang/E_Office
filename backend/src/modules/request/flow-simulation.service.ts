import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedBpmnGateway,
  ParsedBpmnStructure,
} from '../operaton/operaton.types';
import {
  ProcedureActorMapping,
  ProcedureVariableMapping,
  VariableMappingType,
} from '@prisma/client';

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

@Injectable()
export class FlowSimulationService {
  private readonly logger = new Logger(FlowSimulationService.name);

  /**
   * Extract process variables from form payload according to ProcedureVariableMapping.
   */
  extractVariables(
    mappings: ProcedureVariableMapping[],
    values: Record<string, any>,
  ): Record<string, any> {
    const vars: Record<string, any> = {};

    for (const m of mappings) {
      const rawVal = values ? values[m.formFieldKey] : undefined;

      switch (m.variableType) {
        case VariableMappingType.NUMBER: {
          let num = 0;
          if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
            num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
            if (isNaN(num)) {
              num = m.fallbackValue ? parseFloat(m.fallbackValue) : 0;
            }
          } else if (m.fallbackValue) {
            num = parseFloat(m.fallbackValue) || 0;
          }
          vars[m.operatonVarName] = num;
          break;
        }

        case VariableMappingType.BOOLEAN: {
          let boolVal = false;
          if (rawVal !== undefined && rawVal !== null) {
            if (typeof rawVal === 'boolean') {
              boolVal = rawVal;
            } else {
              const str = String(rawVal).toLowerCase().trim();
              boolVal = str === 'true' || str === '1' || str === 'yes';
            }
          } else if (m.fallbackValue) {
            boolVal = m.fallbackValue.toLowerCase() === 'true';
          }
          vars[m.operatonVarName] = boolVal;
          break;
        }

        case VariableMappingType.STRING:
        default: {
          let strVal = '';
          if (rawVal !== undefined && rawVal !== null) {
            strVal = String(rawVal).trim();
          } else if (m.fallbackValue) {
            strVal = m.fallbackValue;
          }
          vars[m.operatonVarName] = strVal;
          break;
        }
      }
    }

    return vars;
  }

  /**
   * Safely evaluate a single BPMN UEL condition expression like `${var_total_amount > 50000000}`.
   */
  evaluateCondition(
    conditionExpression: string | undefined,
    context: Record<string, any>,
  ): boolean {
    if (!conditionExpression || !conditionExpression.trim()) {
      return true; // Unconditional flow
    }

    let expr = conditionExpression.trim();
    // Strip ${ ... } wrapper
    if (expr.startsWith('${') && expr.endsWith('}')) {
      expr = expr.substring(2, expr.length - 1).trim();
    }

    try {
      return this.safeEval(expr, context);
    } catch (err: any) {
      this.logger.warn(`Failed to evaluate condition expression "${expr}": ${err.message}`);
      return false;
    }
  }

  /**
   * Safe expression evaluation without using unrestricted eval.
   * Supports: >, <, >=, <=, ==, !=, &&, ||, ! with variables and numbers/strings/booleans.
   */
  safeEval(expression: string, context: Record<string, any>): boolean {
    // Handle logical AND / OR at top level
    if (expression.includes('&&')) {
      const parts = expression.split('&&');
      return parts.every((p) => this.safeEval(p.trim(), context));
    }
    if (expression.includes('||')) {
      const parts = expression.split('||');
      return parts.some((p) => this.safeEval(p.trim(), context));
    }

    // Supported comparison operators in precedence order
    const ops = ['>=', '<=', '==', '!=', '>', '<'];
    for (const op of ops) {
      const idx = expression.indexOf(op);
      if (idx !== -1) {
        const leftExpr = expression.substring(0, idx).trim();
        const rightExpr = expression.substring(idx + op.length).trim();

        const leftVal = this.resolveValue(leftExpr, context);
        const rightVal = this.resolveValue(rightExpr, context);

        switch (op) {
          case '>=':
            return Number(leftVal) >= Number(rightVal);
          case '<=':
            return Number(leftVal) <= Number(rightVal);
          case '>':
            return Number(leftVal) > Number(rightVal);
          case '<':
            return Number(leftVal) < Number(rightVal);
          case '==':
            return String(leftVal) === String(rightVal);
          case '!=':
            return String(leftVal) !== String(rightVal);
        }
      }
    }

    // Boolean variable or literal
    const val = this.resolveValue(expression.trim(), context);
    return Boolean(val);
  }

  private resolveValue(token: string, context: Record<string, any>): any {
    const trimmed = token.trim();

    // Check literal null/undefined
    if (trimmed === 'null' || trimmed === 'undefined') return null;
    // Check literal boolean
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Check literal string with quotes
    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      return trimmed.substring(1, trimmed.length - 1);
    }

    // Check literal number
    const num = Number(trimmed);
    if (!isNaN(num)) {
      return num;
    }

    // Lookup in context
    if (Object.prototype.hasOwnProperty.call(context, trimmed)) {
      return context[trimmed];
    }

    return null;
  }

  /**
   * Simulate execution path on BPMN structure and produce active/bypassed sets.
   */
  simulate(
    bpmnStructure: ParsedBpmnStructure,
    variableMappings: ProcedureVariableMapping[],
    actorMappings: (ProcedureActorMapping & { defaultUser?: any })[],
    values: Record<string, any>,
  ): FlowSimulationResult {
    const variables = this.extractVariables(variableMappings, values);
    const activeTaskKeys = new Set<string>();
    const bypassedTaskKeys = new Set<string>();
    const activeFlowIds = new Set<string>();
    const bypassedFlowIds = new Set<string>();

    const allTasksMap = new Map(bpmnStructure.tasks.map((t) => [t.taskKey, t]));
    const gatewaysMap = new Map(bpmnStructure.gateways.map((g) => [g.id, g]));

    // Start traversal from startEvent
    const startEventId = bpmnStructure.startEventId || 'StartEvent_1';
    const visitedNodes = new Set<string>();
    const queue: string[] = [startEventId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visitedNodes.has(currentId)) continue;
      visitedNodes.add(currentId);

      // Check if current is a Gateway
      const gateway = gatewaysMap.get(currentId);
      if (gateway) {
        if (gateway.type === 'ExclusiveGateway') {
          // Evaluate condition on outgoings
          let selectedOutgoing: any = null;
          for (const outgoing of gateway.outgoings) {
            const isMatch = this.evaluateCondition(outgoing.conditionExpression, variables);
            if (isMatch && !selectedOutgoing) {
              selectedOutgoing = outgoing;
              activeFlowIds.add(outgoing.name || outgoing.targetRef);
            } else {
              bypassedFlowIds.add(outgoing.name || outgoing.targetRef);
            }
          }

          if (selectedOutgoing) {
            queue.push(selectedOutgoing.targetRef);
          }
          continue;
        } else {
          // Parallel or other gateways: all branches active
          for (const outgoing of gateway.outgoings) {
            activeFlowIds.add(outgoing.name || outgoing.targetRef);
            queue.push(outgoing.targetRef);
          }
          continue;
        }
      }

      // Check if current is a UserTask
      const task = allTasksMap.get(currentId);
      if (task) {
        activeTaskKeys.add(task.taskKey);
      }
    }

    // If traversal did not reach all tasks due to limited sequenceFlow index in minimal BPMN,
    // ensure tasks on gateway outgoing branches are categorized properly:
    for (const gw of bpmnStructure.gateways) {
      for (const outgoing of gw.outgoings) {
        const isMatch = this.evaluateCondition(outgoing.conditionExpression, variables);
        const targetTask = allTasksMap.get(outgoing.targetRef);
        if (targetTask) {
          if (isMatch) {
            activeTaskKeys.add(targetTask.taskKey);
            bypassedTaskKeys.delete(targetTask.taskKey);
          } else {
            if (!activeTaskKeys.has(targetTask.taskKey)) {
              bypassedTaskKeys.add(targetTask.taskKey);
            }
          }
        }
      }
    }

    // Default: Any task not in bypassedTaskKeys and part of tasks is active
    for (const t of bpmnStructure.tasks) {
      if (!bypassedTaskKeys.has(t.taskKey)) {
        activeTaskKeys.add(t.taskKey);
      }
    }

    // Build stages from actor mappings for active tasks
    const actorMap = new Map(actorMappings.map((a) => [a.taskDefinitionKey, a]));
    const stages: FlowSimulationStage[] = [];

    const sortedTasks = [...bpmnStructure.tasks].sort((a, b) => {
      const orderA = actorMap.get(a.taskKey)?.order ?? 999;
      const orderB = actorMap.get(b.taskKey)?.order ?? 999;
      return orderA - orderB;
    });

    for (const task of sortedTasks) {
      const mapping = actorMap.get(task.taskKey);
      stages.push({
        taskDefinitionKey: task.taskKey,
        taskName: task.name,
        order: mapping?.order ?? stages.length + 1,
        isMultiInstance: task.isMultiInstance || mapping?.isMultiInstance || false,
        collectionVariable: mapping?.collectionVariable || null,
        allowOverride: mapping ? mapping.allowOverride : true,
        defaultActor: mapping?.defaultUser
          ? {
              userId: mapping.defaultUser.id,
              fullName: mapping.defaultUser.displayName || mapping.defaultUser.email,
              department: mapping.defaultUser.department,
              title: mapping.defaultUser.title,
            }
          : null,
      });
    }

    return {
      variables,
      activeTaskKeys: Array.from(activeTaskKeys),
      bypassedTaskKeys: Array.from(bypassedTaskKeys),
      activeFlowIds: Array.from(activeFlowIds),
      bypassedFlowIds: Array.from(bypassedFlowIds),
      stages,
    };
  }
}

