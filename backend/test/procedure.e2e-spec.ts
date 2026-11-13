import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../src/core/prisma/prisma.service';
import {
  createForm,
  createProcedure,
  createProcedureDraftVersion,
  deployOperatonWorkflow,
  getProcedure,
  getProcedureDirectory,
  getProcedureVersion,
  listProcedures,
  publishProcedureVersion,
  updateProcedureVersion,
  validateProcedureVersion,
} from './utils/api';
import { createRandomUsers, loginUser, TestUser } from './utils/auth.helper';
import { buildFormPayload } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

describe('Procedure Module (e2e)', () => {
  let app: INestApplication;
  let adminUser: TestUser;
  let reviewerUser: TestUser;
  let regularUser: TestUser;
  let formVersionId: string;
  let operatonDefinitionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    [adminUser, reviewerUser, regularUser] = await createRandomUsers(app, 3);

    const prisma = app.get(PrismaService);

    // Update adminUser's role to ADMIN
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        role: 'ADMIN',
        department: 'Ban Giám đốc',
        title: 'Giám đốc Điều hành',
      },
    });

    // Update reviewerUser profile with department & title
    await prisma.user.update({
      where: { id: reviewerUser.id },
      data: {
        department: 'Phòng Mua hàng',
        title: 'Trưởng phòng Mua hàng',
      },
    });

    // Re-login admin to refresh JWT
    adminUser.accessToken = await loginUser(
      app,
      adminUser.email,
      adminUser.password,
    );

    // 1. Create a Form with fields to link with Procedure
    const formRes = await createForm(
      app,
      adminUser.accessToken,
      buildFormPayload('E2E Form Mua sam'),
    ).expect(201);

    formVersionId = formRes.body.versionId;

    // 2. Deploy sample FLOW 1 BPMN to Operaton Engine
    const bpmnPath = path.resolve(
      __dirname,
      '../../deploy/operaton/bpmn-templates/e-office-purchase-flow-1.bpmn',
    );
    const flowXml = fs.readFileSync(bpmnPath, 'utf-8');

    const deployRes = await deployOperatonWorkflow(app, adminUser.accessToken, {
      deploymentName: 'E2E Test Purchase Flow',
      category: 'e-Office',
      bpmnXml: flowXml,
    }).expect(201);

    operatonDefinitionId = deployRes.body.deployedProcessDefinitions[0]?.id;
    if (!operatonDefinitionId) {
      // In case already deployed, fetch from definitions list
      const prismaDefs = await app
        .get(PrismaService)
        .$queryRawUnsafe<any[]>(
          `SELECT id FROM "procedure_versions" WHERE "operatonDefinitionId" IS NOT NULL LIMIT 1`,
        );
      operatonDefinitionId =
        prismaDefs[0]?.operatonDefinitionId ||
        'Process_e_office_purchase_flow_1:1:flow-1';
    }
  });

  afterAll(async () => {
    await app.close();
  });

  let createdProcedureId: string;
  let draftVersionId: string;

  it('TC-PRC-E01: should create procedure and initialize draft v1', async () => {
    const code = `PROC_E2E_${Date.now()}`;
    const res = await createProcedure(app, adminUser.accessToken, {
      code,
      name: 'Thủ tục Đề xuất Mua sắm E2E',
      description: 'Quy trình thử nghiệm tự động',
      icon: 'shopping-cart',
      color: '#2563eb',
    }).expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.code).toBe(code);
    expect(res.body.draftVersion).toBeDefined();
    expect(res.body.draftVersion.version).toBe(1);
    expect(res.body.draftVersion.status).toBe('DRAFT');

    createdProcedureId = res.body.id;
    draftVersionId = res.body.draftVersion.id;
  });

  it('TC-PRC-E02: should reject publishing when validation fails (VAL-PRC-01..09)', async () => {
    // Attempting to publish an empty draft (no form, no workflow)
    const res = await publishProcedureVersion(
      app,
      adminUser.accessToken,
      draftVersionId,
    ).expect(422);

    expect(res.body.details || res.body.errors).toBeDefined();
    const errs = res.body.details || res.body.errors;
    expect(errs.length).toBeGreaterThan(0);

    // Verify status remains DRAFT
    const verRes = await getProcedureVersion(
      app,
      adminUser.accessToken,
      draftVersionId,
    ).expect(200);
    expect(verRes.body.status).toBe('DRAFT');
  });

  it('TC-PRC-E03: should complete mapping, validate and publish version successfully', async () => {
    // 1. Update draft configuration with formVersionId, operatonDefinitionId, actorMappings, variableMappings
    await updateProcedureVersion(app, adminUser.accessToken, draftVersionId, {
      formVersionId,
      operatonDefinitionId,
      actorMappings: [
        {
          taskDefinitionKey: 'step_review_1',
          taskName: 'Bộ phận Mua hàng thẩm định (Giá trị cao)',
          order: 1,
          assigneeType: 'DIRECT_USER',
          defaultUserId: reviewerUser.id,
          allowOverride: true,
          required: true,
        },
        {
          taskDefinitionKey: 'step_review_2',
          taskName: 'Kế toán mua hàng duyệt (Giá trị thấp)',
          order: 2,
          assigneeType: 'DIRECT_USER',
          defaultUserId: reviewerUser.id,
          allowOverride: true,
          required: true,
        },
        {
          taskDefinitionKey: 'step_department_head',
          taskName: 'Trưởng phòng phụ trách duyệt',
          order: 3,
          assigneeType: 'DIRECT_USER',
          defaultUserId: reviewerUser.id,
          allowOverride: true,
          required: true,
        },
        {
          taskDefinitionKey: 'step_final_approver',
          taskName: 'Tổng Giám đốc phê duyệt',
          order: 4,
          assigneeType: 'DIRECT_USER',
          defaultUserId: adminUser.id,
          allowOverride: false, // Locked step
          required: true,
        },
      ],
      variableMappings: [
        {
          operatonVarName: 'var_amount',
          formFieldKey: 'days',
          variableType: 'NUMBER',
          fallbackValue: '0',
        },
      ],
    }).expect(200);

    // 2. Validate version
    const valRes = await validateProcedureVersion(
      app,
      adminUser.accessToken,
      draftVersionId,
    ).expect(200);

    expect(valRes.body.isValid).toBe(true);
    expect(valRes.body.errors).toHaveLength(0);

    // 3. Publish version
    const pubRes = await publishProcedureVersion(
      app,
      adminUser.accessToken,
      draftVersionId,
    ).expect(200);

    expect(pubRes.body.success).toBe(true);
    expect(pubRes.body.procedureVersion.status).toBe('PUBLISHED');

    // 4. Verify Procedure activeVersionId is updated
    const procRes = await getProcedure(
      app,
      adminUser.accessToken,
      createdProcedureId,
    ).expect(200);

    expect(procRes.body.activeVersionId).toBe(draftVersionId);
    expect(procRes.body.activeVersion.status).toBe('PUBLISHED');
  });

  it('TC-PRC-E04: should enforce version pinning and allow creating draft v2', async () => {
    // 1. Attempting to update a published version should fail with 403 Forbidden
    await updateProcedureVersion(app, adminUser.accessToken, draftVersionId, {
      actorMappings: [],
      variableMappings: [],
    }).expect(403);

    // 2. Create new draft version (v2)
    const draftRes = await createProcedureDraftVersion(
      app,
      adminUser.accessToken,
      createdProcedureId,
    ).expect(201);

    expect(draftRes.body.version).toBe(2);
    expect(draftRes.body.status).toBe('DRAFT');
    expect(draftRes.body.formVersionId).toBe(formVersionId);

    // 3. Version 1 remains PUBLISHED and active
    const procRes = await getProcedure(
      app,
      adminUser.accessToken,
      createdProcedureId,
    ).expect(200);
    expect(procRes.body.activeVersionId).toBe(draftVersionId);
    expect(procRes.body.activeVersion.version).toBe(1);
  });

  it('TC-PRC-E05: GET /procedures/helpers/directory should return users with department & title', async () => {
    const res = await getProcedureDirectory(
      app,
      adminUser.accessToken,
      { search: reviewerUser.email },
    ).expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const userItem = res.body.find((u: any) => u.id === reviewerUser.id);
    expect(userItem).toBeDefined();
    expect(userItem.department).toBe('Phòng Mua hàng');
    expect(userItem.title).toBe('Trưởng phòng Mua hàng');
    expect(userItem.isActive).toBe(true);
  });
});
