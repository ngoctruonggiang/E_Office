# OperatonController

**Tệp mã nguồn:** `backend/src/modules/operaton/operaton.controller.ts`  
**Tiền tố tuyến đường:** `/operaton`  
**Bảo vệ:** `JwtAuthGuard` (toàn cục) + `RolesGuard` (`ADMIN`, `SUPER_ADMIN` cho các endpoint quản trị).

---

## 1. Mục đích
Cung cấp các cổng giao tiếp HTTP nội bộ của e-Office để kiểm tra sức khỏe của Operaton Engine, lấy danh sách các quy trình đã triển khai (lọc theo category), xem trước sơ đồ XML, trích xuất cấu trúc các bước duyệt (tasks) và điều kiện rẽ nhánh (gateways), đồng thời cho phép Web Modeler phát hành (deploy) sơ đồ BPMN mới.

---

## 2. Danh sách Tuyến đường (Routes)

| Method | Tuyến đường | Quyền yêu cầu | Mô tả |
|---|---|---|---|
| `GET` | `/operaton/health` | Xác thực (Bất kỳ user nào) | Trả về trạng thái `UP`/`DOWN`, phiên bản engine (vd `2.2.1`), URL kết nối và trạng thái CSDL `operaton_db`. |
| `GET` | `/operaton/definitions` | `ADMIN`, `SUPER_ADMIN` | Lấy danh sách các Process Definition đang hoạt động, lọc theo `category` (mặc định `e-Office`) và `latestOnly=true`. |
| `GET` | `/operaton/definitions/:id/xml` | `ADMIN`, `SUPER_ADMIN` | Trả về chuỗi BPMN 2.0 XML nguyên bản của một quy trình theo `id`. |
| `GET` | `/operaton/definitions/:id/structure` | `ADMIN`, `SUPER_ADMIN` | Tự động phân tích XML và trả về cấu trúc JSON gồm: danh sách `tasks` (kèm `assigneeVariable`, `allowOverride`, `isMultiInstance`), `gateways` (kèm `conditionExpression`) và các biến cần thiết `requiredVariables`. |
| `POST` | `/operaton/deploy` | `ADMIN`, `SUPER_ADMIN` | Nhận DTO `DeployWorkflowDto` (`deploymentName`, `category`, `bpmnXml`), kiểm tra tính hợp lệ và gọi Operaton REST API đẩy luồng mới lên engine. |

