# Phase 2 Layout Schema Specification (`LayoutSchemaV1`)

**Trạng thái:** `APPROVED` (Phase 2 — đã duyệt để code Lượt B)  
**Requirement IDs:** `REQ-FRM-01`, `REQ-FRM-02`  
**ADRs liên quan:** [ADR-001](../../00-overview/adr/ADR-001-form-layout-json.md)

Tài liệu này định nghĩa đặc tả chính thức cho cấu trúc JSON `FormVersion.layoutSchema`, cấu trúc `FormField.tableConfig`, thuật toán đánh giá điều kiện hiển thị (`visibleWhen`), và thuật toán chuẩn hóa fallback khi `layoutSchema` là `null`. Cả Backend (`backend/src/modules/form-builder/` + `request/`) và Frontend (`frontend/features/forms/`) **PHẢI** tuân thủ chính xác các kiểu và quy tắc bên dưới.

---

## 1. Cấu trúc TypeScript Contract cho `LayoutSchemaV1`

```ts
export interface LayoutSchemaV1 {
  schemaVersion: 1;
  settings?: {
    columns?: 12; // Mặc định 12 (Grid 12 cột chuẩn)
    labelPlacement?: 'top' | 'left'; // Mặc định 'top'
    showSectionNumbers?: boolean; // Mặc định true (hiển thị "1. ...", "2. ...")
  };
  sections: LayoutSection[];
}

export interface LayoutSection {
  id: string; // Ví dụ: "sec_general", độ dài 1..64, [a-zA-Z0-9_-]
  title: string; // Tiêu đề section, tối đa 150 ký tự
  description?: string; // Mô tả ngắn bên dưới tiêu đề section
  collapsible?: boolean; // Mặc định false
  defaultCollapsed?: boolean; // Mặc định false
  visibleWhen?: VisibilityRuleGroup;
  rows: LayoutRow[];
}

export interface LayoutRow {
  id: string; // Ví dụ: "row_1"
  items: LayoutItem[]; // Tổng colSpan trong 1 row PHẢI <= 12
}

export type LayoutItem =
  | LayoutFieldItem
  | LayoutHeadingItem
  | LayoutDividerItem
  | LayoutAttachmentSlotItem;

export interface LayoutFieldItem {
  id: string;
  kind: 'field';
  fieldKey: string; // Phải khớp 1 FormField.key trong cùng FormVersion
  colSpan: number; // Số nguyên 1..12 (UI Builder cung cấp preset: 3, 4, 6, 8, 12)
  helpText?: string; // Chú thích bổ sung riêng cho ngữ cảnh hiển thị của trường
  readOnly?: boolean; // Khóa sửa trực tiếp (VD: trường nhận tổng SUM từ TABLE)
  visibleWhen?: VisibilityRuleGroup;
}

export interface LayoutHeadingItem {
  id: string;
  kind: 'heading';
  text: string; // Tối đa 200 ký tự
  subtitle?: string; // Tối đa 500 ký tự
  colSpan: number; // Mặc định 12 (1..12)
  visibleWhen?: VisibilityRuleGroup;
}

export interface LayoutDividerItem {
  id: string;
  kind: 'divider';
  colSpan: number; // Mặc định 12 (1..12)
  visibleWhen?: VisibilityRuleGroup;
}

export interface LayoutAttachmentSlotItem {
  id: string;
  kind: 'attachmentSlot';
  slotKey: string; // Định danh gợi ý slot, VD: "bao_gia_ncc"
  label: string; // Nhãn hiển thị, VD: "Bảng báo giá nhà cung cấp (PDF)"
  description?: string; // Hướng dẫn cho người trình
  targetSection: 'MAIN' | 'SECONDARY'; // Khớp enum RequestDocSection trong request_form.prisma
  required?: boolean; // Nhắc UI cảnh báo nếu bước đính kèm chưa có file ở mục tương ứng
  acceptMimeTypes?: string[]; // Gợi ý lọc định dạng file trên UI, VD: ["application/pdf"]
  colSpan: number; // 6 hoặc 12 (1..12)
  visibleWhen?: VisibilityRuleGroup;
}
```

