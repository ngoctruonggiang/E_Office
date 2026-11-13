# OperatonService, OperatonClientService & BpmnParserService

**Tệp mã nguồn:**
- `backend/src/modules/operaton/operaton.service.ts`
- `backend/src/modules/operaton/operaton-client.service.ts`
- `backend/src/modules/operaton/bpmn-parser.service.ts`

---

## 1. Phân chia Trách nhiệm

1. **`BpmnParserService`**:
   - Sử dụng thư viện `fast-xml-parser` để duyệt và trích xuất cấu trúc chuẩn từ file BPMN 2.0 XML.
   - Bắt buộc kiểm tra: sự tồn tại của `bpmn:startEvent`, `bpmn:endEvent` và `bpmn:process` có cờ `isExecutable="true"`.
   - Trích xuất tự động:
     - Các `bpmn:userTask`: đọc `camunda:assignee` hoặc `assignee`, kiểm tra thẻ `multiInstanceLoopCharacteristics` để xác định duyệt song song nhiều người, đọc thuộc tính mở rộng `allowOverride` và `defaultRole`.
     - Các `bpmn:exclusiveGateway`, `bpmn:parallelGateway`: đọc các sequence flow đi ra và biểu thức điều kiện `${var_*}`.
     - Biến điều kiện: tự động tổng hợp danh sách các biến `var_*` cần truyền khi khởi chạy.

2. **`OperatonClientService`**:
   - HTTP Client cấp thấp giao tiếp trực tiếp với Operaton REST API (`http://localhost:8080/engine-rest`).
   - Sử dụng native `fetch` và `FormData` của Node.js, tích hợp `AbortController` với thời gian timeout mặc định 10.000ms.
   - Xử lý các mã lỗi HTTP chuẩn: trả về `GatewayTimeoutException` (504) khi hết hạn, `NotFoundException` (404) khi không tìm thấy tài nguyên và `BadGatewayException` (502) khi engine gặp sự cố.

3. **`OperatonService`**:
   - Lớp nghiệp vụ đóng vai trò facade kết hợp giữa `OperatonClientService` và `BpmnParserService`.
   - Kiểm tra sơ đồ hợp lệ trước khi gửi lệnh deploy, tự động gán nhãn nhóm mặc định `category="e-Office"` và phân tích cấu trúc quy trình từ XML.

