import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../src/core/prisma/prisma.service';
import {
  approveTask,
  cloneProcedureRequest,
  createForm,
  createProcedure,
  createRequestFromProcedure,
  deployOperatonWorkflow,
  getMyDuties,
  getFlowStatus,
  previewFlow,
  publishProcedureVersion,
  setActualActors,
  signAndApproveTask,
  submitProcedureRequest,
  updateProcedureVersion,
  validateProcedureVersion,
} from './utils/api';
import { createRandomUsers, loginUser, TestUser } from './utils/auth.helper';
import { buildFormPayload } from './utils/fixtures';
import { createTestApp } from './utils/test-app';

describe('Request Runtime & Signing Module (e2e)', () => {
  let app: INestApplication;
  let adminUser: TestUser;
  let approverUser: TestUser;
  let delegateUser: TestUser;
  let requesterUser: TestUser;
  let procedureId: string;
  let procedureVersionId: string;
  let formVersionId: string;
  let operatonDefinitionId: string;
  let operatonDefinitionKey: string;

  beforeAll(async () => {
    app = await createTestApp();
    [adminUser, approverUser, delegateUser, requesterUser] =
      await createRandomUsers(app, 4);

    const prisma = app.get(PrismaService);

    // Update roles & departments
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        role: 'ADMIN',
        department: 'Ban Giám đốc',
        title: 'Giám đốc Điều hành',
      },
    });

    await prisma.user.update({
      where: { id: approverUser.id },
      data: {
        department: 'Phòng Mua hàng',
        title: 'Trưởng phòng Mua hàng',
      },
    });

    await prisma.user.update({
      where: { id: delegateUser.id },
      data: {
        department: 'Phòng Mua hàng',
        title: 'Phó Trưởng phòng',
      },
    });

    // Refresh admin JWT
    adminUser.accessToken = await loginUser(
      app,
      adminUser.email,
      adminUser.password,
    );

    // 1. Deploy Operaton BPMN workflow
    const bpmnFilePath = path.resolve(
      __dirname,
      '../../deploy/operaton/bpmn-templates/e-office-purchase-flow-1.bpmn',
    );
    const bpmnContent = fs.readFileSync(bpmnFilePath, 'utf-8');

    const deployRes = await deployOperatonWorkflow(app, adminUser.accessToken, {
      deploymentName: 'E2E Runtime Test Deployment',
      category: 'e-Office',
      bpmnXml: bpmnContent,
    }).expect(201);

    const deployedDef = deployRes.body.deployedProcessDefinitions[0];
    operatonDefinitionId = deployedDef.id;
    operatonDefinitionKey = deployedDef.key;

    // 2. Create Form and FormVersion
    const formPayload = buildFormPayload('E2E Runtime Form');
    const formRes = await createForm(
      app,
      adminUser.accessToken,
      formPayload,
    ).expect(201);
    formVersionId = formRes.body.versionId;

    // 3. Create Procedure & publish draft version
    const procRes = await createProcedure(app, adminUser.accessToken, {
      code: `PRC-RUN-${Date.now()}`,
      name: 'Quy trình Mua sắm Run-time E2E',
      description: 'Test Phase 5 runtime execution',
    }).expect(201);

    procedureId = procRes.body.id;
    procedureVersionId = procRes.body.draftVersion.id;

    // 4. Update ProcedureVersion with valid mappings matching e-office-purchase-flow-1.bpmn
    await updateProcedureVersion(
      app,
      adminUser.accessToken,
      procedureVersionId,
      {
        formVersionId,
        operatonDefinitionId,
        actorMappings: [
          {
            taskDefinitionKey: 'step_review_1',
            taskName: 'Bộ phận Mua hàng thẩm định (Giá trị cao)',
            order: 1,
            assigneeType: 'DIRECT_USER',
            defaultUserId: approverUser.id,
            allowOverride: true,
            required: true,
          },
          {
            taskDefinitionKey: 'step_review_2',
            taskName: 'Kế toán mua hàng duyệt (Giá trị thấp)',
            order: 2,
            assigneeType: 'DIRECT_USER',
            defaultUserId: approverUser.id,
            allowOverride: true,
            required: true,
          },
          {
            taskDefinitionKey: 'step_department_head',
            taskName: 'Trưởng phòng phụ trách duyệt',
            order: 3,
            assigneeType: 'DIRECT_USER',
            defaultUserId: approverUser.id,
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
      },
    ).expect(200);

    // Validate and publish procedure version
    await validateProcedureVersion(
      app,
      adminUser.accessToken,
      procedureVersionId,
    ).expect(200);

    await publishProcedureVersion(
      app,
      adminUser.accessToken,
      procedureVersionId,
    ).expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('TC-RUN-I01: Create Request from Procedure', () => {
    it('should create a DRAFT request pinned to procedure version with layout schema and default actors', async () => {
      const res = await createRequestFromProcedure(
        app,
        requesterUser.accessToken,
        {
          procedureId,
        },
      ).expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.procedure.id).toBe(procedureId);
      expect(res.body.procedureVersion.id).toBe(procedureVersionId);
      expect(res.body.formVersion.layoutSchema).toBeDefined();
      expect(res.body.defaultActors.length).toBeGreaterThan(0);
    });
  });

  describe('TC-RUN-I02: Flow Simulation & Condition Branching', () => {
    it('should evaluate gateway condition and predict active branches based on input values', async () => {
      const createRes = await createRequestFromProcedure(
        app,
        requesterUser.accessToken,
        {
          procedureId,
        },
      ).expect(201);

      const requestId = createRes.body.id;

      // When days (mapped to var_amount) >= 50M -> step_review_1 active, step_review_2 bypassed
      const previewRes = await previewFlow(
        app,
        requesterUser.accessToken,
        requestId,
        {
          values: {
            days: 80000000,
          },
        },
      ).expect(200);

      expect(previewRes.body.variables.var_amount).toBe(80000000);
      expect(previewRes.body.activeTaskKeys).toContain('step_review_1');
      expect(previewRes.body.bypassedTaskKeys).toContain('step_review_2');
    });
  });

  describe('TC-RUN-I03 & ADR-003: Actor Preview & Override', () => {
    it('should deny override when allowOverride is false and accept when allowOverride is true', async () => {
      const createRes = await createRequestFromProcedure(
        app,
        requesterUser.accessToken,
        {
          procedureId,
        },
      ).expect(201);

      const requestId = createRes.body.id;

      // Attempt override on locked task (step_final_approver) -> 403 Forbidden
      const deniedRes = await setActualActors(
        app,
        requesterUser.accessToken,
        requestId,
        {
          actors: [
            {
              taskDefinitionKey: 'step_final_approver',
              userId: delegateUser.id,
            },
          ],
        },
      ).expect(403);

      expect(deniedRes.body.code).toBe('ERR_ACTOR_OVERRIDE_DENIED');

      // Allowed override on step_review_1 task -> 200 OK
      const allowedRes = await setActualActors(
        app,
        requesterUser.accessToken,
        requestId,
        {
          actors: [
            {
              taskDefinitionKey: 'step_review_1',
              userId: delegateUser.id,
            },
          ],
        },
      ).expect(200);

      expect(allowedRes.body.success).toBe(true);
      const reviewActor = allowedRes.body.actualActors.find(
        (a: any) => a.taskDefinitionKey === 'step_review_1',
      );
      expect(reviewActor.userId).toBe(delegateUser.id);
      expect(reviewActor.isOverridden).toBe(true);
    });
  });

  describe('TC-RUN-I04: Submit, TaskProjection & My Duties', () => {
    it('should start Operaton process instance, record projected tasks and appear in My Duties', async () => {
      const createRes = await createRequestFromProcedure(
        app,
        requesterUser.accessToken,
        {
          procedureId,
        },
      ).expect(201);

      const requestId = createRes.body.id;

      // Submit with days = 25M (routed to step_review_2)
      const submitRes = await submitProcedureRequest(
        app,
        requesterUser.accessToken,
        requestId,
        {
          values: {
            days: 25000000,
          },
        },
      );

      if (submitRes.status !== 200) {
        console.error('Submit failed in TC-RUN-I04:', submitRes.body);
      }
      expect(submitRes.status).toBe(200);

      expect(submitRes.body.status).toBe('PENDING');
      expect(submitRes.body.operatonProcessInstanceId).toBeDefined();

      // Check My Duties for approver
      const dutiesRes = await getMyDuties(
        app,
        approverUser.accessToken,
        { tab: 'pending' },
      ).expect(200);

      expect(dutiesRes.body.items).toBeDefined();
      const myTask = dutiesRes.body.items.find(
        (i: any) => i.request.id === requestId,
      );
      expect(myTask).toBeDefined();
      expect(myTask.taskDefinitionKey).toBe('step_review_2');
    });
  });

  describe('TC-RUN-I05: Sign-then-Approve Enforcement', () => {
    it('should enforce signature before approve and allow sign-and-approve atomically', async () => {
      const createRes = await createRequestFromProcedure(
        app,
        requesterUser.accessToken,
        {
          procedureId,
        },
      ).expect(201);

      const requestId = createRes.body.id;

      const prisma = app.get(PrismaService);

      // Create a dummy document & SignatureField for this request
      const doc = await prisma.document.create({
        data: {
          name: 'to_trinh.pdf',
          filePath: 'uploads/to_trinh.pdf',
          mimeType: 'application/pdf',
          createdById: requesterUser.id,
        },
      });

      const sigField = await prisma.signatureField.create({
        data: {
          responseId: requestId,
          documentId: doc.id,
          assigneeId: approverUser.id,
          taskDefinitionKey: 'step_review_2',
          page: 1,
          x: 20,
          y: 20,
          width: 30,
          height: 10,
          status: 'PENDING',
        },
      });

      // Submit request
      const submitRes = await submitProcedureRequest(
        app,
        requesterUser.accessToken,
        requestId,
        {
          values: { days: 25000000 },
        },
      ).expect(200);

      const activeTaskId = submitRes.body.activeTasks[0].taskId;

      // 1. Try to approve directly -> should fail with 422 ERR_SIGNATURE_REQUIRED
      const blockedRes = await approveTask(
        app,
        approverUser.accessToken,
        requestId,
        activeTaskId,
        { comment: 'Approve without sign' },
      ).expect(422);

      expect(blockedRes.body.code).toBe('ERR_SIGNATURE_REQUIRED');

      // 2. Sign and approve atomically -> 200 OK
      const signedRes = await signAndApproveTask(
        app,
        approverUser.accessToken,
        requestId,
        activeTaskId,
        {
          signatureFieldIds: [sigField.id],
          signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          signatureName: 'Kế toán mua hàng',
          comment: 'Ký duyệt tờ trình',
        },
      ).expect(200);

      expect(signedRes.body.success).toBe(true);
      expect(signedRes.body.status).toBe('PENDING'); // advances to step_department_head

      // Verify SignatureField in DB is now SIGNED
      const updatedSig = await prisma.signatureField.findUnique({
        where: { id: sigField.id },
      });
      expect(updatedSig?.status).toBe('SIGNED');
      expect(updatedSig?.signedAt).toBeDefined();
    });
  });

  describe('TC-RUN-I06: Clone Procedure Request', () => {
    it('should clone request with mode reserve, keeping valid overrides and copying form values', async () => {
      const createRes = await createRequestFromProcedure(
        app,
        requesterUser.accessToken,
        {
          procedureId,
        },
      ).expect(201);

      const requestId = createRes.body.id;

      // Override step_review_1 to delegateUser
      await setActualActors(
        app,
        requesterUser.accessToken,
        requestId,
        {
          actors: [
            {
              taskDefinitionKey: 'step_review_1',
              userId: delegateUser.id,
            },
          ],
        },
      ).expect(200);

      // Clone request with mode reserve
      const cloneRes = await cloneProcedureRequest(
        app,
        requesterUser.accessToken,
        requestId,
        {
          mode: 'reserve',
        },
      ).expect(201);

      expect(cloneRes.body.newRequestId).toBeDefined();
      expect(cloneRes.body.status).toBe('DRAFT');

      // Verify the new request retained the delegateUser override
      const prisma = app.get(PrismaService);
      const clonedActors = await prisma.requestActualActor.findMany({
        where: { responseId: cloneRes.body.newRequestId },
      });

      const reviewActor = clonedActors.find(
        (a) => a.taskDefinitionKey === 'step_review_1',
      );
      expect(reviewActor?.userId).toBe(delegateUser.id);
      expect(reviewActor?.isOverridden).toBe(true);
    });
  });
});
