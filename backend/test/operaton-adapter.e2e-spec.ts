import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../src/core/prisma/prisma.service';
import {
  deployOperatonWorkflow,
  getOperatonDefinitions,
  getOperatonDefinitionStructure,
  getOperatonDefinitionXml,
  getOperatonHealth,
} from './utils/api';
import { createRandomUsers, loginUser, TestUser } from './utils/auth.helper';
import { createTestApp } from './utils/test-app';

describe('Operaton Adapter Module (e2e)', () => {
  let app: INestApplication;
  let adminUser: TestUser;
  let regularUser: TestUser;
  let sampleFlow1Xml: string;

  beforeAll(async () => {
    app = await createTestApp();
    [adminUser, regularUser] = await createRandomUsers(app, 2);

    // Update adminUser's role to ADMIN directly in database
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: 'ADMIN' },
    });

    // Re-login to get updated JWT with ADMIN role
    adminUser.accessToken = await loginUser(
      app,
      adminUser.email,
      adminUser.password,
    );

    const bpmnPath = path.resolve(
      __dirname,
      '../../deploy/operaton/bpmn-templates/e-office-purchase-flow-1.bpmn',
    );
    sampleFlow1Xml = fs.readFileSync(bpmnPath, 'utf-8');
  });

  afterAll(async () => {
    await app.close();
  });

  it('TC-OPR-D02: GET /operaton/health should report UP and engine version', async () => {
    const res = await getOperatonHealth(app, adminUser.accessToken).expect(200);

    expect(res.body.status).toBe('UP');
    expect(res.body.engineVersion).toBeDefined();
    expect(res.body.restEndpoint).toContain('/engine-rest');
    expect(res.body.databaseStatus).toBe('CONNECTED');
  });

  it('TC-OPR-I04: should enforce ADMIN role on protected operaton endpoints', async () => {
    // Regular user should get 403 Forbidden
    await getOperatonDefinitions(app, regularUser.accessToken).expect(403);

    await deployOperatonWorkflow(app, regularUser.accessToken, {
      deploymentName: 'Unauthorized Deployment',
      category: 'e-Office',
      bpmnXml: sampleFlow1Xml,
    }).expect(403);
  });

  it('TC-OPR-I01: POST /operaton/deploy should deploy FLOW 1 BPMN XML', async () => {
    const deployPayload = {
      deploymentName: 'E2E Test Flow 1 Deploy',
      category: 'e-Office',
      bpmnXml: sampleFlow1Xml,
    };

    const res = await deployOperatonWorkflow(
      app,
      adminUser.accessToken,
      deployPayload,
    ).expect(201);

    expect(res.body.deploymentId).toBeDefined();
    expect(res.body.deploymentName).toBe('E2E Test Flow 1 Deploy');
    expect(res.body.deployedProcessDefinitions.length).toBeGreaterThanOrEqual(1);

    const deployed = res.body.deployedProcessDefinitions[0];
    expect(deployed.key).toBe('eoffice_proc_purchase_flow_1');
    expect(deployed.name).toContain('Yêu cầu Mua sắm (FLOW 1)');
  });

  it('TC-OPR-I02: GET /operaton/definitions should list deployed processes for category e-Office', async () => {
    const res = await getOperatonDefinitions(app, adminUser.accessToken, 'e-Office').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const purchaseFlow = res.body.find(
      (d: any) => d.key === 'eoffice_proc_purchase_flow_1',
    );
    expect(purchaseFlow).toBeDefined();
    expect(purchaseFlow.category).toBe('e-Office');
    expect(purchaseFlow.version).toBeGreaterThanOrEqual(1);
  });

  it('TC-OPR-I03: GET /operaton/definitions/:id/structure should return parsed tasks and gateways', async () => {
    const listRes = await getOperatonDefinitions(app, adminUser.accessToken, 'e-Office').expect(200);
    const purchaseFlow = listRes.body.find(
      (d: any) => d.key === 'eoffice_proc_purchase_flow_1',
    );

    const structRes = await getOperatonDefinitionStructure(
      app,
      adminUser.accessToken,
      purchaseFlow.id,
    ).expect(200);

    expect(structRes.body.processId).toBe('eoffice_proc_purchase_flow_1');
    expect(structRes.body.tasks).toHaveLength(4);

    const taskKeys = structRes.body.tasks.map((t: any) => t.taskKey);
    expect(taskKeys).toContain('step_review_1');
    expect(taskKeys).toContain('step_review_2');
    expect(taskKeys).toContain('step_department_head');
    expect(taskKeys).toContain('step_final_approver');

    expect(structRes.body.gateways.length).toBeGreaterThanOrEqual(1);
    expect(
      structRes.body.requiredVariables.some((v: any) => v.name === 'var_amount'),
    ).toBe(true);
  });

  it('GET /operaton/definitions/:id/xml should return raw BPMN XML', async () => {
    const listRes = await getOperatonDefinitions(app, adminUser.accessToken, 'e-Office').expect(200);
    const purchaseFlow = listRes.body.find(
      (d: any) => d.key === 'eoffice_proc_purchase_flow_1',
    );

    const xmlRes = await getOperatonDefinitionXml(
      app,
      adminUser.accessToken,
      purchaseFlow.id,
    ).expect(200);

    expect(xmlRes.body.bpmn20Xml).toBeDefined();
    expect(xmlRes.body.bpmn20Xml).toContain('bpmn:process id="eoffice_proc_purchase_flow_1"');
  });
});
