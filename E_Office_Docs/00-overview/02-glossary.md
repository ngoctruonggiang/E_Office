# 02 — Từ điển Thuật ngữ Thống nhất (Glossary)

**Trạng thái:** `APPROVED` (Phase 0)

Mọi tài liệu đặc tả, tên biến trong code, tên biến trong BPMN và văn bản trao đổi giữa các thành viên phải dùng đúng thuật ngữ dưới đây.

| Thuật ngữ | Hệ thống sở hữu | Định nghĩa chuẩn | Ghi chú ánh xạ code / BPMN |
|---|---|---|---|
| **Keycloak Subject (`keycloakSub`)** | Keycloak -> e-Office | Định danh bất biến (UUID `sub` claim) của một tài khoản nhân sự trong Keycloak | Lưu trên bảng `users.keycloakSub` |
| **Phòng ban / Chức danh** | Keycloak / e-Office Org | Đơn vị trực thuộc và vị trí công tác của nhân sự; bắt buộc hiển thị khi chọn/xem tác nhân trong `Procedure` và luồng duyệt | `Organization`, `User.jobTitle` / `OrganizationMember` |
| **Form (`Form` / `FormVersion`)** | e-Office | Mẫu biểu mẫu dữ liệu. Mỗi lần thay đổi cấu trúc trường dữ liệu hoặc layout phát hành mới tạo một `FormVersion` | `backend/prisma/schema/form.prisma` |
| **Data Schema** | e-Office | Danh sách trường dữ liệu nghiệp vụ (`FormField`: `key`, `label`, `type`, `validations`, `options`) dùng để validate và lưu giá trị EAV | `FormField`, `FormResponseValue` |
| **Layout Schema** | e-Office | Cấu trúc JSON mô tả cách bày trí giao diện Form (Sections, Grid nhiều cột, Repeater/bảng con, điều kiện ẩn/hiện, vị trí đính kèm) độc lập với Workflow | Trường `layoutSchema Json?` trên `FormVersion` (đề xuất ADR-001) |
| **Workflow (`ProcessDefinition`)** | Operaton | Sơ đồ quy trình BPMN 2.0 được thiết kế và deploy trên Operaton (thuộc nhóm/tenant `e-Office`) | Xác định bởi `processDefinitionKey` (bất biến theo tên quy trình) & `processDefinitionId` (gắn chặt 1 version cụ thể) |
| **Workflow Node (`UserTask`)** | Operaton | Một bước công việc cần con người xử lý trong BPMN (vd: `xem xét 1`, `trưởng phòng`, `người duyệt cuối`), có mã định danh `taskDefinitionKey` | Dùng `taskDefinitionKey` làm khóa ánh xạ sang e-Office |
| **Gateway (`Exclusive` / `Parallel`)** | Operaton | Điểm rẽ nhánh điều kiện (`Exclusive Gateway`, vd xét `giá trị`) hoặc chạy đồng thời nhiều nhánh rồi hội tụ (`Parallel Gateway`) trong BPMN | Điều kiện Gateway đọc biến `var_*` |
| **`Procedure` (Mẫu thủ tục)** | e-Office | Thực thể trung tâm ghép **1 `FormVersion`** + **1 `Workflow` bên Operaton** + cấu hình **Actor Mapping** + **Variable Mapping** để tạo thành quy trình nghiệp vụ hoàn chỉnh (vd: *Yêu cầu mua sắm*) | Module `Procedure` mới (Phase 4) |
| **Actor Mapping** | e-Office | Cấu hình gắn `UserTask` của Operaton với người xử lý mặc định trong e-Office (MVP: user cụ thể kèm Phòng ban/Chức danh; sau này: quy tắc động theo phòng ban/chức danh) + cờ `allowOverride` | Ánh xạ vào biến `actor_*` / `actorList_*` khi start Operaton |
| **Variable / Parameter Mapping** | e-Office | Cấu hình ánh xạ giữa `fieldKey` của Form (vd `field A`) sang tên biến điều kiện của Operaton (vd `var_gia_tri`) | Đọc giá trị từ `FormResponseValue` để gửi sang Operaton |
| **Actor Override** | e-Office | Quyền của người trình được đổi hoặc bổ sung người duyệt ở các bước cho phép ngay lúc tạo yêu cầu từ `Procedure` mẫu | Lưu snapshot danh sách tác nhân thực tế của yêu cầu đó (ADR-003) |
| **Request (`FormResponse`)** | e-Office | Một hồ sơ trình ký cụ thể do người trình tạo từ `Procedure` (hoặc `FormVersion`), mang trạng thái vòng đời (`DRAFT`, `PENDING`, `REQUEST_CHANGES`, `APPROVED`, `REJECTED`, `CANCELLED`) | `FormResponse` + `operatonProcessInstanceId` |
| **ProcessInstance** | Operaton | Một phiên chạy thực tế của `Workflow` trên Operaton tương ứng với 1 `Request` đã gửi của e-Office (`businessKey = request.id`) | Quản lý hoàn toàn bởi Operaton |
| **Signing Document** | e-Office | Tệp PDF được chỉ định để ký online (`RequestDocument.signing = true`), mang các tọa độ `SignatureField` gắn với `assigneeId` thực tế | Giữ nguyên ở `SignatureModule` (`signature.prisma`) |
| **Docs-First / Zero-Drift** | Quy trình dự án | Bắt buộc viết & duyệt tài liệu đặc tả trong `E_Office_Docs/` trước khi code, và code phải khớp 100% với đặc tả | Kiểm soát bởi `04-traceability-matrix.md` và `03-checklists/` |

