# ADR-002: Quy ước Biến BPMN & Giao tiếp Server-to-Server với Operaton

- **Trạng thái:** `APPROVED` (Phase 0)
- **Liên quan:** Phase 3, Phase 4, Phase 5 (`REQ-OPR-01`, `REQ-OPR-02`, `REQ-PRC-02`)

## 1. Bối cảnh
`Operaton` (`github.com/operaton/operaton`) là BPMN 2.0 engine dùng chung cho nhiều khối (`e-Office`, `Sales Marketing`, `Customer Service`), trong khi người trình và người duyệt chỉ thao tác trên giao diện `e-Office`. Hai hệ thống cần một "hợp đồng giao tiếp" đơn giản để Admin không phải viết code mỗi khi tạo quy trình mới.

## 2. Quyết định kiến trúc
1. **Giao tiếp Server-to-Server bắt buộc:**
   - Chỉ `e-Office Backend` (`OperatonModule`) gọi `/engine-rest/...` sang Operaton (dùng service credentials/mTLS/internal network).
   - `e-Office Frontend` **không bao giờ** gọi trực tiếp vào Operaton để tránh vượt mặt kiểm tra chữ ký PDF (`SignatureModule`), quyền truy cập tài liệu và validation biểu mẫu.
2. **Phân nhóm / Tenant:**
   - Mọi quy trình phục vụ E-Office deploy lên Operaton thuộc tenant hoặc prefix nhóm **`e-Office`** (`tenantId = "e-office"`). Khi màn hình `Procedure` kéo danh sách workflow qua API, chỉ lấy các definition thuộc nhóm này.
3. **Quy ước đặt tên biến chuẩn (Naming Convention) trong BPMN:**
   - **Định danh liên kết:** `businessKey = request.id` (UUID của `FormResponse`).
   - **Biến người khởi tạo:** `eoffice_initiatorId` (userId của người trình).
   - **Biến tham số nghiệp vụ (Gateway conditions):** Tiền tố **`var_`** (ví dụ: `var_gia_tri`, `var_loai_hop_dong`) — được `ProcedureVariableMapping` map từ `FormField.key`.
   - **Biến tác nhân (UserTask assignment):**
     + Cho bước 1 người xử lý: `assignee="${actor_<taskDefinitionKey>}"` (hoặc tiền tố **`actor_`**).
     + Cho bước có thể nhiều người xử lý (song song/tuần tự động — xem ADR-003): dùng BPMN Multi-instance với collection **`actorList_<taskDefinitionKey>`**.
   - **Biến kết quả hành động tại UserTask:** `eoffice_lastAction` (`"APPROVE"` | `"REQUEST_CHANGES"` | `"REJECT"` | `"COMPLETE"`).

## 3. Hệ quả
- Khi `e-Office` kéo BPMN XML từ Operaton qua API, `BpmnParserService` có thể tự động liệt kê tất cả `UserTask` (`taskDefinitionKey`) và tự gợi ý các biến `var_*` đang dùng trong các luồng rẽ nhánh điều kiện, giúp giao diện Mapping (`2b`) gần như tự động nhận diện.
- Bất kỳ workflow mới nào vẽ bên Operaton tuân theo quy ước này đều gắn được vào `e-Office` mà **không cần deploy lại code**.

