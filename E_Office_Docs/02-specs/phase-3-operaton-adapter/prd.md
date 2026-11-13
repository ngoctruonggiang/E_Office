# PRD — Phase 3: Operaton Workflow Engine Adapter, Công cụ Thiết kế & Chuẩn BPMN

**Trạng thái:** `APPROVED` (Phase 3)  
**Phụ trách:** AI Coordinator & Người dùng  
**Tài liệu liên quan:** [operaton-engine-contract.md](../../01-architecture/operaton-engine-contract.md), [ADR-002](../../00-overview/adr/ADR-002-operaton-variable-conventions.md), [ADR-006](../../00-overview/adr/ADR-006-operaton-deployment-and-modeler-strategy.md), [05-operaton-workflow-architecture-and-modeler.md](../../00-overview/05-operaton-workflow-architecture-and-modeler.md).

---

## 1. Bối cảnh & Mục tiêu

Sau khi hoàn thành Phase 2 (Form & Flexible Layout Engine), e-Office đã có khả năng tạo biểu mẫu linh hoạt nhiều cột, phân nhóm section và bảng con repeater. 
Mục tiêu của **Phase 3** là thiết lập nền tảng cho **Module 2 — Bộ máy điều phối quy trình chuyên biệt (Operaton BPMN 2.0 Engine)**:
1. **Thiết lập Hạ tầng độc lập:** Dựng Operaton Engine phiên bản mới nhất bằng Docker container, kết nối an toàn với PostgreSQL, sẵn sàng phục vụ headless qua REST API `/engine-rest`.
2. **Chuẩn hóa BPMN 2.0 cho e-Office:** Ban hành bộ quy chuẩn thiết kế quy trình BPMN chuẩn quốc tế (đặt tên biến `var_*`, tác nhân `actor_*` / `actorList_*`, rẽ nhánh tuần tự, song song `Parallel Gateway`, điều kiện `Exclusive Gateway`).
3. **Cung cấp Công cụ Thiết kế Workflow 2 lớp (Dual-Tooling):**
   - Hướng dẫn cấu hình công cụ **Operaton Modeler (Desktop)**.
   - Đặc tả module **Web BPMN Modeler (nhúng `bpmn-js`)** trực tiếp trên web e-Office cho phép Admin thiết kế và phát hành luồng ngay trên trình duyệt mà không cần cài app máy tính.
