import { INestApplication } from '@nestjs/common';
import { FieldType } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import { createRandomUsers, TestUser } from './utils/auth.helper';
import { buildFormPayload, buildRequestValues } from './utils/fixtures';
import {
  createForm,
  createRequest,
  getForm,
  getFormVersion,
  getRequest,
  updateForm,
} from './utils/api';

interface FieldView {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}

const fieldByKey = (
  fields: FieldView[],
  key: string,
): FieldView | undefined => fields.find((f) => f.key === key);

/**
 * Flow 3 — updating a form. Scalar-only edits patch the current version in
 * place; adding a field or changing a field's type forks a NEW version, while
 * requests already filed keep pointing at the version they were created with.
 */
describe('Flow 3 — form update + versioning (e2e)', () => {
  let app: INestApplication;
  let owner: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    [owner] = await createRandomUsers(app, 1);
  });

  afterAll(async () => {
    await app.close();
  });

  it('patches scalar field props in place without bumping the version', async () => {
    const created = await createForm(
      app,
      owner.accessToken,
      buildFormPayload(),
    ).expect(201);
    const formId = created.body.id;
    expect(created.body.version).toBe(1);

    const updated = await updateForm(app, owner.accessToken, formId, {
      fields: [
        {
          key: 'reason',
          label: 'Updated reason label',
          type: FieldType.TEXT,
          required: false,
        },
      ],
    }).expect(200);

    expect(updated.body.version).toBe(1); // same version
    expect(fieldByKey(updated.body.fields, 'reason')?.label).toBe(
      'Updated reason label',
    );
  });

  it('forks a new version when a new field key is added', async () => {
    const created = await createForm(
      app,
      owner.accessToken,
      buildFormPayload(),
    ).expect(201);
    const formId = created.body.id;
    const original = created.body.fields;

    const updated = await updateForm(app, owner.accessToken, formId, {
      // Re-send existing fields plus a brand-new one (a new version is rebuilt
      // from the fields supplied).
      fields: [
        ...original.map((f: FieldView) => ({
          key: f.key,
          label: f.label,
          type: f.type,
        })),
        { key: 'manager', label: 'Manager', type: FieldType.TEXT },
      ],
    }).expect(200);

    expect(updated.body.version).toBe(2);
    expect(updated.body.fields.map((f: FieldView) => f.key)).toContain(
      'manager',
    );

    const fetched = await getForm(app, owner.accessToken, formId).expect(200);
    expect(fetched.body.version).toBe(2);
  });

  it('forks a new version when a field type changes', async () => {
    const created = await createForm(
      app,
      owner.accessToken,
      buildFormPayload(),
    ).expect(201);
    const formId = created.body.id;

    const updated = await updateForm(app, owner.accessToken, formId, {
      fields: [{ key: 'days', label: 'Number of days', type: FieldType.TEXT }],
    }).expect(200);

    expect(updated.body.version).toBe(2);
    expect(fieldByKey(updated.body.fields, 'days')?.type).toBe(FieldType.TEXT);
  });

  it('pins existing requests to their version while new requests use the latest', async () => {
    const created = await createForm(
      app,
      owner.accessToken,
      buildFormPayload(),
    ).expect(201);
    const formId = created.body.id;
    const original = created.body.fields;

    // A request filed against v1.
    const oldReq = await createRequest(app, owner.accessToken, {
      formId,
      values: buildRequestValues(),
    }).expect(201);
    expect(oldReq.body.version).toBe(1);
    const oldVersionId = oldReq.body.formVersionId;

    // Adding a field forks v2.
    const bumped = await updateForm(app, owner.accessToken, formId, {
      fields: [
        ...original.map((f: FieldView) => ({
          key: f.key,
          label: f.label,
          type: f.type,
        })),
        { key: 'comment', label: 'Comment', type: FieldType.TEXT },
      ],
    }).expect(200);
    expect(bumped.body.version).toBe(2);

    // The old request still points at v1.
    const refetchedOld = await getRequest(
      app,
      owner.accessToken,
      oldReq.body.id,
    ).expect(200);
    expect(refetchedOld.body.version).toBe(1);
    expect(refetchedOld.body.formVersionId).toBe(oldVersionId);

    // A new request now binds to v2.
    const newReq = await createRequest(app, owner.accessToken, {
      formId,
      values: buildRequestValues(),
    }).expect(201);
    expect(newReq.body.version).toBe(2);
    expect(newReq.body.formVersionId).not.toBe(oldVersionId);
  });

  it('TC-FRM-E02: forks a new version when layoutSchema changes after responses exist, while GET /forms/versions/:versionId returns v1 pinned layout', async () => {
    const v1Layout = {
      schemaVersion: 1,
      sections: [
        {
          id: 'sec_1',
          title: 'V1 Layout',
          rows: [
            {
              id: 'r1',
              items: [
                { id: 'i1', kind: 'field', fieldKey: 'reason', colSpan: 12 },
                { id: 'i2', kind: 'field', fieldKey: 'days', colSpan: 12 },
              ],
            },
          ],
        },
      ],
    };
    // Invalid row > 12 won't pass; keep row valid:
    v1Layout.sections[0].rows = [
      { id: 'r1', items: [{ id: 'i1', kind: 'field', fieldKey: 'reason', colSpan: 12 }] },
      { id: 'r2', items: [{ id: 'i2', kind: 'field', fieldKey: 'days', colSpan: 12 }] },
    ];

    const created = await createForm(app, owner.accessToken, {
      ...buildFormPayload(),
      layoutSchema: v1Layout,
    }).expect(201);
    const formId = created.body.id;
    const v1Id = created.body.versionId;

    await createRequest(app, owner.accessToken, {
      formId,
      values: buildRequestValues(),
    }).expect(201);

    const v2Layout = {
      schemaVersion: 1,
      sections: [
        {
          id: 'sec_1',
          title: 'V2 Compact Layout',
          rows: [
            {
              id: 'r1',
              items: [
                { id: 'i1', kind: 'field', fieldKey: 'reason', colSpan: 6 },
                { id: 'i2', kind: 'field', fieldKey: 'days', colSpan: 6 },
              ],
            },
          ],
        },
      ],
    };

    const bumped = await updateForm(app, owner.accessToken, formId, {
      layoutSchema: v2Layout,
    }).expect(200);
    expect(bumped.body.version).toBe(2);
    expect(bumped.body.layoutSchema.sections[0].title).toBe('V2 Compact Layout');

    // Old version stays pinned with its v1 layout
    const pinnedV1 = await getFormVersion(app, owner.accessToken, v1Id).expect(200);
    expect(pinnedV1.body.version).toBe(1);
    expect(pinnedV1.body.versionId).toBe(v1Id);
    expect(pinnedV1.body.layoutSchema.sections[0].title).toBe('V1 Layout');
  });

  it('TC-FRM-E03: returns layoutSchema: null cleanly for forms without layoutSchema', async () => {
    const created = await createForm(
      app,
      owner.accessToken,
      buildFormPayload(),
    ).expect(201);
    expect(created.body.layoutSchema).toBeNull();

    const fetchedLatest = await getForm(app, owner.accessToken, created.body.id).expect(200);
    expect(fetchedLatest.body.layoutSchema).toBeNull();

    const fetchedVersion = await getFormVersion(
      app,
      owner.accessToken,
      created.body.versionId,
    ).expect(200);
    expect(fetchedVersion.body.layoutSchema).toBeNull();
  });

  it('TC-FRM-E07: returns 404 when requesting an unknown FormVersion id', async () => {
    await getFormVersion(
      app,
      owner.accessToken,
      '00000000-0000-0000-0000-000000000000',
    ).expect(404);
  });
});
