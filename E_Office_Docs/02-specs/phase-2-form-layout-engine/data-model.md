# Phase 2 Data Model — Prisma Schema, Migration & Versioning Policy

**Trạng thái:** `APPROVED` (Phase 2 — đã duyệt để code Lượt B)  
**Requirement IDs:** `REQ-FRM-01`, `REQ-FRM-02`  
**ADRs liên quan:** [ADR-001](../../00-overview/adr/ADR-001-form-layout-json.md), [ADR-005](../../00-overview/adr/ADR-005-version-pinning.md)

---

## 1. Đối chiếu Schema hiện tại

Hiện tại trong `backend/prisma/schema/form.prisma`:
- `enum FieldType`: `TEXT`, `DATE`, `NUMBER`, `SELECT`.
- `model FormVersion`: `id`, `formId`, `version`, `createdAt`, `fields FormField[]`, `responses FormResponse[]`, `@@unique([formId, version])`.
- `model FormField`: `id`, `formVersionId`, `key`, `label`, `type`, `required`, `defaultValue Json?`, `maxLength Int? @default(250)`, `placeholder String?`, `min Float?`, `max Float?`, `selectMode SelectMode?`, `options FieldOption[]`, `validations FieldValidation[]`, `@@unique([formVersionId, key])`.

Trong `backend/prisma/schema/form_response.prisma`:
- `model FormResponseValue`: `id`, `responseId`, `fieldKey`, `value Json`, `@@unique([responseId, fieldKey])`.

---

## 2. Thay đổi Prisma Schema (`backend/prisma/schema/form.prisma`)

### 2.1. Bổ sung `enum FieldType`
```prisma
enum FieldType {
  TEXT
  DATE
  NUMBER
  SELECT
  TABLE
}
```

### 2.2. Cập nhật `model FormVersion`
Thêm cột `layoutSchema Json?` (nullable để tương thích 100% với mọi phiên bản cũ):
```prisma
model FormVersion {
  id           String   @id @default(uuid())
  formId       String
  version      Int
  layoutSchema Json?
  createdAt    DateTime @default(now())

  form      Form           @relation(fields: [formId], references: [id])
  fields    FormField[]
  responses FormResponse[]

  @@unique([formId, version])
}
```
- **Kiểu dữ liệu DB:** `JSONB` (PostgreSQL thông qua Prisma `Json?`).
- **Ràng buộc:** Khi `layoutSchema` khác `null`, phải tuân thủ cấu trúc `LayoutSchemaV1` quy định trong [layout-schema-spec.md](./layout-schema-spec.md).

### 2.3. Cập nhật `model FormField`
Thêm cột `tableConfig Json?` (nullable, chỉ sử dụng khi `type == FieldType.TABLE`):
```prisma
model FormField {
  id            String       @id @default(uuid())
  formVersionId String
  key           String
  label         String
  type          FieldType
  required      Boolean      @default(false)
  defaultValue  Json?
  maxLength     Int?         @default(250)
  placeholder   String?
  min           Float?
  max           Float?
  selectMode    SelectMode?
  tableConfig   Json?

  formVersion FormVersion       @relation(fields: [formVersionId], references: [id])
  options     FieldOption[]
  validations FieldValidation[]

  @@unique([formVersionId, key])
}
```
- **Lưu ý chuẩn hóa:** Với `type != FieldType.TABLE`, `tableConfig` bắt buộc là `null` khi lưu xuống DB.

---

## 3. Quy chuẩn lưu trữ trong EAV `FormResponseValue` (Không sửa bảng DB)

`backend/prisma/schema/form_response.prisma` **GIỮ NGUYÊN 100%**. Giá trị `FormResponseValue.value` (`Json`) theo từng `FieldType` được quy ước chặt chẽ như sau:

| `FieldType` | Điều kiện | Kiểu JSON lưu trong `FormResponseValue.value` | Ví dụ |
|---|---|---|---|
| `TEXT` | — | `string` | `"Mua văn phòng phẩm Q4"` |
| `DATE` | — | `string` (ISO date `YYYY-MM-DD`) | `"2026-11-15"` |
| `NUMBER` | — | `number` (finite) | `52000000` |
| `SELECT` | `selectMode = SINGLE` (hoặc `null`) | `string` (khớp `FieldOption.value`) | `"MUA_SAM"` |
| `SELECT` | `selectMode = MULTIPLE` | `string[]` (mỗi phần tử khớp `FieldOption.value`) | `["HN", "HCM"]` |
| `TABLE` | có `tableConfig.columns` | `Array<Record<string, string \| number \| null>>` | `[{"ten_hang":"Giấy A4","so_luong":10,"don_gia":85000,"thanh_tien":850000}]` |

