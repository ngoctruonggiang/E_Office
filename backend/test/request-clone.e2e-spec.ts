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
  cloneReserve,
  cloneReset,
  createForm,
  createRequest,
  getFlowStatus,
  getRequest,
} from './utils/api';

interface FlowTask {
  assignee: { id: string };
  status: TaskStatus;
}

const statusByUser = (tasks: FlowTask[]): Record<string, TaskStatus> =>
  Object.fromEntries(tasks.map((t) => [t.assignee.id, t.status]));

/**
 * Flow 5 — cloning a request that is half-way through a complex flow:
 *
 *   step 1  SEQUENTIAL  [a, b]   (both approved)
 *   step 2  PARALLEL    [c, d]   (c approved, d still pending)  ← stopped here
 *   step 3  SEQUENTIAL  [e]      (not reached)
 *
 * clone-reserve carries the approval state over; clone-reset starts fresh.
 * Both are checked through the approval-flow controller (read-only status) and
 * the request controller (detail status).
 */
describe('Flow 5 — clone a half-way request (reserve vs reset) (e2e)', () => {
  let app: INestApplication;
  let requester: TestUser;
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  let d: TestUser;
  let e: TestUser;
  let formId: string;
  let sourceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    [requester, a, b, c, d, e] = await createRandomUsers(app, 6);
    const form = await createForm(
      app,
      requester.accessToken,
      buildFormPayload(),
    ).expect(201);
    formId = form.body.id;

    // Build the source request and drive it to the half-way point.
    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      steps: [
        sequentialStep(1, [a.id, b.id]),
        parallelStep(2, [c.id, d.id]),
        sequentialStep(3, [e.id]),
      ],
    }).expect(201);
    sourceId = created.body.id;

    await act(app, a.accessToken, sourceId, TaskAction.APPROVE).expect(201);
    await act(app, b.accessToken, sourceId, TaskAction.APPROVE).expect(201);
    await act(app, c.accessToken, sourceId, TaskAction.APPROVE).expect(201);

    // Sanity: source is half-way (step 2, c done, d pending).
    const src = await getFlowStatus(app, requester.accessToken, sourceId).expect(
      200,
    );
    expect(src.body.currentStep).toBe(2);
    expect(statusByUser(src.body.tasks)[d.id]).toBe(TaskStatus.PENDING);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('clone-reserve — carries the approval state over', () => {
    let cloneId: string;

    beforeAll(async () => {
      const res = await cloneReserve(
        app,
        requester.accessToken,
        sourceId,
      ).expect(201);
      cloneId = res.body.id;
    });

    it('returns a new request linked to the source with values copied', async () => {
      const detail = await getRequest(
        app,
        requester.accessToken,
        cloneId,
      ).expect(200);

      expect(cloneId).not.toBe(sourceId);
      expect(detail.body.clonedFromId).toBe(sourceId);
      expect(detail.body.createdById).toBe(requester.id);
      const byKey = Object.fromEntries(
        detail.body.values.map((v: { fieldKey: string; value: unknown }) => [
          v.fieldKey,
          v.value,
        ]),
      );
      expect(byKey.reason).toBe('Family trip');
      expect(byKey.days).toBe(3);
    });

    it('reports the same half-way status via the approval-flow controller', async () => {
      const status = await getFlowStatus(
        app,
        requester.accessToken,
        cloneId,
      ).expect(200);

      expect(status.body.hasFlow).toBe(true);
      expect(status.body.isDone).toBe(false);
      expect(status.body.currentStep).toBe(2);
      expect(status.body.requestStatus).toBe(RequestStatus.PENDING);

      const byUser = statusByUser(status.body.tasks);
      expect(byUser[a.id]).toBe(TaskStatus.DONE);
      expect(byUser[b.id]).toBe(TaskStatus.DONE);
      expect(byUser[c.id]).toBe(TaskStatus.DONE);
      expect(byUser[d.id]).toBe(TaskStatus.PENDING);
      expect(byUser[e.id]).toBeUndefined();
    });

    it('exposes the same status via the request controller detail', async () => {
      const detail = await getRequest(
        app,
        requester.accessToken,
        cloneId,
      ).expect(200);
      expect(detail.body.status).toBe(RequestStatus.PENDING);
      expect(detail.body.flow.currentStep).toBe(2);
      expect(statusByUser(detail.body.flow.tasks)[d.id]).toBe(
        TaskStatus.PENDING,
      );
    });

    it('is an independent, live flow that the pending approver can continue', async () => {
      // d acts on the CLONE — the source must be unaffected.
      const afterD = await act(
        app,
        d.accessToken,
        cloneId,
        TaskAction.APPROVE,
      ).expect(201);
      expect(afterD.body.currentStep).toBe(3); // advanced past step 2
      expect(statusByUser(afterD.body.tasks)[e.id]).toBe(TaskStatus.PENDING);

      // Source is still parked on step 2 with d pending.
      const src = await getFlowStatus(
        app,
        requester.accessToken,
        sourceId,
      ).expect(200);
      expect(src.body.currentStep).toBe(2);
      expect(statusByUser(src.body.tasks)[d.id]).toBe(TaskStatus.PENDING);
    });
  });

  describe('clone-reset — starts fresh', () => {
    let cloneId: string;

    beforeAll(async () => {
      const res = await cloneReset(
        app,
        requester.accessToken,
        sourceId,
      ).expect(201);
      cloneId = res.body.id;
    });

    it('copies the values but links to the source as a DRAFT', async () => {
      const detail = await getRequest(
        app,
        requester.accessToken,
        cloneId,
      ).expect(200);

      expect(detail.body.clonedFromId).toBe(sourceId);
      expect(detail.body.status).toBe(RequestStatus.DRAFT);
      const byKey = Object.fromEntries(
        detail.body.values.map((v: { fieldKey: string; value: unknown }) => [
          v.fieldKey,
          v.value,
        ]),
      );
      expect(byKey.reason).toBe('Family trip');
      expect(byKey.leaveType).toBe('annual');
    });

    it('carries no approval flow via the approval-flow controller', async () => {
      const status = await getFlowStatus(
        app,
        requester.accessToken,
        cloneId,
      ).expect(200);

      expect(status.body.hasFlow).toBe(false);
      expect(status.body.isDone).toBe(false);
      expect(status.body.currentStep).toBeNull();
      expect(status.body.tasks).toHaveLength(0);
      expect(status.body.requestStatus).toBe(RequestStatus.DRAFT);
    });

    it('shows a flowless DRAFT via the request controller detail', async () => {
      const detail = await getRequest(
        app,
        requester.accessToken,
        cloneId,
      ).expect(200);
      expect(detail.body.status).toBe(RequestStatus.DRAFT);
      expect(detail.body.flow.hasFlow).toBe(false);
      expect(detail.body.flow.tasks).toHaveLength(0);
    });
  });
});