### Ràng buộc cấu trúc `LayoutSchemaV1`
1. `schemaVersion` bắt buộc bằng `1`.
2. Mọi `section.id`, `row.id`, `item.id` không rỗng và duy nhất trong toàn `layoutSchema`.
3. Một `fieldKey` chỉ được tham chiếu tối đa **1 lần** bởi `LayoutFieldItem` trong cùng `layoutSchema`.
4. Mọi `LayoutFieldItem.fieldKey` phải tồn tại trong danh sách `fields` của `FormVersion`.
5. Trong một `LayoutRow`, tổng `items.reduce((sum, item) => sum + item.colSpan, 0)` phải nằm trong `1..12`.
6. Nếu một `FormField` thuộc `fields` không được đặt vào `layoutSchema` (orphan field, ví dụ khi gọi API cập nhật chỉ thêm field mới mà không sửa layout): Frontend/normalizer tự gắn vào section fallback ở cuối để không ẩn mất trường nhập. Tuy nhiên khi lưu từ `FormBuilderScreen`, UI luôn đặt tất cả field vào `layoutSchema`.

---

## 2. Đặc tả Điều kiện Ẩn/Hiện (`VisibilityRuleGroup`)

```ts
export type VisibilityOperator =
  | 'eq'       // Bằng (==)
  | 'neq'      // Khác (!=)
  | 'in'       // Thuộc tập giá trị (cho SELECT SINGLE hoặc mảng)
  | 'notIn'    // Không thuộc tập giá trị
  | 'gt'       // Lớn hơn (>)
  | 'gte'      // Lớn hơn hoặc bằng (>=)
  | 'lt'       // Nhỏ hơn (<)
  | 'lte'      // Nhỏ hơn hoặc bằng (<=)
  | 'contains' // Chuỗi chứa substring hoặc mảng SELECT MULTIPLE chứa value
  | 'empty'    // Rỗng: undefined, null, "", hoặc []
  | 'notEmpty';// Có giá trị khác rỗng

export interface VisibilityCondition {
  fieldKey: string; // Phải tồn tại trong FormVersion.fields
  op: VisibilityOperator;
  value?: string | number | boolean | Array<string | number>; // Bắt buộc trừ 'empty' | 'notEmpty'
}

export interface VisibilityRuleGroup {
  mode: 'all' | 'any'; // 'all' = AND tất cả rules, 'any' = OR ít nhất 1 rule
  rules: VisibilityCondition[]; // Tối thiểu 1 rule nếu visibleWhen được khai báo
}
```

### 2.1. Thuật toán đánh giá (`evaluateVisibility`)
Cho map giá trị hiện tại `values: Record<string, unknown>`:

1. Nếu `visibleWhen == null` hoặc `visibleWhen.rules.length === 0` -> trả `true`.
2. Đánh giá từng `rule` trong `visibleWhen.rules` với `actual = values[rule.fieldKey]`:
   - `isEmpty(v)`: `v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)`.
   - `empty`: trả `isEmpty(actual)`.
   - `notEmpty`: trả `!isEmpty(actual)`.
   - `eq` / `neq`:
     - Nếu `actual` là `number` hoặc `rule.value` là `number`: so sánh theo `Number(actual) === Number(rule.value)` (khi cả hai convert ra số hữu hạn và `actual` không phải rỗng).
     - Ngược lại so sánh chuỗi chuẩn hóa `String(actual ?? '') === String(rule.value ?? '')` (trường hợp `actual` là `undefined`/`null` với `neq` trả `rule.value != null`).
   - `in` / `notIn`: yêu cầu `Array.isArray(rule.value)`. Nếu `Array.isArray(actual)` (`SELECT MULTIPLE`): `in` đúng khi có ít nhất 1 phần tử của `actual` nằm trong `rule.value`; nếu `actual` là giá trị đơn: kiểm tra `rule.value.map(String).includes(String(actual))` (khi `!isEmpty(actual)`). `notIn` là phủ định của `in` (nếu `isEmpty(actual)`, `notIn` trả `true`).
   - `gt` / `gte` / `lt` / `lte`:
     - Nếu `isEmpty(actual)` -> trả `false`.
     - Parse `a = Number(actual)`, `b = Number(rule.value)`. Nếu `!Number.isFinite(a) || !Number.isFinite(b)` -> trả `false`.
     - So sánh tương ứng `a > b`, `a >= b`, `a < b`, `a <= b`.
   - `contains`:
     - Nếu `isEmpty(actual)` -> trả `false`.
     - Nếu `Array.isArray(actual)` -> `actual.map(String).includes(String(rule.value ?? ''))`.
     - Ngược lại -> `String(actual).toLowerCase().includes(String(rule.value ?? '').toLowerCase())`.
