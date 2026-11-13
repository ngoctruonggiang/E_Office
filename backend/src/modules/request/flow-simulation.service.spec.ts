import { FlowSimulationService } from './flow-simulation.service';
import { VariableMappingType } from '@prisma/client';
import { ParsedBpmnStructure } from '../operaton/operaton.types';

describe('FlowSimulationService', () => {
  let service: FlowSimulationService;

  beforeEach(() => {
    service = new FlowSimulationService();
  });

  describe('extractVariables', () => {
    it('TC-RUN-U01: should extract number, boolean, and string variables correctly', () => {
      const mappings: any[] = [
        {
          operatonVarName: 'var_total_amount',
          formFieldKey: 'total_amount',
          variableType: VariableMappingType.NUMBER,
        },
        {
          operatonVarName: 'var_urgent',
          formFieldKey: 'urgent',
          variableType: VariableMappingType.BOOLEAN,
        },
        {
          operatonVarName: 'var_department',
          formFieldKey: 'department',
          variableType: VariableMappingType.STRING,
        },
      ];

      const values = {
        total_amount: 75000000,
        urgent: 'true',
        department: 'FINANCE',
      };

      const result = service.extractVariables(mappings, values);

      expect(result.var_total_amount).toBe(75000000);
      expect(result.var_urgent).toBe(true);
      expect(result.var_department).toBe('FINANCE');
    });

    it('TC-RUN-U02: should use fallback values when input value is missing or invalid', () => {
      const mappings: any[] = [
        {
          operatonVarName: 'var_amount',
          formFieldKey: 'amount',
          variableType: VariableMappingType.NUMBER,
          fallbackValue: '1000000',
        },
        {
          operatonVarName: 'var_notify',
          formFieldKey: 'notify',
          variableType: VariableMappingType.BOOLEAN,
          fallbackValue: 'true',
        },
      ];

      const result = service.extractVariables(mappings, {});

      expect(result.var_amount).toBe(1000000);
      expect(result.var_notify).toBe(true);
    });
  });

  describe('safeEval & evaluateCondition', () => {
    it('TC-RUN-U03: should evaluate numeric comparison expressions correctly', () => {
      const context = { var_total_amount: 75000000 };

      expect(service.evaluateCondition('${var_total_amount > 50000000}', context)).toBe(true);
      expect(service.evaluateCondition('${var_total_amount <= 50000000}', context)).toBe(false);
      expect(service.evaluateCondition('${var_total_amount == 75000000}', context)).toBe(true);
    });

    it('TC-RUN-U04: should evaluate compound logical expressions correctly', () => {
      const context = {
        var_total_amount: 75000000,
        var_urgent: true,
      };

      expect(
        service.evaluateCondition(
          '${var_total_amount > 50000000 && var_urgent == true}',
          context,
        ),
      ).toBe(true);

      expect(
        service.evaluateCondition(
          '${var_total_amount < 50000000 && var_urgent == true}',
          context,
        ),
      ).toBe(false);

      expect(
        service.evaluateCondition(
          '${var_total_amount < 50000000 || var_urgent == true}',
          context,
        ),
      ).toBe(true);
    });
  });

  describe('simulate', () => {
    it('TC-RUN-U05: should simulate branching path on ExclusiveGateway', () => {
      const structure: ParsedBpmnStructure = {
        processId: 'FLOW_1_PURCHASE',
        processName: 'Purchase Flow',
        startEventId: 'StartEvent_1',
        endEventIds: ['EndEvent_1'],
        tasks: [
          {
            taskKey: 'Activity_DeptHeadApprove',
            name: 'Trưởng phòng duyệt',
            isMultiInstance: false,
            allowOverride: true,
          },
          {
            taskKey: 'Activity_AccountantApprove',
            name: 'Kế toán thẩm định',
            isMultiInstance: false,
            allowOverride: true,
          },
          {
            taskKey: 'Activity_DirectorApprove',
            name: 'Ban Giám đốc phê duyệt',
            isMultiInstance: false,
            allowOverride: false,
          },
        ],
        gateways: [
          {
            id: 'Gateway_AmountCheck',
            name: 'Kiểm tra hạn mức',
            type: 'ExclusiveGateway',
            outgoings: [
              {
                targetRef: 'Activity_AccountantApprove',
                name: 'Flow_SmallAmount',
                conditionExpression: '${var_total_amount <= 50000000}',
              },
              {
                targetRef: 'Activity_DirectorApprove',
                name: 'Flow_LargeAmount',
                conditionExpression: '${var_total_amount > 50000000}',
              },
            ],
          },
        ],
        requiredVariables: [
          { name: 'var_total_amount', expectedType: 'Long' },
        ],
      };

      const variableMappings: any[] = [
        {
          operatonVarName: 'var_total_amount',
          formFieldKey: 'total_amount',
          variableType: VariableMappingType.NUMBER,
        },
      ];

      const actorMappings: any[] = [
        {
          taskDefinitionKey: 'Activity_DeptHeadApprove',
          taskName: 'Trưởng phòng duyệt',
          order: 1,
          allowOverride: true,
          defaultUser: { id: 'usr-1', displayName: 'Trưởng phòng', email: 'tp@gafood.local' },
        },
        {
          taskDefinitionKey: 'Activity_DirectorApprove',
          taskName: 'Ban Giám đốc phê duyệt',
          order: 2,
          allowOverride: false,
          defaultUser: { id: 'usr-2', displayName: 'Giám đốc', email: 'gd@gafood.local' },
        },
      ];

      // Test with amount > 50M
      const resLarge = service.simulate(structure, variableMappings, actorMappings, {
        total_amount: 80000000,
      });

      expect(resLarge.activeTaskKeys).toContain('Activity_DirectorApprove');
      expect(resLarge.bypassedTaskKeys).toContain('Activity_AccountantApprove');

      // Test with amount <= 50M
      const resSmall = service.simulate(structure, variableMappings, actorMappings, {
        total_amount: 30000000,
      });

      expect(resSmall.activeTaskKeys).toContain('Activity_AccountantApprove');
      expect(resSmall.bypassedTaskKeys).toContain('Activity_DirectorApprove');
    });
  });
});

