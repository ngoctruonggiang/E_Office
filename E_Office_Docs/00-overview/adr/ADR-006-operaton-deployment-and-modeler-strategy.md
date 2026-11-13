# ADR-006: Chiến lược Triển khai Operaton Engine & Công cụ Thiết kế Workflow (Modeler)

**Trạng thái:** `APPROVED`  
**Ngày quyết định:** 2026-11-13  
**Người đề xuất:** AI Coordinator & Người dùng  
**Liên quan:** [01-vision-and-3-pillars.md](../01-vision-and-3-pillars.md), [05-operaton-workflow-architecture-and-modeler.md](../05-operaton-workflow-architecture-and-modeler.md), [ADR-002](./ADR-002-operaton-variable-conventions.md)

---

## Bối cảnh & Vấn đề

Người dùng mong muốn:
1. Clone hệ thống tạo workflow `https://github.com/operaton/operaton.git` về sử dụng.
2. Tách bạch 2 module quan trọng: **Module Tạo biểu mẫu (`e-Office`)** và **Module Tạo workflow (`Operaton`)** độc lập và chuyên biệt nhưng tương thích tốt.
3. Người dùng cuối có thể tạo quy trình từ template thủ tục (`Procedure`), xem trước luồng duyệt, sửa người duyệt nếu cần và ký số tài liệu PDF.

Tuy nhiên, qua phân tích kỹ thuật:
- Repository `operaton/operaton` là **Process Engine Java/Spring Boot**, chỉ chứa runtime engine, REST API `/engine-rest` và Cockpit giám sát, **hoàn toàn KHÔNG có giao diện đồ họa để vẽ luồng quy trình trên web**.
- Việc clone source code Java của `operaton/operaton` vào repo dự án e-Office sẽ làm phình to mã nguồn (hàng trăm MB/GB code Java), đòi hỏi cài đặt môi trường JDK 17, Maven phức tạp và thời gian build kéo dài 20-45 phút mỗi lần cập nhật.
- Công cụ vẽ quy trình thực tế là **Operaton Modeler** (`https://github.com/operaton/operaton-modeler` - Desktop App chạy trên Electron dựa trên `bpmn-js`) hoặc thư viện web **`bpmn-js`**.

---

## Quyết định Kiến trúc

### 1. Về Triển khai Operaton Engine (Docker-First)
- **Không đưa source code Java của `operaton/operaton` vào bên trong monorepo của `E_Office`.**
- Triển khai Operaton Engine dưới dạng **Container Docker độc lập** thông qua Docker Compose:
  - Sử dụng Docker image chính thức: `operaton/operaton:latest`.
  - Kết nối trực tiếp vào cùng cụm PostgreSQL của dự án (dùng database riêng `operaton_db` để cách ly hoàn toàn dữ liệu với `e_office_db`).
  - Mở cổng REST API nội bộ `http://operaton:8080/engine-rest` cho backend e-Office giao tiếp server-to-server.
- Nếu cần clone source code `operaton/operaton` để nghiên cứu hoặc tùy biến plugin Java: thực hiện ở một repository / thư mục độc lập bên ngoài monorepo e-Office (`infrastructure/operaton` hoặc folder riêng biệt), không gộp vào Git tree của e-Office.

### 2. Về Công cụ Tạo/Thiết kế Workflow (Modeler Strategy)
Cung cấp **chiến lược 2 lớp (Dual-Tooling Strategy)** đáp ứng cả nhu cầu chuyên sâu lẫn tiện dụng:
1. **Lớp 1 — Desktop Modeler (Tiêu chuẩn BPMN quốc tế):**
   - Hỗ trợ công cụ **Operaton Modeler** (`operaton/operaton-modeler`) hoặc Camunda Modeler dành cho Business Analyst / Quản trị viên cấp cao.
   - Cho phép thiết kế BPMN 2.0 đầy đủ tính năng (Sub-processes, DMN Decision Table, Message Events, Timer...) và bấm Deploy trực tiếp lên Operaton REST API.
2. **Lớp 2 — Web Modeler nhúng trực tiếp trong e-Office (Trải nghiệm liền mạch):**
   - Tích hợp thư viện mã nguồn mở **`bpmn-js`** (chính là lõi của Operaton Modeler) vào giao diện Web Next.js của e-Office.
   - Người quản trị e-Office có thể mở tab "Quản lý Quy trình" trên trình duyệt, vẽ luồng tuần tự, song song, rẽ nhánh điều kiện và bấm "Phát hành sang Operaton" ngay trên web mà không bắt buộc phải cài đặt phần mềm desktop.

### 3. Về Phân loại & Phân quyền Khối Nghiệp vụ
- Mọi Workflow phục vụ cho e-Office phải được gắn nhãn định danh: `category = "e-Office"`.
- e-Office chỉ truy vấn các quy trình thuộc `category = "e-Office"` qua API, đảm bảo cách ly hoàn toàn với các luồng khác chạy chung trên engine (như `Sales Marketing`, `Customer Service`).

---

## Hệ quả & Đánh giá

### Ưu điểm
1. **Khởi động nhanh & Ổn định:** Container Operaton khởi động trong 10-20 giây, sử dụng image tối ưu, không phụ thuộc môi trường Java cục bộ của máy lập trình viên.
2. **Độc lập kiến trúc (Loose Coupling):** e-Office (Node.js/TypeScript) và Operaton (Java) giao tiếp 100% qua chuẩn quốc tế REST API và BPMN 2.0 XML. Một bên nâng cấp không làm vỡ bên kia.
3. **Trải nghiệm người dùng tuyệt vời:** Không ép buộc người dùng phải cài thêm phần mềm nếu chỉ cần vẽ các luồng cơ bản trên Web; đồng thời vẫn mở đường cho các chuyên gia quy trình dùng tool desktop chuyên dụng.
4. **Bảo mật tuyệt đối:** Giao tiếp server-to-server, cổng Operaton không lộ ra internet công cộng, chữ ký PDF được kiểm tra bắt buộc trước khi complete task.

### Nhược điểm & Ràng buộc
- Cần duy trì Docker daemon chạy trên máy phát triển / server.
- Màn hình Web Modeler (`bpmn-js`) trên e-Office cần cấu hình palette đơn giản hóa phù hợp với nghiệp vụ e-Office (chủ yếu là UserTask, Gateway, Start/End Event).

