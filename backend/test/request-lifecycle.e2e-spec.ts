import { INestApplication } from '@nestjs/common';
import { RequestStatus, TaskStatus } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import { createRandomUsers, TestUser } from './utils/auth.helper';
import {
  buildFormPayload,
  buildRequestValues,
  parallelStep,
} from './utils/fixtures';
import {
  createForm,
  createRequest,
  getRequest,
  listDuty,
  listMine,
  listViewable,
} from './utils/api';

/**
 * Flow 1 — the everyday path: a logged-in user builds a form, files a request
 * against it while assigning an approver and a viewer, then each role sees the
 * request through the list endpoint that belongs to them (mine / duty /
 * viewable), filtered by the form id.
 */
describe('Flow 1 — create form + request and route it to the right people (e2e)', () => {
  let app: INestApplication;

  let requester: TestUser;
  let approver: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;

  let formId: string;
  let otherFormId: string;
  let requestId: string;

  beforeAll(async () => {
    app = await createTestApp();
    [requester, approver, viewer, outsider] = await createRandomUsers(app, 4);

    // A form owned by the requester, plus a second form to prove the ?formId
    // filter actually narrows results.
    const form = await createForm(
      app,
      requester.accessToken,
      buildFormPayload(),
    ).expect(201);
    formId = form.body.id;

    const other = await createForm(
      app,
      requester.accessToken,
      buildFormPayload(),
    ).expect(201);
    otherFormId = other.body.id;

    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      viewerIds: [viewer.id],
      steps: [parallelStep(1, [approver.id])],
    }).expect(201);
    requestId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates the request PENDING with a pending task for the approver', async () => {
    const res = await getRequest(app, requester.accessToken, requestId).expect(
      200,
    );

    expect(res.body.status).toBe(RequestStatus.PENDING);
    expect(res.body.formId).toBe(formId);
    expect(res.body.createdById).toBe(requester.id);
    expect(res.body.viewerIds).toContain(viewer.id);

    expect(res.body.flow.hasFlow).toBe(true);
    expect(res.body.flow.isDone).toBe(false);
    expect(res.body.flow.currentStep).toBe(1);
    expect(res.body.flow.tasks).toHaveLength(1);
    expect(res.body.flow.tasks[0].assignee.id).toBe(approver.id);
    expect(res.body.flow.tasks[0].status).toBe(TaskStatus.PENDING);
  });

  it('round-trips the EAV field values', async () => {
    const res = await getRequest(app, requester.accessToken, requestId).expect(
      200,
    );

    const byKey = Object.fromEntries(
      res.body.values.map((v: { fieldKey: string; value: unknown }) => [
        v.fieldKey,
        v.value,
      ]),
    );
    expect(byKey.reason).toBe('Family trip');
    expect(byKey.days).toBe(3);
    expect(byKey.leaveType).toBe('annual');
  });

  describe('GET /requests/mine', () => {
    it('lists the request for its creator, filtered by formId', async () => {
      const res = await listMine(app, requester.accessToken, formId).expect(
        200,
      );
      expect(res.body.items.map((r: { id: string }) => r.id)).toContain(
        requestId,
      );
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('excludes it when filtered by a different formId', async () => {
      const res = await listMine(
        app,
        requester.accessToken,
        otherFormId,
      ).expect(200);
      expect(res.body.items.map((r: { id: string }) => r.id)).not.toContain(
        requestId,
      );
    });

    it('does not surface it for a different user', async () => {
      const res = await listMine(app, approver.accessToken, formId).expect(200);
      expect(res.body.items.map((r: { id: string }) => r.id)).not.toContain(
        requestId,
      );
    });
  });

  describe('GET /requests/duty', () => {
    it('lists the request for the assigned approver, filtered by formId', async () => {
      const res = await listDuty(app, approver.accessToken, formId).expect(200);
      expect(res.body.items.map((r: { id: string }) => r.id)).toContain(
        requestId,
      );
    });

    it('is empty for the requester (no pending task of their own)', async () => {
      const res = await listDuty(app, requester.accessToken, formId).expect(
        200,
      );
      expect(res.body.items.map((r: { id: string }) => r.id)).not.toContain(
        requestId,
      );
    });
  });

  describe('GET /requests/viewable', () => {
    it('lists the request for the assigned viewer, filtered by formId', async () => {
      const res = await listViewable(app, viewer.accessToken, formId).expect(
        200,
      );
      expect(res.body.items.map((r: { id: string }) => r.id)).toContain(
        requestId,
      );
    });

    it('excludes the request from its own creator (viewable excludes mine)', async () => {
      const res = await listViewable(
        app,
        requester.accessToken,
        formId,
      ).expect(200);
      expect(res.body.items.map((r: { id: string }) => r.id)).not.toContain(
        requestId,
      );
    });

    it('is empty for an unrelated user', async () => {
      const res = await listViewable(app, outsider.accessToken, formId).expect(
        200,
      );
      expect(res.body.items.map((r: { id: string }) => r.id)).not.toContain(
        requestId,
      );
    });
  });

  it('auto-approves a request submitted without an approval flow', async () => {
    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
    }).expect(201);

    expect(created.body.status).toBe(RequestStatus.APPROVED);
    expect(created.body.flow.hasFlow).toBe(false);
  });
});