**Lưu ý với trường tổng hợp (`summary.aggregates[].targetFieldKey`):**
- Nếu bảng `TABLE` có cấu hình đẩy tổng `SUM` hoặc `COUNT` sang một trường `NUMBER` trong cùng form (ví dụ `tong_gia_tri`), giá trị số tổng hợp đó cũng được lưu như một `FormResponseValue` bình thường dưới `fieldKey = "tong_gia_tri"`. Khi `RequestService` validate submission, server tính lại kết quả aggregate từ `TABLE` và đảm bảo giá trị `tong_gia_tri` khớp với dữ liệu bảng (tránh giả mạo từ client).

---

## 4. Chính sách Version Fork khi cập nhật Biểu mẫu (`FormBuilderService.updateForm`)

Khắc phục lỗ hổng trong `backend/src/modules/form-builder/form-builder.service.ts`, quy tắc quyết định **In-place Patch** vs **Fork New `FormVersion` (`version + 1`)** được chuẩn hóa theo bảng sau:

| Tình huống cập nhật (`PATCH /forms/:id`) | `FormVersion` hiện tại có `responses > 0`? | Hành vi bắt buộc |
|---|---|---|
| Chỉ đổi `Form.name` (không đổi `fields` và `layoutSchema`) | Bất kỳ | Cập nhật `Form.name`, **GIỮ NGUYÊN `version`** |
| Thêm `fieldKey` mới, xóa `fieldKey` cũ, đổi `type` của field, hoặc đổi cấu trúc cột `tableConfig.columns` | Bất kỳ (`0` hoặc `> 0`) | **FORK `FormVersion` mới (`version + 1`)** |
| Sửa thuộc tính scalar của field (`label`, `required`, `placeholder`, `maxLength`, `min`, `max`, `selectMode`, `options`, `validations`) hoặc sửa `layoutSchema` | **`0` responses** | **PATCH IN-PLACE** trên `FormVersion` hiện tại *(bảo toàn test case trong `backend/test/form-versioning.e2e-spec.ts`)* |
| Sửa thuộc tính của field (`label`, `required`, `options`, `validations`, `tableConfig`, ...) hoặc sửa `layoutSchema` | **`> 0` responses** | **FORK `FormVersion` mới (`version + 1`)** để đơn cũ vẫn giữ nguyên schema & layout lúc nộp (`ADR-005`) |

### Chi tiết kỹ thuật khi Patch In-Place (0 responses, giữ nguyên tập `fieldKey` & `type`)
- Cập nhật scalar props của từng `FormField` hiện có.
- Nếu DTO có truyền `options` mới cho field `SELECT` hoặc `validations` mới cho field `TEXT`: **thay thế đồng bộ** danh sách `FieldOption` / `FieldValidation` của field đó (xóa cũ, tạo mới trong cùng transaction).
- Nếu DTO có truyền `tableConfig` cho field `TABLE` (không đổi `columns` structure hoặc ở bản 0 response được phép cập nhật labels/summary): cập nhật `FormField.tableConfig`.
- Nếu DTO có truyền `layoutSchema`: cập nhật `FormVersion.layoutSchema` (`null` hoặc JSON mới).

### Chi tiết kỹ thuật khi Fork `FormVersion` mới
- Tạo `FormVersion` mới với `version = latest.version + 1` và `layoutSchema` mới (hoặc kế thừa `latest.layoutSchema` nếu DTO không gửi `layoutSchema` và tập field giữ nguyên; nếu tập field thay đổi mà DTO không gửi `layoutSchema`, đặt `layoutSchema = null` để auto-normalize hoặc prune field đã xóa nếu muốn — khuyến nghị: khi DTO `UpdateFormDto` có `layoutSchema` thì dùng `dto.layoutSchema`, nếu `dto.layoutSchema === undefined` thì giữ lại `latest.layoutSchema` đã được lọc bỏ field vừa xóa nếu có).
- Tạo đầy đủ `FormField` (bao gồm `tableConfig`, `options`, `validations`) từ payload `dto.fields` *(lưu ý: nếu client không gửi lại field cũ nào khi fork, field đó coi như bị loại khỏi version mới — khớp comment ở `form-versioning.e2e-spec.ts` dòng 80: "a new version is rebuilt from the fields supplied")*.

---

## 5. Chiến lược Migration & Dữ liệu cũ

1. **Migration SQL (Additive, Zero-Downtime):**
   - `ALTER TYPE "FieldType" ADD VALUE 'TABLE';`
   - `ALTER TABLE "FormVersion" ADD COLUMN "layoutSchema" JSONB;`
   - `ALTER TABLE "FormField" ADD COLUMN "tableConfig" JSONB;`
2. **Dữ liệu hiện có:**
   - Toàn bộ các `FormVersion` đã tạo trước Phase 2 sẽ có `layoutSchema = NULL`.
   - Không cần script backfill bắt buộc trên DB. Cả Backend và Frontend sử dụng cùng quy tắc chuẩn hóa `normalizeLayoutSchema(fields, layoutSchema)` khi đọc `layoutSchema === null` (mỗi field thành 1 row 12 cột trong 1 section mặc định).
   - Rollback an toàn: nếu cần revert code Phase 2 trước khi tạo form dùng `TABLE`, hai cột mới đều nullable nên không ảnh hưởng các phiên bản form trước.

