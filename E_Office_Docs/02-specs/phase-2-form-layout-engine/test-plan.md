# Phase 2 Test Plan — Form & Layout Engine Verification

**Trạng thái:** `APPROVED` (Phase 2 — đã duyệt để code Lượt B)  
**Requirement IDs:** `REQ-FRM-01`, `REQ-FRM-02`  
**ADRs liên quan:** [ADR-001](../../00-overview/adr/ADR-001-form-layout-json.md), [ADR-005](../../00-overview/adr/ADR-005-version-pinning.md)

---

## 1. Chiến lược Kiểm thử

Mỗi Requirement trong Phase 2 chỉ đạt trạng thái `VERIFIED` sau khi vượt qua đầy đủ 3 tầng kiểm thử:
1. **Unit Tests (Backend & Frontend pure logic):** kiểm tra toàn bộ quy tắc đánh giá điều kiện hiển thị, phát hiện chu trình DAG, validate `LayoutSchemaV1`, `TABLE` aggregate, và chuẩn hóa form cũ (`layoutSchema == null`).
2. **Backend E2E Tests (`backend/test/*.e2e-spec.ts`):** chạy trên PostgreSQL thật (không mock Prisma), bảo toàn 100% test cũ trong `form-versioning.e2e-spec.ts` và bổ sung test cho API mới + server-side validation.
3. **Frontend Build, Lint & UI Flow Check:** `eslint` + `next build` đạt 0 lỗi, cùng kiểm thử tương tác trực tiếp trên trình duyệt cho Builder, Live Preview, Create Request Wizard và RequestDetailScreen.

---

## 2. Backend Unit Test Cases (`Jest`)