4. **Xây dựng `OperatonAdapterService` trên Backend NestJS:** Cầu nối giao tiếp server-to-server xử lý triển khai (deploy), phân tích (parse XML), khởi tạo phiên (start), truy vấn tác vụ (query tasks) và hoàn tất bước duyệt (complete task).
5. **Ban hành Workflow Mẫu chuẩn (`FLOW 1`):** Tạo file mẫu BPMN hoàn chỉnh mô phỏng đúng quy trình đề xuất của doanh nghiệp (Người trình -> Xét giá trị field A -> Xem xét 1 // Xem xét 2 -> Trưởng phòng -> Duyệt cuối).

---

## 2. Phạm vi Nghiệp vụ & Ranh giới (Scope & Boundaries)

### 2.1 Trong phạm vi Phase 3
- Thiết lập hạ tầng Docker Compose chạy `operaton/operaton:latest` kết nối database `operaton_db`.
- Thiết lập kịch bản kết nối NestJS Backend với `/engine-rest` (Timeout, Retry, Error Envelope, Idempotency).
- Parser dịch file BPMN 2.0 XML thành danh sách Node có cấu trúc (`UserTask`, `Gateway`, `ConditionExpression`, `AssigneeVariable`).
- Cung cấp file BPMN mẫu chuẩn `e-office-purchase-flow-1.bpmn` thuộc `category="e-Office"`.
- Module Web BPMN Modeler tinh gọn trên Frontend (`bpmn-js`) hỗ trợ vẽ, xem trước và gửi lệnh deploy sang Operaton.
- Kiểm thử tích hợp toàn diện giữa NestJS Backend và Operaton Engine thật qua REST API.

### 2.2 Ngoài phạm vi Phase 3 (Dành cho Phase 4 & 5)
- Chưa lưu bảng thực thể `Procedure` (Ghép Form + Workflow + User mapping) trong CSDL e-Office &rarr; Thuộc **Phase 4**.
- Chưa gắn luồng duyệt thực tế vào màn hình nộp đơn `Request` và ký số PDF `pdf-lib` &rarr; Thuộc **Phase 5**.
- Chưa đồng bộ danh bạ User/Phòng ban động từ Keycloak &rarr; Thuộc **Phase 1 & Phase 6**.

---

## 3. Chân dung Người dùng & User Stories

### US-OPR-01: Quản trị viên khởi chạy & giám sát Operaton Engine
> **Là một** Quản trị hệ thống (DevOps / SysAdmin),  
> **Tôi muốn** khởi chạy Operaton Engine nhanh chóng thông qua Docker Compose kết nối cùng cụm PostgreSQL của dự án,  
> **Để** hệ thống có một BPMN 2.0 engine ổn định, độc lập, không làm nặng mã nguồn ứng dụng và sẵn sàng phục vụ qua cổng `/engine-rest`.

### US-OPR-02: Chuyên viên quy trình vẽ luồng BPMN trên Desktop Modeler
> **Là một** Chuyên viên quy trình (BA / Process Designer),  
> **Tôi muốn** sử dụng phần mềm Operaton Modeler trên máy tính để vẽ các luồng ký phức tạp (rẽ nhánh điều kiện, duyệt song song) và bấm Deploy trực tiếp lên server Operaton,  
> **Để** dễ dàng áp dụng kiến thức chuẩn quốc tế BPMN 2.0 vào các quy trình nội bộ của công ty.

### US-OPR-03: Quản trị viên thiết kế quy trình trực tiếp trên Web e-Office
> **Là một** Quản trị viên ứng dụng e-Office,  
> **Tôi muốn** mở một màn hình vẽ luồng trực quan ngay trên trình duyệt web của e-Office (sử dụng thư viện `bpmn-js`) và bấm phát hành sang Operaton,  
> **Để** tôi có thể tạo và sửa đổi luồng phê duyệt nhanh chóng mà không cần phải cài đặt thêm phần mềm desktop.

### US-OPR-04: Hệ thống tự động phân tích (parse) sơ đồ BPMN
> **Là một** Backend Developer tích hợp,  
> **Tôi muốn** Backend e-Office tự động đọc và phân tích file BPMN XML từ Operaton để trích xuất danh sách các bước duyệt, các biến điều kiện và tác nhân,  
> **Để** làm dữ liệu đầu vào cho màn hình cấu hình Thủ tục (`Procedure`) ở Phase 4.

---

## 4. Tiêu chí Chấp thuận (Acceptance Criteria)

- [ ] **AC-OPR-01:** Container `operaton` khởi chạy thành công qua Docker Compose, kết nối tới database `operaton_db`, trạng thái healthy và trả về `200 OK` khi truy cập `http://localhost:8080/engine-rest/version`.
- [ ] **AC-OPR-02:** File BPMN chuẩn `e-office-purchase-flow-1.bpmn` được deploy thành công lên Operaton Engine với nhãn `category="e-Office"`.
- [ ] **AC-OPR-03:** Backend `OperatonModule` gọi được các API cốt lõi: Lấy danh sách quy trình theo category, tải file XML, parse cấu trúc node, khởi tạo process instance và complete task.
- [ ] **AC-OPR-04:** Web Modeler trên Frontend render được sơ đồ BPMN, cho phép chỉnh sửa cơ bản và xuất ra file XML hợp lệ.
- [ ] **AC-OPR-05:** 100% test case trong Test Plan (Unit + Integration với Operaton thật) pass, không có lỗi rò rỉ tài nguyên.