3. Tổng hợp nhóm:
   - `mode === 'all'`: `results.every(Boolean)`.
   - `mode === 'any'`: `results.some(Boolean)`.

### 2.2. Quy tắc kế thừa & chống vòng lặp
- **Kế thừa từ Section:** Một item bên trong `section` chỉ được coi là **visible** khi `isVisible(section.visibleWhen) && isVisible(item.visibleWhen)`.
- **Phụ thuộc dây chuyền & Cycle Detection:** Trường A có thể phụ thuộc trường B (`A -> B`), nhưng đồ thị phụ thuộc (`fieldKey` phụ thuộc -> `rule.fieldKey`) **KHÔNG ĐƯỢC CÓ CHU TRÌNH** (ví dụ `A -> B -> A` hoặc `A -> A`). Cả Backend DTO/Service validator lẫn Frontend Form Builder đều kiểm tra DAG trước khi lưu; nếu phát hiện chu trình -> trả `400 Bad Request` (`LAYOUT_VISIBILITY_CYCLE`).
- **Hành vi khi trường bị ẩn:**
  - Trong khi user nhập trên UI: giữ nguyên giá trị tạm trong state bộ nhớ để tránh mất dữ liệu khi user lỡ bấm nhầm rồi bật lại.
  - Khi **Submit / Tạo đơn / Lưu Request**: các field đang ở trạng thái **ẩn** được **bỏ qua validate `required` + format**, và **bị loại bỏ khỏi danh sách `values` gửi lên / lưu xuống `FormResponseValue`** để dữ liệu DB và biến gửi Operaton (Phase 4–5) luôn sạch, không chứa dữ liệu mâu thuẫn.

---

## 3. Đặc tả Trường Bảng Con (`FieldType.TABLE` & `TableFieldConfig`)

Lưu trong `FormField.tableConfig` (`Json?`):

```ts
export type TableColumnType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';

export interface TableColumnDef {
  key: string; // Duy nhất trong bảng, regex: /^[a-zA-Z0-9_]+$/
  label: string; // Tiêu đề cột
  type: TableColumnType;
  width?: number; // Độ rộng gợi ý theo px hoặc % (optional, mặc định auto)
  required?: boolean; // Bắt buộc nhập trên mỗi dòng
  placeholder?: string;
  maxLength?: number; // Cho TEXT (mặc định 250)
  min?: number; // Cho NUMBER
  max?: number; // Cho NUMBER
  options?: Array<{ label: string; value: string }>; // Bắt buộc nếu type === 'SELECT'
}

export interface TableAggregateRule {
  columnKey: string; // Phải tồn tại trong columns; 'SUM' yêu cầu column.type === 'NUMBER'
  op: 'SUM' | 'COUNT';
  targetFieldKey?: string; // Nếu có: phải trỏ tới 1 FormField kiểu NUMBER trong cùng FormVersion
}

export interface TableFieldConfig {
  columns: TableColumnDef[]; // Tối thiểu 1 cột, khuyến nghị tối đa 10 cột
  minRows?: number; // Mặc định 0 (nếu field.required = true và minRows không set -> coi như tối thiểu 1 dòng)
  maxRows?: number; // Mặc định 50, tối đa cho phép hệ thống: 200
  addRowLabel?: string; // Nhãn nút thêm dòng, VD: "Thêm hạng mục"
  showRowNumber?: boolean; // Mặc định true (hiện cột STT)
  summary?: {
    label?: string; // Nhãn dòng tổng cuối bảng, VD: "Tổng cộng"
    aggregates: TableAggregateRule[];
  };
}
```

