import { INestApplication } from '@nestjs/common';
import { RequestStatus, TaskAction, TaskStatus } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import { createRandomUsers, TestUser } from './utils/auth.helper';
import {
  buildFormPayload,
  buildRequestValues,
  parallelStep,
} from './utils/fixtures';
import {
  act,
  createForm,
  createRequest,
  getRequest,
  updateRequest,
} from './utils/api';

interface ValueView {
  fieldKey: string;
  value: unknown;
}

const valueFor = (values: ValueView[], key: string): unknown =>
  values.find((v) => v.fieldKey === key)?.value;

/**
 * Flow 4 — editing a request's field values. The creator may edit while the
 * request is DRAFT or PENDING; doing so changes only the EAV values and leaves
 * the approval flow (instance, steps, tasks, granted approvals) untouched.
 */
describe('Flow 4 — update request keeps its approval flow (e2e)', () => {
  let app: INestApplication;
  let requester: TestUser;
  let approverA: TestUser;
  let approverB: TestUser;
  let formId: string;

  beforeAll(async () => {
    app = await createTestApp();
    [requester, approverA, approverB] = await createRandomUsers(app, 3);
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

  it('updates values of a PENDING request and leaves the flow intact', async () => {
    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      steps: [parallelStep(1, [approverA.id])],
    }).expect(201);
    const id = created.body.id;

    const updated = await updateRequest(app, requester.accessToken, id, {
      values: [
        { fieldKey: 'reason', value: 'Updated: conference travel' },
        { fieldKey: 'days', value: 5 },
      ],
    }).expect(200);

    // New information landed.
    expect(valueFor(updated.body.values, 'reason')).toBe(
      'Updated: conference travel',
    );
    expect(valueFor(updated.body.values, 'days')).toBe(5);
    // Untouched field is preserved.
    expect(valueFor(updated.body.values, 'leaveType')).toBe('annual');

    // Flow is exactly where it was.
    expect(updated.body.status).toBe(RequestStatus.PENDING);
    expect(updated.body.flow.hasFlow).toBe(true);
    expect(updated.body.flow.currentStep).toBe(1);
    expect(updated.body.flow.tasks).toHaveLength(1);
    expect(updated.body.flow.tasks[0].assignee.id).toBe(approverA.id);
    expect(updated.body.flow.tasks[0].status).toBe(TaskStatus.PENDING);
  });

  it('preserves already-granted approvals when editing mid-flow', async () => {
    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      steps: [parallelStep(1, [approverA.id, approverB.id])],
    }).expect(201);
    const id = created.body.id;

    // One approver acts; the step is still waiting on the other.
    await act(app, approverA.accessToken, id, TaskAction.APPROVE).expect(201);

    const updated = await updateRequest(app, requester.accessToken, id, {
      values: [{ fieldKey: 'reason', value: 'Edited after first approval' }],
    }).expect(200);

    expect(updated.body.status).toBe(RequestStatus.PENDING);
    const byUser = Object.fromEntries(
      updated.body.flow.tasks.map((t: { assignee: { id: string }; status: TaskStatus }) => [
        t.assignee.id,
        t.status,
      ]),
    );
    expect(byUser[approverA.id]).toBe(TaskStatus.DONE);
    expect(byUser[approverB.id]).toBe(TaskStatus.PENDING);
  });

  it('rejects edits from someone who is not the creator (403)', async () => {
    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      steps: [parallelStep(1, [approverA.id])],
    }).expect(201);

    await updateRequest(app, approverA.accessToken, created.body.id, {
      values: [{ fieldKey: 'reason', value: 'hijack' }],
    }).expect(403);
  });

  it('rejects edits once the request is finalized (400)', async () => {
    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      steps: [parallelStep(1, [approverA.id])],
    }).expect(201);
    const id = created.body.id;

    await act(app, approverA.accessToken, id, TaskAction.APPROVE).expect(201);
    const finalized = await getRequest(app, requester.accessToken, id).expect(
      200,
    );
    expect(finalized.body.status).toBe(RequestStatus.APPROVED);

    await updateRequest(app, requester.accessToken, id, {
      values: [{ fieldKey: 'reason', value: 'too late' }],
    }).expect(400);
  });

  it('updates a DRAFT request (submitted later) and keeps it DRAFT', async () => {
    const created = await createRequest(app, requester.accessToken, {
      formId,
      values: buildRequestValues(),
      submit: false,
    }).expect(201);
    expect(created.body.status).toBe(RequestStatus.DRAFT);

    const updated = await updateRequest(
      app,
      requester.accessToken,
      created.body.id,
      { values: [{ fieldKey: 'days', value: 10 }] },
    ).expect(200);

    expect(updated.body.status).toBe(RequestStatus.DRAFT);
    expect(valueFor(updated.body.values, 'days')).toBe(10);
    expect(updated.body.flow.hasFlow).toBe(false);
  });
});
