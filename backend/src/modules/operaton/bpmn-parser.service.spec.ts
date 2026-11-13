import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BpmnParserService } from './bpmn-parser.service';

describe('BpmnParserService', () => {
  let service: BpmnParserService;
  let sampleFlow1Xml: string;

  beforeAll(() => {
    service = new BpmnParserService();
    const filePath = path.resolve(
      __dirname,
      '../../../../deploy/operaton/bpmn-templates/e-office-purchase-flow-1.bpmn',
    );
    sampleFlow1Xml = fs.readFileSync(filePath, 'utf-8');
  });

  it('TC-OPR-U01: should parse valid FLOW 1 BPMN XML correctly', () => {
    const result = service.parse(sampleFlow1Xml);

    expect(result.processId).toBe('eoffice_proc_purchase_flow_1');
    expect(result.processName).toContain('Yêu cầu Mua sắm (FLOW 1)');
    expect(result.category).toBe('e-Office');
    expect(result.startEventId).toBe('start_event_requestor');
    expect(result.endEventIds).toContain('end_approved');

    // Check user tasks
    expect(result.tasks).toHaveLength(4);
    const taskKeys = result.tasks.map((t) => t.taskKey);
    expect(taskKeys).toEqual([
      'step_review_1',
      'step_review_2',
      'step_department_head',
      'step_final_approver',
    ]);

    const review1 = result.tasks.find((t) => t.taskKey === 'step_review_1');
    expect(review1?.assigneeVariable).toBe('actor_step_review_1');
    expect(review1?.allowOverride).toBe(true);
    expect(review1?.defaultRole).toBe('Kế toán trưởng');

    // Check gateways
    expect(result.gateways.length).toBeGreaterThanOrEqual(1);
    const checkGw = result.gateways.find((g) => g.id === 'gateway_check_value');
    expect(checkGw).toBeDefined();
    expect(checkGw?.type).toBe('ExclusiveGateway');
    expect(checkGw?.outgoings).toHaveLength(2);

    const highFlow = checkGw?.outgoings.find((o) => o.targetRef === 'step_review_1');
    expect(highFlow?.conditionExpression).toContain('var_amount >= 50000000');

    // Check required variables
    expect(result.requiredVariables.some((v) => v.name === 'var_amount')).toBe(true);
  });

  it('TC-OPR-U02: should detect multi-instance parallel loop characteristics', () => {
    const miXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  targetNamespace="e-Office">
  <bpmn:process id="proc_mi" isExecutable="true">
    <bpmn:startEvent id="start" />
    <bpmn:userTask id="step_board" name="Hội đồng duyệt">
      <bpmn:multiInstanceLoopCharacteristics isSequential="false" camunda:collection="\${actorList_board}" camunda:elementVariable="item" />
    </bpmn:userTask>
    <bpmn:endEvent id="end" />
  </bpmn:process>
</bpmn:definitions>`;

    const result = service.parse(miXml);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskKey).toBe('step_board');
    expect(result.tasks[0].isMultiInstance).toBe(true);
    expect(result.tasks[0].collectionVariable).toBe('actorList_board');
  });

  it('TC-OPR-U03: should throw BadRequestException on invalid or missing elements', () => {
    expect(() => service.parse('')).toThrow(BadRequestException);
    expect(() => service.parse('<not-bpmn></not-bpmn>')).toThrow(BadRequestException);

    // Missing startEvent
    const noStartXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="e-Office">
  <bpmn:process id="p" isExecutable="true">
    <bpmn:endEvent id="end" />
  </bpmn:process>
</bpmn:definitions>`;
    expect(() => service.parse(noStartXml)).toThrow('at least one startEvent');

    // Missing endEvent
    const noEndXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="e-Office">
  <bpmn:process id="p" isExecutable="true">
    <bpmn:startEvent id="start" />
  </bpmn:process>
</bpmn:definitions>`;
    expect(() => service.parse(noEndXml)).toThrow('at least one endEvent');
  });
});

