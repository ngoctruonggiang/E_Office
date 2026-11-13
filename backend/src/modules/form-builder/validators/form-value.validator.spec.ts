import { BadRequestException } from '@nestjs/common';
import { FieldType, SelectMode } from '@prisma/client';
import {
  LayoutSchemaV1,
  evaluateVisibility,
} from '../layout-schema.types';
import {
  ValidatableFormField,
  validateRequestValues,
} from './form-value.validator';

const purchaseFields = (): ValidatableFormField[] => [
  {
    key: 'loai_mua_sam',
    label: 'Loại mua sắm',
    type: FieldType.SELECT,
    required: true,
    maxLength: null,
    min: null,
    max: null,
    selectMode: SelectMode.SINGLE,
    tableConfig: null,
    options: [{ value: 'VAN_PHONG' }, { value: 'THIET_BI' }],
    validations: [],
  },
  {
    key: 'hang_muc_mua',
    label: 'Chi tiết hạng mục',
    type: FieldType.TABLE,
    required: true,
    maxLength: null,
    min: null,
    max: null,
    selectMode: null,
    tableConfig: {
      minRows: 1,
      maxRows: 50,
      columns: [
        { key: 'ten_hang', label: 'Tên hàng', type: 'TEXT', required: true },
        { key: 'so_luong', label: 'Số lượng', type: 'NUMBER', required: true, min: 1 },
        { key: 'thanh_tien', label: 'Thành tiền', type: 'NUMBER', required: true, min: 0 },
      ],
      summary: {
        aggregates: [
          { columnKey: 'thanh_tien', op: 'SUM', targetFieldKey: 'tong_gia_tri' },
        ],
      },
    },
    options: [],
    validations: [],
  },
  {
    key: 'tong_gia_tri',
    label: 'Tổng giá trị',
    type: FieldType.NUMBER,
    required: true,
    maxLength: null,
    min: 0,
    max: null,
    selectMode: null,
    tableConfig: null,
    options: [],
    validations: [],
  },
  {
    key: 'ly_do_mua_thiet_bi',
    label: 'Giải trình vượt định mức',
    type: FieldType.TEXT,
    required: true,
    maxLength: 500,
    min: null,
    max: null,
    selectMode: null,
    tableConfig: null,
    options: [],
    validations: [],
  },
];

