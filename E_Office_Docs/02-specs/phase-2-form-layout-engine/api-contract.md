# Phase 2 API Contract — Form Builder & Request Value Validation

**Trạng thái:** `APPROVED` (Phase 2 — đã duyệt để code Lượt B)  
**Requirement IDs:** `REQ-FRM-01`, `REQ-FRM-02`  
**ADRs liên quan:** [ADR-001](../../00-overview/adr/ADR-001-form-layout-json.md), [ADR-005](../../00-overview/adr/ADR-005-version-pinning.md)

---

## 1. Bảo mật & Guards

Tất cả endpoint dưới đây kế thừa cấu hình xác thực hiện hành của ứng dụng (`JwtAuthGuard` + `@ApiBearerAuth()`). Trả về `401 Unauthorized` nếu thiếu hoặc token không hợp lệ.

- **Form Builder endpoints (`/forms/**`)**: giữ nguyên cơ chế phân quyền hiện hành của `FormBuilderController` (authenticated users tạo/xem form; `createdById` ghi từ `@CurrentUser()`).
- **Request endpoints (`/requests/**`)**: giữ nguyên cơ chế ownership của `RequestController` (chỉ `createdById` được sửa `DRAFT` hoặc gọi `POST /requests/:id/submit`; người liên quan được xem `GET /requests/:id`).

---

## 2. Danh sách Endpoints (`FormBuilderModule`)

| Method | Path | Mục đích | Thay đổi ở Phase 2 |
|---|---|---|---|
| `GET` | `/forms` | Danh sách form có phân trang (`?name=&page=&limit=`) | Giữ nguyên `Paginated<FormSummaryDto>` |
| `POST` | `/forms` | Tạo biểu mẫu mới (`v1`) | Thêm `layoutSchema?` và `fields[].tableConfig?` |
| `PATCH` | `/forms/:id` | Cập nhật biểu mẫu (in-place hoặc fork version mới) | Hỗ trợ `layoutSchema?`, `tableConfig?` và Version Fork Policy mới |
| `GET` | `/forms/:id` | Lấy định nghĩa **phiên bản mới nhất** | Response `FormDetailDto` có thêm `layoutSchema` & `fields[].tableConfig` |
| **`GET`** | **`/forms/versions/:versionId`** | **MỚI — Lấy đúng định nghĩa của một `FormVersion` lịch sử** | Bắt buộc đặt route **trước `@Get(':id')`** trong `FormBuilderController` để không bị `:id` nuốt |
| `POST` | `/forms/:id/fields/:fieldId/options` | Thêm nhanh option cho trường `SELECT` | Giữ nguyên |

---

## 3. Chi tiết Request / Response DTO (`FormBuilderModule`)

### 3.1. `CreateFormDto` & `UpdateFormDto`

- `CreateFormDto`:
  - `name: string` (`@IsString()`, `@MinLength(1)`, `@MaxLength(150)`)
  - `fields: FormFieldInput[]` (`@IsArray()`, `@ValidateNested({ each: true })`)
  - `layoutSchema?: LayoutSchemaDto | null` (`@IsOptional()`, `@ValidateNested()`)
- `UpdateFormDto`:
  - `name?: string` (`@IsOptional()`, `@IsString()`, `@MinLength(1)`, `@MaxLength(150)`)
  - `fields?: FormFieldInput[]` (`@IsOptional()`, `@IsArray()`, `@ValidateNested({ each: true })`)
  - `layoutSchema?: LayoutSchemaDto | null` (`@IsOptional()`, `@ValidateNested()` — cho phép gửi `null` để reset về auto-layout hoặc gửi object `LayoutSchemaV1`)
- `FormFieldInput` mở rộng:
  - Giữ nguyên: `key`, `label`, `type: FieldType` (nay gồm `TEXT | DATE | NUMBER | SELECT | TABLE`), `required?`, `defaultValue?`, `maxLength?`, `placeholder?`, `min?`, `max?`, `selectMode?`, `options?`, `validations?`.
  - Bổ sung: `tableConfig?: TableFieldConfigDto | null` (chỉ hợp lệ khi `type === FieldType.TABLE`).

### 3.2. Validate nghiệp vụ cho `FormBuilderService` (`createForm` / `updateForm`)

Ngoài `class-validator`, `LayoutValidator` trong `FormBuilderModule` kiểm tra toàn bộ quy tắc dưới đây; vi phạm trả về **`400 Bad Request`**:

1. **Duplicate `fieldKey`:** Trong `fields[]` không được có 2 phần tử trùng `key` (`code: DUPLICATE_FIELD_KEY`).
2. **Table Field Config:**
   - Nếu `type === TABLE`: bắt buộc có `tableConfig` với `columns.length >= 1` (`TABLE_COLUMNS_REQUIRED`), `columns` không trùng `column.key`, mỗi cột `SELECT` phải có ít nhất 1 `option`, `minRows >= 0`, `maxRows <= 200`, `minRows <= maxRows`.
   - Nếu có `tableConfig.summary.aggregates`: mỗi rule `columnKey` phải tồn tại trong `columns` (nếu `op === 'SUM'`, cột đó phải có `type === 'NUMBER'`); nếu có `targetFieldKey`, phải trỏ tới một trường trong `fields[]` có `type === FieldType.NUMBER` (`INVALID_AGGREGATE_TARGET`).
   - Nếu `type !== TABLE` mà lại truyền `tableConfig != null`: báo lỗi `TABLE_CONFIG_FORBIDDEN`.
3. **Layout Schema Validation** (khi `layoutSchema` khác `null`):
   - `schemaVersion === 1`, có ít nhất 1 `section` (`sections.length >= 1`).
   - Mọi `section.id`, `row.id`, `item.id` không trùng lặp trong cùng `layoutSchema` (`DUPLICATE_LAYOUT_ID`).
   - Mỗi `LayoutRow` có `items.length >= 1` và `sum(item.colSpan) <= 12`, từng `colSpan` trong khoảng `1..12` (`ROW_COLSPAN_EXCEEDED`).
   - Mọi `LayoutFieldItem.fieldKey` phải tồn tại trong `fields[]` (`UNKNOWN_LAYOUT_FIELD`), và mỗi `fieldKey` không được xuất hiện quá 1 lần trong `layoutSchema` (`DUPLICATE_LAYOUT_FIELD`).
   - Mọi `visibleWhen.rules[].fieldKey` (ở cấp Section hoặc Item) phải tồn tại trong `fields[]` (`UNKNOWN_VISIBILITY_FIELD`). Không cho phép đặt điều kiện phụ thuộc vào chính mình hoặc tạo chu trình `A -> B -> A` (`LAYOUT_VISIBILITY_CYCLE`).
   - Nếu `kind === 'attachmentSlot'`: `targetSection` phải thuộc `'MAIN' | 'SECONDARY'`.

### 3.3. Response `FormDetailDto` (cho `POST /forms`, `PATCH /forms/:id`, `GET /forms/:id`, `GET /forms/versions/:versionId`)

```json
{
  "id": "uuid-form",
  "name": "Đề nghị mua sắm vật tư / thiết bị",
  "version": 2,
  "versionId": "uuid-form-version-2",
  "layoutSchema": {
    "schemaVersion": 1,
    "settings": { "columns": 12, "labelPlacement": "top", "showSectionNumbers": true },
    "sections": [ ... ]
  },
  "fields": [
    {
      "id": "uuid-field-1",
      "key": "hang_muc_mua",
      "label": "Chi tiết hạng mục đề xuất",
      "type": "TABLE",
      "required": true,
      "tableConfig": {
        "showRowNumber": true,
        "minRows": 1,
        "maxRows": 50,
        "columns": [ ... ],
        "summary": { ... }
      },
      "options": [],
      "validations": []
    }
  ]
}
```
- Với form cũ chưa cấu hình layout, `layoutSchema` trả về `null` (Frontend tự gọi `normalizeLayoutSchema`).

### 3.4. Endpoint mới `GET /forms/versions/:versionId`
- **Path Params:** `versionId: string` (UUID).
- **Success `200 OK`:** trả `FormDetailDto` đúng với phiên bản `versionId` (trong đó `id` = `form.id`, `version` = `formVersion.version`, `versionId` = `formVersion.id`).
- **Errors:** `404 Not Found` (`"Form version not found"`).

---

## 4. Request Submission & Server-Side EAV Validation (`RequestModule`)

Áp dụng tại 3 điểm vào dữ liệu biểu mẫu trong `RequestService`:
- `POST /requests`:
  - Nếu `dto.submit !== false` (tức nộp luôn): thực hiện **Strict Validation** (đầy đủ `required`, kiểu dữ liệu, format, `TABLE`, đồng bộ aggregate) đối với phiên bản mới nhất của `dto.formId`.
  - Nếu `dto.submit === false` (lưu `DRAFT`): thực hiện **Draft Validation** (chỉ kiểm tra tính hợp lệ kiểu dữ liệu của các `fieldKey` có giá trị, **chưa** bắt buộc `required` để cho phép người dùng lưu nháp giữa chừng).
- `PATCH /requests/:id` (chỉnh sửa `DRAFT`):
  - Load `FormVersion` theo `request.formVersionId` (không dùng latest!). Chạy **Draft Validation** trên tập giá trị hợp nhất (`existing + dto.values`).
