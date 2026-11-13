# Phase 2 PRD — Flexible Form & Layout Engine

**Trạng thái:** `APPROVED` (Phase 2 — đã duyệt để code Lượt B)  
**Thuộc Phase:** Phase 2 — Flexible Form & Layout Engine  
**Requirement IDs:** `REQ-FRM-01`, `REQ-FRM-02`  
**ADRs liên quan:** [ADR-001](../../00-overview/adr/ADR-001-form-layout-json.md), [ADR-005](../../00-overview/adr/ADR-005-version-pinning.md)

---

## 1. Bối cảnh & Vấn đề hiện tại

Qua rà soát code hiện hành ở Backend (`backend/prisma/schema/form.prisma`, `backend/src/modules/form-builder/`) và Frontend (`frontend/features/forms/`, `frontend/features/requests/components/RequestFormData.tsx`), hệ thống biểu mẫu hiện tại có 4 giới hạn lớn so với mục tiêu kiến trúc mới:

1. **Bố cục bị cứng theo danh sách dọc 1 cột:** `FormRenderer` chỉ render từng `FormField` xếp dọc một cột duy nhất, chưa chia **Section (nhóm thông tin)**, chưa chia **Grid nhiều cột** (ví dụ 2–3 trường ngắn trên cùng 1 hàng), chưa có tiêu đề phân khu (`Heading`), đường kẻ (`Divider`), hay nhắc vị trí đính kèm (`AttachmentSlot`).
2. **Thiếu logic biểu mẫu động:** Chưa hỗ trợ **ẩn/hiện có điều kiện (`visibleWhen`)** theo giá trị người trình đang nhập (ví dụ: chỉ hiện lý do vượt định mức khi `gia_tri >= 50.000.000`).
3. **Thiếu bảng con lặp dòng (Repeater / `TABLE`):** Nhiều phiếu nghiệp vụ thực tế (Đề nghị mua sắm, Thanh toán tạm ứng, Đề xuất công tác) cần nhập danh sách nhiều dòng hạng mục, đơn giá, số lượng, thành tiền và tự tổng hợp sang trường giá trị tổng (`var_gia_tri` cho Phase 4–5).
4. **Lỗ hổng Version Pinning & Validation:**
   - `RequestDetailDto` đã lưu `formVersionId`, nhưng `RequestFormData.tsx` lại gọi `useFormDefinition(formId)` (`GET /forms/:id`) vốn luôn trả **phiên bản mới nhất** thay vì đúng `formVersionId` của đơn lịch sử (`ADR-005`).
   - `FormBuilderService.updateForm` chỉ fork version mới khi thêm `fieldKey` hoặc đổi `type`, chưa fork khi đã có `FormResponse` mà admin sửa cấu trúc/xóa trường, và Backend (`RequestService`) chưa validate dữ liệu EAV đầu vào theo schema & điều kiện hiển thị của `FormVersion`.

---

## 2. Mục tiêu Phase 2

1. **Tách Data Schema khỏi Presentation Layout (`REQ-FRM-01`):**
   - Giữ nguyên bảng `FormField` và EAV `FormResponseValue` để `fieldKey` luôn ổn định làm nguồn ánh xạ biến (`ProcedureVariableMapping`) cho Operaton ở Phase 4–5.
   - Bổ sung `FormVersion.layoutSchema` (JSON) mô tả Section, Row, Grid 12 cột, Heading, Divider, AttachmentSlot và `visibleWhen`.
2. **Nâng cấp năng lực biểu mẫu nghiệp vụ (`REQ-FRM-02`):**
   - Hỗ trợ kiểu trường mới `FieldType.TABLE` (Repeater / bảng con) với cấu hình cột (`tableConfig`) và tổng hợp tự động (`SUM` / `COUNT`) sang trường `NUMBER` đích nếu cần.
   - Hỗ trợ quy tắc ẩn/hiện có điều kiện (`visibleWhen`) hoạt động đồng bộ ở cả **Live Preview / Runtime Frontend** và **Validation Backend**.
3. **Đảm bảo Version Pinning & Tương thích ngược (`ADR-005`):**
   - Bổ sung API lấy đúng định nghĩa theo `formVersionId` (`GET /forms/versions/:versionId`) để đơn cũ luôn render chuẩn xác theo layout/schema tại thời điểm nộp.
   - Tự động chuẩn hóa (`normalizeLayoutSchema`) cho tất cả form cũ có `layoutSchema = null`.
4. **Đồng bộ Design System GAFOOD × RAMP:**
   - Toàn bộ `FormBuilderScreen`, `FormRenderer`, `FormFieldRenderer` và `RequestFormData` sử dụng `frontend/components/ui/*` và semantic CSS tokens trong `frontend/app/globals.css`.

---

## 3. User Stories

