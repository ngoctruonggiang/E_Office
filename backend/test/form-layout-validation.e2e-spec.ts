import { INestApplication } from '@nestjs/common';
import { FieldType, RequestStatus, SelectMode } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import { createRandomUsers, TestUser } from './utils/auth.helper';
import {
  createForm,
  createRequest,
  getRequest,
  submitDraft,
  updateRequest,
} from './utils/api';
import { uniqueName } from './utils/fixtures';

function buildPurchaseFormPayload() {
  return {
    name: uniqueName('Purchase Layout Form'),
    fields: [
      {
        key: 'loai_mua_sam',
        label: 'Loại mua sắm',
        type: FieldType.SELECT,
        required: true,
        selectMode: SelectMode.SINGLE,
        options: [
          { label: 'Vật tư văn phòng', value: 'VAN_PHONG' },
          { label: 'Thiết bị CNTT', value: 'THIET_BI' },
        ],
      },
      {
        key: 'hang_muc_mua',
        label: 'Chi tiết hạng mục',
        type: FieldType.TABLE,
        required: true,
        tableConfig: {
          showRowNumber: true,
          minRows: 1,
          maxRows: 50,
          addRowLabel: 'Thêm hạng mục',
          columns: [
            {
              key: 'ten_hang',
              label: 'Tên hàng',
              type: 'TEXT',
              required: true,
              maxLength: 200,
            },
            {
              key: 'so_luong',
              label: 'Số lượng',
              type: 'NUMBER',
              required: true,
              min: 1,
            },
            {
              key: 'thanh_tien',
              label: 'Thành tiền',
              type: 'NUMBER',
              required: true,
              min: 0,
            },
          ],
          summary: {
            label: 'Tổng giá trị đề xuất',
            aggregates: [
              {
                columnKey: 'thanh_tien',
                op: 'SUM',
                targetFieldKey: 'tong_gia_tri',
              },
            ],
          },
        },
      },
      {
        key: 'tong_gia_tri',
        label: 'Tổng giá trị',
        type: FieldType.NUMBER,
        required: true,
        min: 0,
      },
      {
        key: 'ly_do_mua_thiet_bi',
        label: 'Giải trình kỹ thuật / Vượt định mức',
        type: FieldType.TEXT,
        required: true,
        maxLength: 500,
      },
    ],
    layoutSchema: {
      schemaVersion: 1,
      settings: { columns: 12, labelPlacement: 'top', showSectionNumbers: true },
      sections: [
        {
          id: 'sec_info',
          title: 'Thông tin chung',
          rows: [
            {
              id: 'r1',
              items: [
                {
                  id: 'it_type',
                  kind: 'field',
                  fieldKey: 'loai_mua_sam',
                  colSpan: 6,
                },
                {
                  id: 'it_total',
                  kind: 'field',
                  fieldKey: 'tong_gia_tri',
                  colSpan: 6,
                  readOnly: true,
                },
              ],
            },
          ],
        },
        {
          id: 'sec_items',
          title: 'Danh sách hạng mục',
          rows: [
            {
              id: 'r2',
              items: [
                {
                  id: 'it_table',
                  kind: 'field',
                  fieldKey: 'hang_muc_mua',
                  colSpan: 12,
                },
              ],
            },
            {
              id: 'r3',
              items: [
                {
                  id: 'it_slot',
                  kind: 'attachmentSlot',
                  slotKey: 'bao_gia_ncc',
                  label: 'Báo giá nhà cung cấp (PDF)',
                  targetSection: 'SECONDARY',
                  required: true,
                  colSpan: 6,
                },
                {
                  id: 'it_reason',
                  kind: 'field',
                  fieldKey: 'ly_do_mua_thiet_bi',
                  colSpan: 6,
                  visibleWhen: {
                    mode: 'any',
                    rules: [
                      {
                        fieldKey: 'loai_mua_sam',
                        op: 'eq',
                        value: 'THIET_BI',
                      },
                      {
                        fieldKey: 'tong_gia_tri',
                        op: 'gte',
                        value: 50000000,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

describe('Phase 2 — form layout & server-side validation (e2e)', () => {
  let app: INestApplication;
  let owner: TestUser;
  let formId: string;

  beforeAll(async () => {
    app = await createTestApp();
    [owner] = await createRandomUsers(app, 1);

    const created = await createForm(
      app,
      owner.accessToken,
      buildPurchaseFormPayload(),
    ).expect(201);
    formId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('TC-FRM-E04: skips hidden required field, strips stale hidden value, and syncs TABLE SUM target', async () => {
    const created = await createRequest(app, owner.accessToken, {
      formId,
      values: [
        { fieldKey: 'loai_mua_sam', value: 'VAN_PHONG' },
        {
          fieldKey: 'hang_muc_mua',
          value: [
            { ten_hang: 'Giấy A4', so_luong: 10, thanh_tien: 850000 },
          ],
        },
        { fieldKey: 'ly_do_mua_thiet_bi', value: 'Should be stripped' },
      ],
    }).expect(201);

    const req = await getRequest(app, owner.accessToken, created.body.id).expect(200);
    const valMap = new Map(
      req.body.values.map((v: { fieldKey: string; value: unknown }) => [
        v.fieldKey,
        v.value,
      ]),
    );
    expect(valMap.get('tong_gia_tri')).toBe(850000);
    expect(valMap.has('ly_do_mua_thiet_bi')).toBe(false);
  });

  it('TC-FRM-E05: returns 400 when computed TABLE SUM triggers required conditional field', async () => {
    const res = await createRequest(app, owner.accessToken, {
      formId,
      values: [
        { fieldKey: 'loai_mua_sam', value: 'VAN_PHONG' },
        {
          fieldKey: 'hang_muc_mua',
          value: [
            { ten_hang: 'Máy chủ', so_luong: 1, thanh_tien: 60000000 },
          ],
        },
      ],
    }).expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: 'ly_do_mua_thiet_bi',
          code: 'REQUIRED',
        }),
      ]),
    );
  });

  it('TC-FRM-E06: allows incomplete DRAFT save, then enforces strict validation on POST /requests/:id/submit', async () => {
    const draft = await createRequest(app, owner.accessToken, {
      formId,
      submit: false,
      values: [{ fieldKey: 'loai_mua_sam', value: 'THIET_BI' }],
    }).expect(201);
    expect(draft.body.status).toBe(RequestStatus.DRAFT);

    // Updating only the table without ly_do_mua_thiet_bi stays allowed while DRAFT
    await updateRequest(app, owner.accessToken, draft.body.id, {
      values: [
        {
          fieldKey: 'hang_muc_mua',
          value: [{ ten_hang: 'Laptop', so_luong: 1, thanh_tien: 20000000 }],
        },
      ],
    }).expect(200);

    // Submitting without required conditional field must fail with 400
    await submitDraft(app, owner.accessToken, draft.body.id, {}).expect(400);

    // Fill required field then submit -> succeeds
    await updateRequest(app, owner.accessToken, draft.body.id, {
      values: [
        { fieldKey: 'ly_do_mua_thiet_bi', value: 'Phục vụ phát triển phần mềm' },
      ],
    }).expect(200);

    const submitted = await submitDraft(
      app,
      owner.accessToken,
      draft.body.id,
      {},
    ).expect(201);
    expect(submitted.body.status).toBe(RequestStatus.APPROVED);
  });
});
