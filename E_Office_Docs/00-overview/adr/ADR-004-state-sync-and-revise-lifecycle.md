# ADR-004: Đồng bộ Trạng thái Operaton <-> e-Office & Vòng đời Revise / Cancel

- **Trạng thái:** `APPROVED` (Phase 0)
- **Liên quan:** Phase 3, Phase 5 (`REQ-OPR-01`, `REQ-RUN-03`, `REQ-RUN-04`)

## 1. Bối cảnh
`e-Office` cần màn hình *"Công việc của tôi"*, *"Tạo bởi tôi"*, tìm kiếm, phân trang và kiểm soát trạng thái (`DRAFT`, `PENDING`, `REQUEST_CHANGES`, `APPROVED`, `REJECTED`, `CANCELLED`). Nếu mọi truy vấn đều gọi realtime sang Operaton rồi join dữ liệu Form bên PostgreSQL sẽ chậm và khó phân trang. Ngoài ra, khi người dùng hủy hoặc yêu cầu chỉnh sửa (`REQUEST_CHANGES` -> `revise`), không được để `ProcessInstance` bên Operaton bị treo `ACTIVE`.

## 2. Quyết định kiến trúc
1. **e-Office giữ Projection đọc nhanh (Read Model), Operaton là Nguồn sự thật về Luồng chạy (Execution Truth):**
   - `FormResponse` lưu thêm `procedureVersionId`, `operatonProcessInstanceId`, và giữ `status: RequestStatus`.
   - `e-Office` duy trì bảng projection nhiệm vụ hiện hành (hoặc tái cấu trúc bảng `Task` gắn `operatonTaskId`, `taskDefinitionKey`, `assigneeId`, `status`) để query *"Công việc của tôi"* với đầy đủ bộ lọc Form/Date/Status trong 1 truy vấn SQL.
   - Mỗi khi `e-Office` thực hiện `start`, `complete`, `cancel` sang Operaton, dịch vụ đồng bộ cập nhật ngay projection từ kết quả trả về; đồng thời có **Execution/Task Webhook hoặc Background Reconciliation Job** đối soát nếu có timer/auto-transition xảy ra tự động bên Operaton.
2. **Gắn hook Ký số PDF (`SignatureModule`) trước khi Complete Task:**
   - Nếu yêu cầu có tài liệu trình ký (`RequestDocument.signing = true`) và `assignee` có ô chữ ký `SignatureField` ở trạng thái `PENDING`, API complete `APPROVE` bắt buộc đi qua quy trình ký (`SignDocumentModal` -> `POST /requests/:id/signature/sign`), đóng dấu chữ ký xong mới gọi `POST /engine-rest/task/{taskId}/complete`.
3. **Chuẩn hóa `REJECT`, `CANCEL` và `REQUEST_CHANGES` trên BPMN:**
   - **Hủy yêu cầu (`CANCEL`):** `e-Office` gọi `DELETE /engine-rest/process-instance/{id}` (kèm `cancelReason`) trước khi đánh dấu `CANCELLED`.
   - **Từ chối (`REJECT`) & Yêu cầu chỉnh sửa (`REQUEST_CHANGES`):** BPMN nhóm `e-Office` bắt buộc có Gateway sau `UserTask` kiểm tra `eoffice_lastAction`:
     + Nếu `REJECT` hoặc `REQUEST_CHANGES`: BPMN rẽ ra **End Event** tương ứng (kết thúc sạch `ProcessInstance` cũ), để `e-Office` cập nhật trạng thái `REJECTED` hoặc `REQUEST_CHANGES` và hỗ trợ `revise` (tạo `FormResponse` mới + `ProcessInstance` mới khi người trình nộp lại bản sửa, giữ lịch sử `clonedFromId`).

## 3. Hệ quả
- Loại bỏ hoàn toàn nguy cơ "Operaton vẫn treo task cũ trong khi e-Office đã báo hủy/chỉnh sửa".
- Màn hình danh sách `RequestListScreen` giữ được tốc độ lọc/phân trang tức thì.