| Case ID | File test dự kiến | Req ID | Mô tả & Kết quả kỳ vọng |
|---|---|---|---|
| `TC-FRM-U01` | `layout-validator.spec.ts` | `REQ-FRM-01` | `LayoutSchemaV1` hợp lệ (nhiều section, row <= 12 cột, heading, divider, attachmentSlot) -> pass không lỗi |
| `TC-FRM-U02` | `layout-validator.spec.ts` | `REQ-FRM-02` | Row có tổng `colSpan = 14` (> 12) -> throw `BadRequestException` với mã `ROW_COLSPAN_EXCEEDED` |
| `TC-FRM-U03` | `layout-validator.spec.ts` | `REQ-FRM-01` | `LayoutFieldItem` tham chiếu `fieldKey` không tồn tại hoặc lặp 2 lần cùng `fieldKey` -> throw `UNKNOWN_LAYOUT_FIELD` / `DUPLICATE_LAYOUT_FIELD` |
| `TC-FRM-U04` | `layout-validator.spec.ts` | `REQ-FRM-02` | `visibleWhen` tạo self-reference (`A -> A`) hoặc cycle 2-3 bước (`A -> B -> A`) -> throw `LAYOUT_VISIBILITY_CYCLE` |
| `TC-FRM-U05` | `layout-validator.spec.ts` | `REQ-FRM-02` | `FieldType.TABLE` có `summary.aggregates[].targetFieldKey` trỏ tới trường `TEXT` thay vì `NUMBER` -> throw `INVALID_TABLE_CONFIG` |
| `TC-FRM-U06` | `form-value-validator.spec.ts` | `REQ-FRM-02` | Đánh giá đúng đủ 11 operator (`eq`, `neq`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty`) với mode `all` và `any` |
| `TC-FRM-U07` | `form-value-validator.spec.ts` | `REQ-FRM-02` | Section hoặc Field bị ẩn bởi `visibleWhen` dù đặt `required: true` -> bỏ qua validate `required`, đồng thời lọc khỏi tập giá trị kết quả trả về để lưu DB |
| `TC-FRM-U08` | `form-value-validator.spec.ts` | `REQ-FRM-02` | Validate giá trị `TABLE`: thiếu cột `required` trong row 1 hoặc số dòng < `minRows` -> báo lỗi đúng `{ fieldKey, rowIndex, columnKey, code }` |
| `TC-FRM-U09` | `form-value-validator.spec.ts` | `REQ-FRM-02` | `TABLE` có `SUM(thanh_tien) -> targetFieldKey: "tong_gia_tri"`: server tự tính lại đúng tổng từ các dòng thay vì tin giá trị giả mạo từ client |

---

## 3. Backend E2E Test Cases (`Supertest + Postgres`)

| Case ID | File E2E | Req ID | Kịch bản & Assertion bắt buộc |
|---|---|---|---|
| `TC-FRM-E01` | `form-versioning.e2e-spec.ts` *(có sẵn)* | `REQ-FRM-01` | Toàn bộ 4 test case hiện tại (patch scalar v1 chưa có response; thêm field fork v2; đổi type fork v2; request cũ giữ `v1`, request mới theo `v2`) **PHẢI TIẾP TỤC PASS 100%** |
| `TC-FRM-E02` | `form-versioning.e2e-spec.ts` | `REQ-FRM-01`, `ADR-005` | Tạo form `v1` với `layoutSchema` v1 -> tạo Request A -> Admin sửa `layoutSchema` (đổi `colSpan`, thêm `attachmentSlot`) hoặc xóa field -> server tự fork `v2`; gọi `GET /forms/:id` trả `v2` layout mới, nhưng `GET /forms/versions/:v1Id` vẫn trả nguyên vẹn `v1` layout + fields |
| `TC-FRM-E03` | `form-versioning.e2e-spec.ts` | `REQ-FRM-01` | Form cũ (hoặc form tạo mới không gửi `layoutSchema`) -> `GET /forms/:id` trả `layoutSchema: null`, `GET /forms/versions/:versionId` trả `200 OK`, không lỗi serializer |
| `TC-FRM-E04` | `form-layout-validation.e2e-spec.ts` *(mới)* | `REQ-FRM-02` | Tạo form "Đề nghị mua sắm" (JSON mẫu mục 5 `layout-schema-spec.md`) -> `POST /requests` chọn `loai_mua_sam = "VAN_PHONG"` và bảng `hang_muc_mua` tổng = `850000` (dưới 50tr), **không gửi** `ly_do_mua_thiet_bi` (đang ẩn dù `required: true`) -> **`201 Created`**, DB lưu `tong_gia_tri = 850000` và không lưu `ly_do_mua_thiet_bi` |
| `TC-FRM-E05` | `form-layout-validation.e2e-spec.ts` | `REQ-FRM-02` | Cùng form trên: gửi bảng `hang_muc_mua` có tổng = `60000000` (>= 50tr) mà thiếu `ly_do_mua_thiet_bi` -> **`400 Bad Request`** báo thiếu `ly_do_mua_thiet_bi` |
| `TC-FRM-E06` | `form-layout-validation.e2e-spec.ts` | `REQ-FRM-02` | `POST /requests` với `submit: false` (lưu `DRAFT`) cho phép thiếu trường `required`; khi sửa `PATCH /requests/:id` hợp lệ rồi gọi `POST /requests/:id/submit` mà vẫn thiếu trường `required` đang visible -> **`400 Bad Request`** |
| `TC-FRM-E07` | `form-versioning.e2e-spec.ts` | `REQ-FRM-01` | Gọi `GET /forms/versions/00000000-0000-0000-0000-000000000000` -> **`404 Not Found`** |

---

## 4. Frontend Pure Helper & Build/UI Verification

| Case ID | Phương thức | Req ID | Kịch bản & Kết quả kỳ vọng |
|---|---|---|---|
| `TC-FRM-F01` | Helper logic / Unit | `REQ-FRM-01` | `normalizeLayoutSchema` với `layoutSchema = null` sinh đúng 1 section chứa các hàng `colSpan: 12`; nếu `fields` có field orphan chưa nằm trong `layoutSchema` -> tự ghép vào cuối section fallback |
| `TC-FRM-F02` | Helper logic / Unit | `REQ-FRM-02` | `evaluateVisibility` & `computeTableAggregates` trên Frontend cho kết quả đồng nhất 100% với Backend (`TC-FRM-U06`, `TC-FRM-U09`) |
| `TC-FRM-F03` | Static check | `REQ-FRM-01` | `npx eslint` trên toàn bộ file chạm vào ở `frontend/features/forms/` & `frontend/features/requests/` và `npm --prefix frontend run build` đạt **0 lỗi, 0 warning mới** |
| `TC-FRM-F04` | Browser UI Check | `REQ-FRM-02` | Trên `/forms/builder`: tạo 2 Section, đặt 3 trường `4/12` trên cùng 1 hàng, tạo 1 bảng `TABLE` có `SUM -> targetFieldKey`, gán `visibleWhen`, bật **Live Preview** kiểm tra ẩn/hiện & tự cộng tổng tức thì, bấm Lưu thành công |
| `TC-FRM-F05` | Browser UI Check | `REQ-FRM-01`, `REQ-FRM-02` | Tạo đơn từ form vừa tạo (v1): kiểm tra responsiveness trên desktop (grid 12 cột) & mobile (1 cột), thêm/xóa dòng `TABLE`, submit đơn -> sau đó Admin sửa form lên `v2` (thêm/xóa cột hoặc đổi layout) -> mở lại đơn v1 ở `RequestDetailScreen` xác nhận vẫn hiển thị chuẩn bố cục `v1` thông qua `GET /forms/versions/:versionId` |

