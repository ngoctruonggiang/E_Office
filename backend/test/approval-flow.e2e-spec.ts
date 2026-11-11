import { INestApplication } from '@nestjs/common';
import { RequestStatus, TaskAction, TaskStatus } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import { createRandomUsers, TestUser } from './utils/auth.helper';
import {
  buildFormPayload,
  buildRequestValues,
  parallelStep,
  sequentialStep,
} from './utils/fixtures';
import {
  act,
  createForm,
  createRequest,
  getFlowStatus,
  listDuty,
} from './utils/api';

interface FlowTask {
  assignee: { id: string };
  status: TaskStatus;
  action: TaskAction | null;
  stepOrder: number;
}

const taskFor = (
  body: { tasks: FlowTask[] },
  userId: string,
): FlowTask | undefined => body.tasks.find((t) => t.assignee.id === userId);

/**
 * Flow 2 — approval engine correctness over a complex, multi-step flow:
 *
 *   step 1  SEQUENTIAL  [a, b]
 *   step 2  PARALLEL    [c, d]
 *   step 3  SEQUENTIAL  [e]
 *
 * We verify turn-taking (who can act when), the half-way state, a fully
 * approved run, and a terminal rejection.
 */
describe('Flow 2 — complex approval flow (e2e)', () => {
  let app: INestApplication;

  let requester: TestUser;
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  let d: TestUser;
  let e: TestUser;
  let formId: string;

  const complexSteps = () => [
    sequentialStep(1, [a.id, b.id]),
    parallelStep(2, [c.id, d.id]),
    sequentialStep(3, [e.id]),
  ];

  const newRequest = async (): Promise<string> => {
    const res = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      steps: complexSteps(),
    }).expect(201);
    return res.body.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    [requester, a, b, c, d, e] = await createRandomUsers(app, 6);
    const form = await createForm(
      app,
      requester.accessToken,
      buildFormPayload(),
    ).expect(201);
    formId = form.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('turn-taking', () => {
    it('opens only the first SEQUENTIAL assignee and blocks the rest', async () => {
      const id = await newRequest();

      const status = await getFlowStatus(app, requester.accessToken, id).expect(
        200,
      );
      expect(status.body.currentStep).toBe(1);
      expect(status.body.tasks).toHaveLength(1);
      expect(taskFor(status.body, a.id)?.status).toBe(TaskStatus.PENDING);
      expect(taskFor(status.body, b.id)).toBeUndefined();

      // b cannot act before a hands off.
      await act(app, b.accessToken, id, TaskAction.APPROVE).expect(403);
      // c (a later step) cannot act either.
      await act(app, c.accessToken, id, TaskAction.APPROVE).expect(403);
    });

    it('hands off to the next SEQUENTIAL assignee after the first acts', async () => {
      const id = await newRequest();

      const afterA = await act(
        app,
        a.accessToken,
        id,
        TaskAction.APPROVE,
      ).expect(201);
      expect(afterA.body.currentStep).toBe(1);
      expect(taskFor(afterA.body, a.id)?.status).toBe(TaskStatus.DONE);
      expect(taskFor(afterA.body, b.id)?.status).toBe(TaskStatus.PENDING);

      // a has no pending task anymore.
      await act(app, a.accessToken, id, TaskAction.APPROVE).expect(403);
    });
  });

  describe('half-way flow', () => {
    let id: string;

    beforeAll(async () => {
      id = await newRequest();
      await act(app, a.accessToken, id, TaskAction.APPROVE).expect(201);
      await act(app, b.accessToken, id, TaskAction.APPROVE).expect(201); // step 1 done → step 2
      await act(app, c.accessToken, id, TaskAction.APPROVE).expect(201); // step 2 partial
    });

    it('sits on step 2 with the PARALLEL step only partly done', async () => {
      const status = await getFlowStatus(app, requester.accessToken, id).expect(
        200,
      );

      expect(status.body.requestStatus).toBe(RequestStatus.PENDING);
      expect(status.body.isDone).toBe(false);
      expect(status.body.currentStep).toBe(2);

      expect(taskFor(status.body, a.id)?.status).toBe(TaskStatus.DONE);
      expect(taskFor(status.body, b.id)?.status).toBe(TaskStatus.DONE);
      expect(taskFor(status.body, c.id)?.status).toBe(TaskStatus.DONE);
      expect(taskFor(status.body, d.id)?.status).toBe(TaskStatus.PENDING);
      // step 3 assignee has no task yet.
      expect(taskFor(status.body, e.id)).toBeUndefined();
    });

    it('shows the request as pending duty only for the outstanding approver (d)', async () => {
      const dDuty = await listDuty(app, d.accessToken, formId).expect(200);
      expect(dDuty.body.items.map((r: { id: string }) => r.id)).toContain(id);

      const cDuty = await listDuty(app, c.accessToken, formId).expect(200);
      expect(cDuty.body.items.map((r: { id: string }) => r.id)).not.toContain(
        id,
      );

      const eDuty = await listDuty(app, e.accessToken, formId).expect(200);
      expect(eDuty.body.items.map((r: { id: string }) => r.id)).not.toContain(
        id,
      );
    });
  });

  describe('fully approved flow', () => {
    it('walks every step to completion and ends APPROVED', async () => {
      const id = await newRequest();

      await act(app, a.accessToken, id, TaskAction.APPROVE).expect(201);
      await act(app, b.accessToken, id, TaskAction.APPROVE).expect(201);

      // Now on the PARALLEL step: one approval is not enough.
      const afterC = await act(
        app,
        c.accessToken,
        id,
        TaskAction.APPROVE,
      ).expect(201);
      expect(afterC.body.currentStep).toBe(2);
      expect(afterC.body.requestStatus).toBe(RequestStatus.PENDING);

      const afterD = await act(
        app,
        d.accessToken,
        id,
        TaskAction.APPROVE,
      ).expect(201);
      expect(afterD.body.currentStep).toBe(3);

      const afterE = await act(
        app,
        e.accessToken,
        id,
        TaskAction.APPROVE,
      ).expect(201);
      expect(afterE.body.isDone).toBe(true);
      expect(afterE.body.currentStep).toBeNull();
      expect(afterE.body.requestStatus).toBe(RequestStatus.APPROVED);
      expect(
        afterE.body.tasks.every((t: FlowTask) => t.status === TaskStatus.DONE),
      ).toBe(true);

      // Acting on a finished flow is rejected.
      await act(app, e.accessToken, id, TaskAction.APPROVE).expect(400);
    });
  });

  describe('rejection', () => {
    it('rejects the request and cancels any remaining pending tasks', async () => {
      const id = await newRequest();
      await act(app, a.accessToken, id, TaskAction.APPROVE).expect(201);

      const rejected = await act(
        app,
        b.accessToken,
        id,
        TaskAction.REJECT,
      ).expect(201);

      expect(rejected.body.isDone).toBe(true);
      expect(rejected.body.requestStatus).toBe(RequestStatus.REJECTED);
      expect(taskFor(rejected.body, b.id)?.action).toBe(TaskAction.REJECT);

      // No task ever opened for the later steps; none can act now.
      await act(app, c.accessToken, id, TaskAction.APPROVE).expect(400);
    });
  });
});