### Quy tắc tính Aggregate cho `TABLE`
- Với `op === 'SUM'`: cộng tất cả các dòng có `Number(row[columnKey])` hữu hạn; nếu bảng rỗng trả `0`.
- Với `op === 'COUNT'`: đếm số dòng hiện có (hoặc số dòng có giá trị khác rỗng tại `columnKey` nếu muốn; chuẩn thống nhất: đếm số dòng mà `row[columnKey]` không rỗng `!= null && !== ""`).
- Nếu `targetFieldKey` được cấu hình:
  - Khi người dùng thêm/sửa/xóa dòng trong `TABLE`, Frontend tự động ghi kết quả aggregate vào `values[targetFieldKey]`, đồng thời đánh dấu trường `targetFieldKey` là read-only trên UI.
  - Ở Backend khi submit `POST /requests` hoặc `POST /requests/:id/submit`, nếu trường `TABLE` đang visible và có `targetFieldKey` cũng đang visible, server tính lại aggregate và tự động đồng bộ/kiểm tra `values[targetFieldKey]`.

---

## 4. Thuật toán Chuẩn hóa Fallback (`normalizeLayoutSchema`)

Dùng chung cho cả form cũ (`layoutSchema == null`) và trường hợp bảo vệ orphan fields:

```ts
function normalizeLayoutSchema(
  formName: string,
  fields: Array<{ key: string }>,
  layoutSchema: LayoutSchemaV1 | null | undefined,
): LayoutSchemaV1 {
  if (!layoutSchema) {
    return {
      schemaVersion: 1,
      settings: { columns: 12, labelPlacement: 'top', showSectionNumbers: false },
      sections: [
        {
          id: 'sec_default',
          title: formName || 'Thông tin biểu mẫu',
          rows: fields.map((f, idx) => ({
            id: `row_auto_${idx}`,
            items: [
              {
                id: `item_auto_${f.key}`,
                kind: 'field',
                fieldKey: f.key,
                colSpan: 12,
              },
            ],
          })),
        },
      ],
    };
  }

  // Giữ layout hiện có, kiểm tra orphan fields (field có trong DB nhưng chưa nằm trong layout)
  const placedKeys = new Set<string>();
  for (const sec of layoutSchema.sections) {
    for (const row of sec.rows) {
      for (const item of row.items) {
        if (item.kind === 'field') placedKeys.add(item.fieldKey);
      }
    }
  }
  const orphans = fields.filter((f) => !placedKeys.has(f.key));
  if (orphans.length === 0) return layoutSchema;

  return {
    ...layoutSchema,
    sections: [
      ...layoutSchema.sections,
      {
        id: 'sec_unassigned',
        title: 'Thông tin bổ sung',
        rows: orphans.map((f, idx) => ({
          id: `row_orphan_${idx}`,
          items: [
            {
              id: `item_orphan_${f.key}`,
              kind: 'field',
              fieldKey: f.key,
              colSpan: 12,
            },
          ],
        })),
      },
    ],
  };
}
```

---

## 5. Ví dụ JSON thực tế hoàn chỉnh: "Biểu mẫu Đề nghị mua sắm"

Dưới đây là một payload hoàn chỉnh khớp cả `fields` lẫn `layoutSchema` dùng cho kiểm thử E2E & Seed mẫu:

```json
{
  "name": "Đề nghị mua sắm vật tư / thiết bị",
  "fields": [
    {
      "key": "loai_mua_sam",
      "label": "Loại mua sắm",
      "type": "SELECT",
      "required": true,
      "selectMode": "SINGLE",
      "options": [
        { "label": "Vật tư văn phòng", "value": "VAN_PHONG" },
        { "label": "Thiết bị CNTT / Máy móc", "value": "THIET_BI" }
      ]
    },
    {
      "key": "ngay_can_hang",
      "label": "Ngày cần hàng",
      "type": "DATE",
      "required": true
    },
    {
      "key": "bo_phan_su_dung",
      "label": "Bộ phận sử dụng",
      "type": "TEXT",
      "required": true,
      "maxLength": 150,
      "placeholder": "VD: Phòng Sản xuất"
    },
    {
      "key": "hang_muc_mua",
      "label": "Chi tiết hạng mục đề xuất",
      "type": "TABLE",
      "required": true,
      "tableConfig": {
        "showRowNumber": true,
        "minRows": 1,
        "maxRows": 50,
        "addRowLabel": "Thêm hạng mục",
        "columns": [
          { "key": "ten_hang", "label": "Tên hàng hóa / dịch vụ", "type": "TEXT", "required": true, "maxLength": 200 },
          { "key": "so_luong", "label": "Số lượng", "type": "NUMBER", "required": true, "min": 1 },
          { "key": "thanh_tien", "label": "Thành tiền (VNĐ)", "type": "NUMBER", "required": true, "min": 0 }
        ],
        "summary": {
          "label": "Tổng giá trị đề xuất",
          "aggregates": [
            { "columnKey": "thanh_tien", "op": "SUM", "targetFieldKey": "tong_gia_tri" }
          ]
        }
      }
    },
    {
      "key": "tong_gia_tri",
      "label": "Tổng giá trị (VNĐ)",
      "type": "NUMBER",
      "required": true,
      "min": 0
    },
    {
      "key": "ly_do_mua_thiet_bi",
      "label": "Giải trình kỹ thuật / Vượt định mức",
      "type": "TEXT",
      "required": true,
      "maxLength": 500,
      "placeholder": "Bắt buộc giải trình khi mua thiết bị hoặc giá trị >= 50.000.000 VNĐ"
    }
  ],
  "layoutSchema": {
    "schemaVersion": 1,
    "settings": { "columns": 12, "labelPlacement": "top", "showSectionNumbers": true },
    "sections": [
      {
        "id": "sec_info",
        "title": "Thông tin chung",
        "description": "Điền thông tin phân loại và thời hạn cung ứng",
        "rows": [
          {
            "id": "row_1",
            "items": [
              { "id": "it_1", "kind": "field", "fieldKey": "loai_mua_sam", "colSpan": 4 },
              { "id": "it_2", "kind": "field", "fieldKey": "ngay_can_hang", "colSpan": 4 },
              { "id": "it_3", "kind": "field", "fieldKey": "bo_phan_su_dung", "colSpan": 4 }
            ]
          }
        ]
      },
      {
        "id": "sec_items",
        "title": "Danh sách hạng mục & Giá trị",
        "rows": [
          {
            "id": "row_2",
            "items": [
              { "id": "it_4", "kind": "field", "fieldKey": "hang_muc_mua", "colSpan": 12 }
            ]
          },
          {
            "id": "row_3",
            "items": [
              {
                "id": "it_5",
                "kind": "field",
                "fieldKey": "tong_gia_tri",
                "colSpan": 6,
                "readOnly": true,
                "helpText": "Tự động tổng hợp từ cột Thành tiền"
              },
              {
                "id": "it_slot_baogia",
                "kind": "attachmentSlot",
                "slotKey": "bao_gia_ncc",
                "label": "Báo giá nhà cung cấp (PDF)",
                "description": "Đính kèm vào mục Tài liệu phụ nếu tổng giá trị >= 50.000.000 VNĐ",
                "targetSection": "SECONDARY",
                "required": true,
                "acceptMimeTypes": ["application/pdf"],
                "colSpan": 6,
                "visibleWhen": {
                  "mode": "all",
                  "rules": [{ "fieldKey": "tong_gia_tri", "op": "gte", "value": 50000000 }]
                }
              }
            ]
          },
          {
            "id": "row_4",
            "items": [
              {
                "id": "it_6",
                "kind": "field",
                "fieldKey": "ly_do_mua_thiet_bi",
                "colSpan": 12,
                "visibleWhen": {
                  "mode": "any",
                  "rules": [
                    { "fieldKey": "loai_mua_sam", "op": "eq", "value": "THIET_BI" },
                    { "fieldKey": "tong_gia_tri", "op": "gte", "value": 50000000 }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

