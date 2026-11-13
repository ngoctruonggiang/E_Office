# Kế hoạch Kiểm thử (Test Plan) — Module Thủ tục (Procedure Module)

**Mã tài liệu:** `SPEC-PRC-TEST-01`  
**Thuộc Phase:** `Phase 4 — Lớp Cầu nối Procedure`  
**Trạng thái:** `PENDING_REVIEW`  
**Ngày lập:** 13/11/2026  
**Tác giả:** Google DeepMind / Antigravity Agent  
**Liên kết yêu cầu:** `REQ-PRC-01`, `REQ-PRC-02` (Xem [`04-traceability-matrix.md`](../../00-overview/04-traceability-matrix.md))  

---

## 1. Mục tiêu & Phạm vi Kiểm thử

1. **Kiểm tra Tính toàn vẹn Dữ liệu (Data Integrity):** Đảm bảo quan hệ khóa ngoại giữa `Procedure`, `ProcedureVersion`, `FormVersion`, `ProcedureActorMapping` và `ProcedureVariableMapping` được lưu trữ chính xác, có cascade delete hợp lý cho các phiên bản nháp.
2. **Kiểm thử Động cơ Thẩm định (Validation Engine):** Thử nghiệm toàn bộ 9 quy tắc kiểm tra (`VAL-PRC-01` đến `VAL-PRC-09`) trong cả trường hợp dữ liệu hợp lệ và trường hợp thiếu sót.
3. **Kiểm tra Cơ chế Ghim Phiên bản (Version Pinning — ADR-005):** Kiểm tra tính bất biến của phiên bản khi đã chuyển sang `PUBLISHED`, và quy trình tạo phiên bản nháp kế tiếp không làm thay đổi phiên bản cũ.
4. **Kiểm thử Tích hợp API (E2E Integration):** Mô phỏng chu trình hoàn chỉnh từ tạo Thủ tục &rarr; Chọn Form & Workflow Operaton &rarr; Cấu hình Mapping &rarr; Thẩm định &rarr; Xuất bản.

---

## 2. Ma trận Ca kiểm thử (Test Matrix)

### 2.1. Backend Unit Tests (`procedure.service.spec.ts` & `procedure-validation.service.spec.ts`)

| Mã Test Case | Hạng mục kiểm thử | Dữ liệu đầu vào / Điều kiện | Kết quả mong đợi |
|---|---|---|---|
| `TC-PRC-U01` | Tạo mới Procedure | Dữ liệu hợp lệ: `code="PROC_TEST_01"`, `name="Thủ tục Test"` | Tạo thành công `Procedure` và tự động sinh `ProcedureVersion 1` ở trạng thái `DRAFT`. |
| `TC-PRC-U02` | Trùng mã `code` | Tạo Procedure với `code` đã tồn tại | Ném lỗi `ConflictException` (HTTP 409). |
| `TC-PRC-U03` | Cập nhật cấu hình Draft | Gửi payload mapping gồm 4 actors và 1 variable vào version nháp | Cập nhật thành công các bản ghi `ProcedureActorMapping` và `ProcedureVariableMapping`. |
| `TC-PRC-U04` | Cấm sửa bản đã Publish | Gửi lệnh `PUT /versions/:id` vào version có status `PUBLISHED` | Ném lỗi `ForbiddenException` (HTTP 403) từ chối sửa đổi. |
| `TC-PRC-U05` | Thẩm định: Thiếu biến BPMN | Workflow có `var_amount` nhưng bảng variableMappings không map | `validate()` trả về `isValid: false`, lỗi `VAL-PRC-03`. |
| `TC-PRC-U06` | Thẩm định: Sai trường Form | Map `var_amount` vào một `formFieldKey` không có trong Form | `validate()` trả về `isValid: false`, lỗi `VAL-PRC-04`. |
| `TC-PRC-U07` | Thẩm định: Bước cố định thiếu User | Bước có `allowOverride: false` nhưng `defaultUserId` là `null` | `validate()` trả về `isValid: false`, lỗi `VAL-PRC-07`. |
| `TC-PRC-U08` | Thẩm định: User bị vô hiệu | `defaultUserId` trỏ vào tài khoản có `isActive: false` | `validate()` trả về `isValid: false`, lỗi `VAL-PRC-08`. |
| `TC-PRC-U09` | Thẩm định: Thành công 100% | Đầy đủ mapping, biến đúng kiểu, actor hợp lệ | `validate()` trả về `isValid: true`, `errors: []`. |
| `TC-PRC-U10` | Tạo Draft mới từ bản cũ | Gọi `createDraft(procedureId)` khi đã có bản version 1 `PUBLISHED` | Sinh `ProcedureVersion 2 (DRAFT)`, sao chép toàn bộ mapping của version 1 sang để chỉnh sửa tiện lợi. |

---

### 2.2. Backend E2E Tests (`test/procedure.e2e-spec.ts`)

Bộ kiểm thử E2E sử dụng Supertest gọi trực tiếp qua HTTP REST API với cơ sở dữ liệu thật và Operaton Engine container:

| Mã Test Case | Kịch bản E2E | Các bước thực hiện | Kết quả mong đợi |
|---|---|---|---|
| `TC-PRC-E01` | Vòng đời Tạo & Lưu nháp | 1. `POST /api/v1/procedures`<br>2. `GET /api/v1/procedures/versions/:vId`<br>3. `PUT /api/v1/procedures/versions/:vId` | Bản nháp được lưu trữ đầy đủ với mã HTTP 200/201. |
| `TC-PRC-E02` | Thẩm định thất bại khi nộp thiếu | Gọi `POST /api/v1/procedures/versions/:vId/publish` khi chưa map biến | Trả về HTTP 422 Unprocessable Entity kèm mảng `errors`. Trạng thái vẫn là `DRAFT`. |
| `TC-PRC-E03` | Xuất bản thành công với `FLOW 1` | 1. Ghép với FormVersion tạo ở Phase 2<br>2. Ghép với `FLOW 1` deploy ở Phase 3<br>3. Map `var_amount` vào trường số tiền<br>4. Gán 4 user duyệt hợp lệ<br>5. Bấm `publish` | Trả về HTTP 200 OK. `status` chuyển thành `PUBLISHED`, `Procedure.activeVersionId` được trỏ vào version này. |
| `TC-PRC-E04` | Thử nghiệm Version Pinning | 1. Publish Version 1<br>2. Tạo Draft Version 2<br>3. Sửa mapping trên Version 2<br>4. Lấy lại Version 1 | Version 1 giữ nguyên 100% cấu hình ban đầu, không bị ảnh hưởng bởi thay đổi trên Version 2. |
| `TC-PRC-E05` | Danh bạ Helper Directory | Gọi `GET /api/v1/procedures/helpers/directory` | Trả về danh sách User có đầy đủ các trường `displayName`, `department`, `title`, `signatureImage`. |

---

### 2.3. Frontend Lint & Build Verification

- **Lint:** `npx eslint "features/procedure" "app/(main)/procedures"`: Đạt `0 errors`, `0 warnings`.
- **Next.js Production Build:** `npm --prefix frontend run build`: Đạt compile thành công toàn bộ các routes.
- **Traceability:** Cập nhật bảng [04-traceability-matrix.md](../../00-overview/04-traceability-matrix.md) chuyển `REQ-PRC-01` và `REQ-PRC-02` từ `DRAFT` &rarr; `SPEC_READY` (sẵn sàng chờ duyệt để vào Lượt B).

