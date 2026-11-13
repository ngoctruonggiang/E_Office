import { BadRequestException } from '@nestjs/common';
import { FieldType, SelectMode } from '@prisma/client';
import { FormFieldInput } from '../dto/form-field.input';
import { LayoutSchemaV1, normalizeLayoutSchema } from '../layout-schema.types';
import { validateFormStructure } from './layout.validator';

const baseFields = (): FormFieldInput[] => [
  {
    key: 'loai_mua_sam',
    label: 'Loại mua sắm',
    type: FieldType.SELECT,
    required: true,
    selectMode: SelectMode.SINGLE,
    options: [
      { label: 'Văn phòng', value: 'VAN_PHONG' },
      { label: 'Thiết bị', value: 'THIET_BI' },
    ],
  },
  {
    key: 'hang_muc_mua',
    label: 'Hạng mục',
    type: FieldType.TABLE,
    required: true,
    tableConfig: {
      minRows: 1,
      maxRows: 50,
      columns: [
        { key: 'ten_hang', label: 'Tên hàng', type: 'TEXT', required: true },
        { key: 'thanh_tien', label: 'Thành tiền', type: 'NUMBER', required: true, min: 0 },
      ],
      summary: {
        aggregates: [
          { columnKey: 'thanh_tien', op: 'SUM', targetFieldKey: 'tong_gia_tri' },
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
    key: 'ly_do',
    label: 'Giải trình',
    type: FieldType.TEXT,
    required: true,
  },
];

describe('validateFormStructure', () => {
  it('TC-FRM-U01: accepts valid LayoutSchemaV1 with sections, grid, heading, divider & attachmentSlot', () => {
    const layout: LayoutSchemaV1 = {
      schemaVersion: 1,
      settings: { columns: 12, labelPlacement: 'top', showSectionNumbers: true },
      sections: [
        {
          id: 'sec_1',
          title: 'Thông tin chung',
          rows: [
            {
              id: 'row_1',
              items: [
                { id: 'it_1', kind: 'field', fieldKey: 'loai_mua_sam', colSpan: 6 },
                { id: 'it_2', kind: 'field', fieldKey: 'tong_gia_tri', colSpan: 6, readOnly: true },
              ],
            },
            {
              id: 'row_2',
              items: [{ id: 'it_div', kind: 'divider', colSpan: 12 }],
            },
            {
              id: 'row_3',
              items: [
                { id: 'it_head', kind: 'heading', text: 'Chi tiết', colSpan: 12 },
              ],
            },
            {
              id: 'row_4',
              items: [
                { id: 'it_tbl', kind: 'field', fieldKey: 'hang_muc_mua', colSpan: 12 },
              ],
            },
            {
              id: 'row_5',
              items: [
                {
                  id: 'it_slot',
                  kind: 'attachmentSlot',
                  slotKey: 'bao_gia',
                  label: 'Báo giá',
                  targetSection: 'SECONDARY',
                  colSpan: 6,
                },
                {
                  id: 'it_reason',
                  kind: 'field',
                  fieldKey: 'ly_do',
                  colSpan: 6,
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

    expect(() => validateFormStructure(baseFields(), layout)).not.toThrow();
  });

  it('TC-FRM-U02: rejects row when sum of colSpan exceeds 12 (ROW_COLSPAN_EXCEEDED)', () => {
    const layout: LayoutSchemaV1 = {
      schemaVersion: 1,
      sections: [
        {
          id: 'sec_1',
          title: 'S1',
          rows: [
            {
              id: 'row_1',
              items: [
                { id: 'it_1', kind: 'field', fieldKey: 'loai_mua_sam', colSpan: 8 },
                { id: 'it_2', kind: 'field', fieldKey: 'tong_gia_tri', colSpan: 6 },
              ],
            },
          ],
        },
      ],
    };

    try {
      validateFormStructure(baseFields(), layout);
      fail('Expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        details: Array<{ code: string }>;
      };
      expect(body.details.some((d) => d.code === 'ROW_COLSPAN_EXCEEDED')).toBe(true);
    }
  });

  it('TC-FRM-U03: rejects unknown or duplicate fieldKey references in layoutSchema', () => {
    const layout: LayoutSchemaV1 = {
      schemaVersion: 1,
      sections: [
        {
          id: 'sec_1',
          title: 'S1',
          rows: [
            {
              id: 'row_1',
              items: [
                { id: 'it_1', kind: 'field', fieldKey: 'loai_mua_sam', colSpan: 6 },
                { id: 'it_2', kind: 'field', fieldKey: 'loai_mua_sam', colSpan: 6 },
              ],
            },
            {
              id: 'row_2',
              items: [
                { id: 'it_3', kind: 'field', fieldKey: 'non_existent', colSpan: 12 },
              ],
            },
          ],
        },
      ],
    };

    try {
      validateFormStructure(baseFields(), layout);
      fail('Expected BadRequestException');
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as {
        details: Array<{ code: string }>;
      };
      const codes = body.details.map((d) => d.code);
      expect(codes).toContain('DUPLICATE_LAYOUT_FIELD');
      expect(codes).toContain('UNKNOWN_LAYOUT_FIELD');
    }
  });

  it('TC-FRM-U04: rejects circular visibleWhen dependencies (LAYOUT_VISIBILITY_CYCLE)', () => {
    const layout: LayoutSchemaV1 = {
      schemaVersion: 1,
      sections: [
        {
          id: 'sec_1',
          title: 'S1',
          rows: [
            {
              id: 'row_1',
              items: [
                {
                  id: 'it_1',
                  kind: 'field',
                  fieldKey: 'loai_mua_sam',
                  colSpan: 6,
                  visibleWhen: {
                    mode: 'all',
                    rules: [{ fieldKey: 'ly_do', op: 'notEmpty' }],
                  },
                },
                {
                  id: 'it_2',
                  kind: 'field',
                  fieldKey: 'ly_do',
                  colSpan: 6,
                  visibleWhen: {
                    mode: 'all',
                    rules: [{ fieldKey: 'loai_mua_sam', op: 'eq', value: 'THIET_BI' }],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    try {
      validateFormStructure(baseFields(), layout);
      fail('Expected BadRequestException');
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as {
        details: Array<{ code: string }>;
      };
      expect(body.details.some((d) => d.code === 'LAYOUT_VISIBILITY_CYCLE')).toBe(true);
    }
  });

  it('TC-FRM-U05: rejects TABLE aggregate targetFieldKey pointing to a non-NUMBER field', () => {
    const fields = baseFields();
    fields[1] = {
      ...fields[1],
      tableConfig: {
        columns: [
          { key: 'thanh_tien', label: 'Thành tiền', type: 'NUMBER', required: true },
        ],
        summary: {
          aggregates: [
            { columnKey: 'thanh_tien', op: 'SUM', targetFieldKey: 'ly_do' },
          ],
        },
      },
    };

    try {
      validateFormStructure(fields, null);
      fail('Expected BadRequestException');
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as {
        details: Array<{ code: string }>;
      };
      expect(body.details.some((d) => d.code === 'INVALID_AGGREGATE_TARGET')).toBe(true);
    }
  });

  it('normalizes legacy null layoutSchema and appends orphan fields safely', () => {
    const fallback = normalizeLayoutSchema('Legacy', [{ key: 'a' }, { key: 'b' }], null);
    expect(fallback.sections).toHaveLength(1);
    expect(fallback.sections[0].rows).toHaveLength(2);
    expect(fallback.sections[0].rows[0].items[0]).toMatchObject({
      kind: 'field',
      fieldKey: 'a',
      colSpan: 12,
    });
  });
});

