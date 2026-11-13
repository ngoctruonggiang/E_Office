# ADR-003: Cơ chế Xem trước Luồng & Cho phép Người trình Sửa Tác nhân

- **Trạng thái:** `APPROVED` (Phase 0)
- **Liên quan:** Phase 4, Phase 5 (`REQ-PRC-02`, `REQ-RUN-01`, `REQ-RUN-02`)

## 1. Bối cảnh
Admin tạo sẵn `Procedure` với các bước và người duyệt mặc định (hiển thị kèm **Phòng ban** và **Chức danh**). Tuy nhiên thực tế vận hành: *"mỗi admin tạo template thì không thể phù hợp cho mọi trường hợp sử dụng được"*, nên người trình **cần được xem trước luồng** và **chủ động sửa/bổ sung người duyệt** trước khi gửi yêu cầu.

## 2. Quyết định kiến trúc
1. **Không sửa trực tiếp sơ đồ BPMN cho từng yêu cầu:** Sơ đồ BPMN trên Operaton giữ nguyên tính chuẩn hóa (các bước, điều kiện rẽ nhánh `var_*`, song song/tuần tự).
2. **Tùy biến tác nhân ở tầng dữ liệu biến (Instance-level Actor Override):**
   - Trong `ProcedureActorMapping`, mỗi `taskDefinitionKey` lưu:
     + `defaultAssignees`: danh sách user mặc định (MVP gán đích danh `user`, hiển thị kèm `displayName`, `departmentName`, `jobTitle`).
     + `allowOverride` (mặc định `true`): cho phép người trình đổi người hoặc thêm/bớt người trong bước đó.
   - Ở các bước có thể thay đổi số lượng người duyệt (vd từ 1 người lên 2-3 người cùng xem xét), BPMN trên Operaton thiết kế `UserTask` dạng **Multi-instance** đọc biến mảng `actorList_<taskKey>`. Nếu chỉ 1 người cố định có thể thay thế, dùng biến đơn `actor_<taskKey>`.
3. **Preview & Evaluate trước khi Submit:**
   - Khi người trình nhập dữ liệu Form (nhất là trường đã map với biến điều kiện như `field A` -> `var_gia_tri`), `e-Office` đánh giá sơ bộ điều kiện trên BPMN để **highlight nhánh dự kiến sẽ đi qua** và hiển thị rõ danh sách người duyệt ở từng bước.
4. **Snapshot bất biến khi Gửi (`Submit`) & Gắn với Chữ ký PDF:**
   - Khi người trình bấm Gửi, `e-Office` lưu **snapshot tác nhân thực tế của yêu cầu đó** vào DB (`RequestActorSnapshot` hoặc tương đương), đồng bộ danh sách người duyệt hợp lệ cho bước kéo-thả `SignatureField` trên PDF, rồi gửi các biến `actor_*` / `actorList_*` đó sang Operaton khi `start` `ProcessInstance`.

## 3. Hệ quả
- Đáp ứng trọn vẹn 2 yêu cầu tưởng chừng mâu thuẫn: **Workflow chuẩn hóa bởi Admin trên Operaton** nhưng **vẫn linh hoạt chọn đúng người xử lý theo từng hồ sơ thực tế** giống ưu điểm hiện tại của `E_Office`.
- Không tạo ra bản rác `ProcessDefinition` bên Operaton cho mỗi lần người trình đổi người duyệt.