const purchaseLayout: LayoutSchemaV1 = {
  schemaVersion: 1,
  sections: [
    {
      id: 'sec_1',
      title: 'General',
      rows: [
        {
          id: 'r1',
          items: [{ id: 'i1', kind: 'field', fieldKey: 'loai_mua_sam', colSpan: 6 }],
        },
        {
          id: 'r2',
          items: [{ id: 'i2', kind: 'field', fieldKey: 'hang_muc_mua', colSpan: 12 }],
        },
        {
          id: 'r3',
          items: [{ id: 'i3', kind: 'field', fieldKey: 'tong_gia_tri', colSpan: 6 }],
        },
        {
          id: 'r4',
          items: [
            {
              id: 'i4',
              kind: 'field',
              fieldKey: 'ly_do_mua_thiet_bi',
              colSpan: 12,
              visibleWhen: {
                mode: 'any',
                rules: [
                  { fieldKey: 'loai_mua_sam', op: 'eq', value: 'THIET_BI' },
                  { fieldKey: 'tong_gia_tri', op: 'gte', value: 50000000 },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

describe('evaluateVisibility & validateRequestValues', () => {
  it('TC-FRM-U06: evaluates all 11 operators with all/any modes accurately', () => {
    const vals = {
      type: 'A',
      amount: 100,
      tags: ['HN', 'HCM'],
      note: 'Urgent order',
      emptyStr: '   ',
    };

    expect(
      evaluateVisibility(
        {
          mode: 'all',
          rules: [
            { fieldKey: 'type', op: 'eq', value: 'A' },
            { fieldKey: 'type', op: 'neq', value: 'B' },
            { fieldKey: 'type', op: 'in', value: ['A', 'C'] },
            { fieldKey: 'type', op: 'notIn', value: ['X', 'Y'] },
            { fieldKey: 'amount', op: 'gt', value: 99 },
            { fieldKey: 'amount', op: 'gte', value: 100 },
            { fieldKey: 'amount', op: 'lt', value: 101 },
            { fieldKey: 'amount', op: 'lte', value: 100 },
            { fieldKey: 'note', op: 'contains', value: 'urgent' },
            { fieldKey: 'tags', op: 'contains', value: 'HN' },
            { fieldKey: 'emptyStr', op: 'empty' },
            { fieldKey: 'note', op: 'notEmpty' },
          ],
        },
        vals,
      ),
    ).toBe(true);

    expect(
      evaluateVisibility(
        {
          mode: 'any',
          rules: [
            { fieldKey: 'amount', op: 'gt', value: 500 },
            { fieldKey: 'tags', op: 'in', value: ['DN', 'HCM'] },
          ],
        },
        vals,
      ),
    ).toBe(true);
  });

  it('TC-FRM-U07: skips required validation on hidden fields and strips hidden values on strict submit', () => {
    const result = validateRequestValues({
      fields: purchaseFields(),
      layoutSchema: purchaseLayout,
      mode: 'strict',
      entries: [
        { fieldKey: 'loai_mua_sam', value: 'VAN_PHONG' },
        {
          fieldKey: 'hang_muc_mua',
          value: [{ ten_hang: 'Giấy A4', so_luong: 10, thanh_tien: 850000 }],
        },
        // Stale value sent for a hidden required field -> must be stripped
        { fieldKey: 'ly_do_mua_thiet_bi', value: 'Stale text' },
      ],
    });

    expect(result.hiddenFieldKeys.has('ly_do_mua_thiet_bi')).toBe(true);
    expect(
      result.sanitizedEntries.find((e) => e.fieldKey === 'ly_do_mua_thiet_bi'),
    ).toBeUndefined();
    expect(
      result.sanitizedEntries.find((e) => e.fieldKey === 'tong_gia_tri')?.value,
    ).toBe(850000);
  });

  it('TC-FRM-U08: validates TABLE minRows and cell constraints with exact coordinates', () => {
    try {
      validateRequestValues({
        fields: purchaseFields(),
        layoutSchema: purchaseLayout,
        mode: 'strict',
        entries: [
          { fieldKey: 'loai_mua_sam', value: 'VAN_PHONG' },
          {
            fieldKey: 'hang_muc_mua',
            value: [{ ten_hang: '', so_luong: 0, thanh_tien: 1000 }],
          },
        ],
      });
      fail('Expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        details: Array<{
          fieldKey?: string;
          rowIndex?: number;
          columnKey?: string;
          code: string;
        }>;
      };
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldKey: 'hang_muc_mua',
            rowIndex: 0,
            columnKey: 'ten_hang',
            code: 'REQUIRED',
          }),
          expect.objectContaining({
            fieldKey: 'hang_muc_mua',
            rowIndex: 0,
            columnKey: 'so_luong',
            code: 'MIN_VALUE',
          }),
        ]),
      );
    }
  });

  it('TC-FRM-U09: recomputes TABLE SUM into targetFieldKey server-side and triggers downstream visibility', () => {
    // Client lied and sent tong_gia_tri = 100, while rows sum to 60_000_000.
    // Server must recompute tong_gia_tri = 60_000_000 AND trigger ly_do_mua_thiet_bi required!
    try {
      validateRequestValues({
        fields: purchaseFields(),
        layoutSchema: purchaseLayout,
        mode: 'strict',
        entries: [
          { fieldKey: 'loai_mua_sam', value: 'VAN_PHONG' },
          {
            fieldKey: 'hang_muc_mua',
            value: [
              { ten_hang: 'Server rack', so_luong: 2, thanh_tien: 30000000 },
              { ten_hang: 'Switch', so_luong: 1, thanh_tien: 30000000 },
            ],
          },
          { fieldKey: 'tong_gia_tri', value: 100 },
        ],
      });
      fail('Expected BadRequestException');
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as {
        details: Array<{ fieldKey?: string; code: string }>;
      };
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldKey: 'ly_do_mua_thiet_bi',
            code: 'REQUIRED',
          }),
        ]),
      );
    }
  });
});