| ID | Vai trò | Nhu cầu | Tiêu chí chấp nhận tóm tắt |
|---|---|---|---|
| `US-FRM-01` | Admin / Người thiết kế biểu mẫu | Chia Section và kéo/xếp nhiều trường trên cùng 1 hàng (2, 3, 4 cột) kèm xem trước trực tiếp | Builder cho phép chia Section, chỉnh `colSpan` (`3/4/6/8/12`), sắp xếp hàng, xem tab Live Preview trước khi lưu |
| `US-FRM-02` | Admin / Người thiết kế biểu mẫu | Tạo bảng con nhiều dòng (hạng mục, số lượng, đơn giá, thành tiền) và tự cộng tổng vào 1 trường số | Chọn kiểu `TABLE`, cấu hình cột + `minRows`/`maxRows` + optional `summary -> targetFieldKey` |
| `US-FRM-03` | Admin / Người thiết kế biểu mẫu | Cấu hình điều kiện ẩn/hiện cho Section hoặc trường (VD: chỉ hiện khi `loai_de_xuat == "MUA_SAM"` hoặc `tong_tien >= 50000000`) | Thiết lập rule `all`/`any` trên UI, không cho phép tạo vòng lặp phụ thuộc, preview chạy ngay |
| `US-FRM-04` | Người trình ký (`Requestor`) | Điền biểu mẫu mạch lạc theo nhóm, không phải điền các trường đang bị ẩn và thấy gợi ý chỗ cần đính kèm PDF | Trường/Section ẩn tự biến mất & không bắt buộc nhập; bảng con thêm/xóa dòng và tự cộng tổng; `attachmentSlot` nhắc rõ mục `MAIN`/`SECONDARY` |
| `US-FRM-05` | Người duyệt / Người xem (`Approver` / `Viewer`) | Xem lại đơn cũ với đúng bố cục và cột bảng con tại phiên bản lúc tạo đơn | `RequestFormData` tải qua `GET /forms/versions/:versionId` và hiển thị dạng read-only đúng Grid/Section/Table của version đó |

---

## 4. Phạm vi (In-Scope vs Out-of-Scope)

### Trong phạm vi Phase 2
- Cập nhật `backend/prisma/schema/form.prisma` (`FieldType.TABLE`, `FormVersion.layoutSchema`, `FormField.tableConfig`) + migration.
- Cập nhật `FormBuilderModule` (DTOs, `LayoutSchema` validator, version bump logic, `GET /forms/versions/:versionId`).
- Bổ sung EAV Value Validator trong `RequestModule` (`POST /requests`, `PATCH /requests/:id`, `POST /requests/:id/submit`) đồng bộ với `visibleWhen` và `TABLE`.
- Nâng cấp `frontend/features/forms/*` (Builder 3 vùng + Live Preview + `FormRenderer` + `TableFieldRenderer`) và `frontend/features/requests/components/RequestFormData.tsx`.
- Unit test, Backend E2E test, Frontend build & test plan đầy đủ.

### Ngoài phạm vi Phase 2 (Để dành cho Phase sau)
- ❌ Tích hợp Operaton BPMN, `Procedure`, `ProcedureVariableMapping` (Phase 4–5).
- ❌ Sinh file PDF tự động từ HTML Form (giữ nguyên cơ chế upload PDF + `SignatureField` + client-side signing ở `DocumentModule` / `SignatureModule`).
- ❌ Rich-text WYSIWYG editor hay công thức Excel phức tạp ngoài `SUM`/`COUNT` trên cột số của `TABLE`.
- ❌ Thay đổi bảng `FormResponseValue` hoặc chuyển dữ liệu EAV sang bảng cột động.

---

## 5. Ràng buộc & Rủi ro kỹ thuật

1. **Tương thích E2E test hiện có:** `backend/test/form-versioning.e2e-spec.ts` kỳ vọng khi form chưa có `FormResponse` và chỉ sửa scalar props trên field cũ thì giữ nguyên `version = 1`. Quy tắc fork trong `data-model.md` phải bảo toàn hành vi này.
2. **Dữ liệu ẩn trên UI vs Submit:** Nếu user đổi lựa chọn khiến một trường vừa nhập bị ẩn đi rồi lại bật lại trong lúc soạn thảo, dữ liệu không nên mất ngay lập tức; tuy nhiên khi bấm **Nộp / Tạo đơn**, các trường đang bị ẩn phải bị loại khỏi payload gửi lên và bỏ qua kiểm tra `required` ở cả FE và BE để tránh lưu giá trị rác gây nhiễu luồng duyệt sau này.
3. **Không làm gãy module khác:** Không sửa `Document`, `RequestDocument`, `SignatureField`, `ApprovalFlow`, hay `Comment`. `AttachmentSlot` trong `LayoutSchema` chỉ mang tính chỉ dẫn giao diện và đối chiếu hint, không thay đổi pipeline upload tài liệu.