- `POST /requests/:id/submit` (`RequestService.submitDraft`):
  - Load `FormVersion` theo `request.formVersionId`. Chạy **Strict Validation** trên toàn bộ giá trị đã lưu của `DRAFT` trước khi khởi chạy approval flow!

### 4.1. Quy tắc Server-side `FormValueValidator`
1. **Đánh giá `visibleWhen`:**
   - Xây dựng `valueMap` từ `values` gửi lên (loại bỏ `null`/`undefined` rỗng nếu cần trước khi đánh giá).
   - Chạy `evaluateVisibility(section.visibleWhen, valueMap) && evaluateVisibility(item.visibleWhen, valueMap)` theo đúng thuật toán ở `layout-schema-spec.md`.
   - **Nếu trường bị ẩn:**
     - **Bỏ qua** toàn bộ kiểm tra `required` & format cho trường đó.
     - Tự động **loại bỏ khỏi `FormResponseValue` được lưu** khi `create` (lúc `submit !== false`) hoặc `submitDraft` để dữ liệu sạch sẽ.
2. **Kiểm tra từng kiểu trường (khi visible):**
   - `required`: khi không bị ẩn và `field.required === true`, giá trị không được `null`, `undefined`, `""`, hoặc `[]`.
   - `TEXT`: `typeof val === 'string'`, độ dài `<= field.maxLength` (mặc định 250), khớp mọi `validations` (`EMAIL`, `PHONE`, `REGEX`).
   - `NUMBER`: `typeof val === 'number' && Number.isFinite(val)`, thỏa `min`/`max` nếu khai báo.
   - `DATE`: `typeof val === 'string'` khớp định dạng ngày hợp lệ (`YYYY-MM-DD` hoặc ISO date string parse được).
   - `SELECT`:
     - `SINGLE`: `typeof val === 'string'`, nếu `field.options.length > 0` thì giá trị phải nằm trong `options[].value`.
     - `MULTIPLE`: `Array.isArray(val)`, mọi phần tử là `string` nằm trong `options[].value`.
   - `TABLE`:
     - `Array.isArray(val)`.
     - Số dòng `val.length` phải thỏa `minRows` (nếu `field.required` và `minRows` chưa set -> `>= 1`) và `<= maxRows` (mặc định 50, trần 200).
     - Mỗi dòng phải là plain object; từng cột trong `tableConfig.columns` kiểm tra `required` của cột và kiểu (`TEXT` / `NUMBER` / `DATE` / `SELECT`).
     - Nếu có `tableConfig.summary.aggregates` với `targetFieldKey` trỏ tới trường `NUMBER` đang visible: server tự tính lại kết quả và ghi/ghi đè giá trị đó vào `valueMap[targetFieldKey]` trước khi kiểm tra `min`/`max` của trường đích và lưu DB!

---

## 5. Chuẩn Format Lỗi HTTP (`400 Bad Request` / `404` / `409`)

### 5.1. Validation Error Payload (`400 Bad Request`)
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Form validation failed",
  "details": [
    {
      "fieldKey": "hang_muc_mua",
      "rowIndex": 0,
      "columnKey": "so_luong",
      "code": "MIN_VALUE",
      "message": "Số lượng phải >= 1"
    }
  ]
}
```
### 5.2. Bảng mã lỗi chuẩn hóa
| HTTP | `code` | Ngữ cảnh |
|---|---|---|
| `400` | `DUPLICATE_FIELD_KEY` | Form builder có 2 field trùng `key` |
| `400` | `UNKNOWN_LAYOUT_FIELD` / `DUPLICATE_LAYOUT_FIELD` | `layoutSchema` tham chiếu `fieldKey` không tồn tại hoặc lặp lại |
| `400` | `ROW_COLSPAN_EXCEEDED` | Một hàng trong `layoutSchema` có tổng `colSpan > 12` hoặc ngoài `1..12` |
| `400` | `LAYOUT_VISIBILITY_CYCLE` | Điều kiện `visibleWhen` tạo vòng lặp phụ thuộc |
| `400` | `INVALID_TABLE_CONFIG` | Cấu hình `TABLE` thiếu cột, trùng cột, hoặc `targetFieldKey` không phải `NUMBER` |
| `400` | `REQUIRED` / `INVALID_TYPE` / `MAX_LENGTH` / `MIN_VALUE` / `MAX_VALUE` / `INVALID_FORMAT` / `INVALID_OPTION` / `TABLE_ROW_COUNT` | Lỗi dữ liệu khi tạo/nộp Request |
| `404` | `NOT_FOUND` | Không tìm thấy Form (`GET /forms/:id`) hoặc Version (`GET /forms/versions/:versionId`) |
| `403` | `FORBIDDEN` | User không phải `createdById` cố sửa `DRAFT` request |

