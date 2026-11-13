# ADR-005: Chiến lược Ghim Phiên bản Đồng bộ (Version Pinning)

- **Trạng thái:** `APPROVED` (Phase 0)
- **Liên quan:** Phase 2, Phase 4, Phase 5 (`REQ-FRM-01`, `REQ-PRC-01`)

## 1. Bối cảnh
Hệ thống có 3 thực thể thay đổi độc lập theo thời gian:
1. Biểu mẫu (`FormVersion` bên e-Office).
2. Quy trình BPMN (`ProcessDefinition` version bên Operaton).
3. Cấu hình ghép nối (`Procedure` bên e-Office).

Nếu Admin sửa bố cục form, đổi tên biến điều kiện, hoặc deploy phiên bản BPMN mới trong khi hàng chục yêu cầu cũ vẫn đang chờ duyệt, mọi thay đổi đó **không được phép làm hỏng hoặc đổi luồng của yêu cầu đang chạy**.

## 2. Quyết định kiến trúc
1. **Tách `Procedure` và `ProcedureVersion` (hoặc immutable snapshot khi Publish):**
   - Mỗi lần Admin chỉnh sửa mapping hoặc nâng `FormVersion` / nâng `ProcessDefinition` version và bấm **Publish**, hệ thống tạo ra một **`ProcedureVersion` bất biến mới** (`version: 1, 2, 3...`), lưu chính xác:
     + `formVersionId` (của e-Office)
     + `operatonProcessDefinitionId` (ID gắn chặt **exact version** bên Operaton, không chỉ lưu mỗi key!) và `operatonProcessDefinitionKey`
     + Toàn bộ snapshot `ActorMapping` & `VariableMapping` của phiên bản đó.
2. **Ghim ở mức Request (`FormResponse`):**
   - Khi người trình tạo yêu cầu từ một `Procedure`, `FormResponse` ghim chặt `procedureVersionId` đang hiệu lực (`ACTIVE` / `PUBLISHED`) tại thời điểm tạo (nếu là bản `DRAFT`, giữ nguyên phiên bản đó cho tới khi gửi hoặc người dùng chủ động tạo mới).
   - Lúc gọi Operaton `start` instance, dùng `POST /engine-rest/process-definition/{operatonProcessDefinitionId}/start` để chắc chắn chạy đúng version BPMN đã map với `FormVersion` tương ứng.
3. **Độc lập sửa Form Layout vs BPMN:**
   - Nếu Admin chỉ chỉnh **Layout thẩm mỹ** (đổi 1 cột -> 2 cột) mà không đổi `fieldKey`, hệ thống có thể phát hành `FormVersion` mới và gợi ý Admin "Cập nhật nhanh Procedure sang FormVersion mới" mà không phải vẽ lại mapping từ đầu.

## 3. Hệ quả
- Yêu cầu cũ luôn hiển thị đúng giao diện Form cũ, đúng dữ liệu cũ và chạy hết đúng luồng BPMN phiên bản cũ mà nó đã khởi tạo.
- Admin yên tâm nâng cấp biểu mẫu và quy trình mới cho các hồ sơ tương lai.

