# Kế hoạch Kiểm thử (Test Plan) — Phase 3: Operaton Adapter & BPMN Engine

**Trạng thái:** `APPROVED` (Phase 3)  
**Tài liệu liên quan:** [api-contract.md](./api-contract.md), [bpmn-modeling-standards.md](./bpmn-modeling-standards.md), [docker-setup-spec.md](./docker-setup-spec.md).

---

## 1. Mục tiêu Kiểm thử

Đảm bảo:
1. Container Operaton khởi chạy ổn định, kết nối CSDL `operaton_db` và phản hồi đúng chuẩn REST API.
2. Bộ phân tích BPMN Parser dịch chính xác file BPMN XML sang cấu trúc JSON phục vụ UI.
3. Luồng rẽ nhánh điều kiện (`Exclusive Gateway`) và luồng tuần tự hoạt động chính xác 100% khi khởi chạy process instance trên Operaton Engine thật.
4. Xử lý lỗi mượt mà khi Operaton gặp sự cố (Timeout, mất mạng) mà không làm sập backend e-Office.

---

## 2. Danh mục Ca Kiểm thử Chi tiết (Test Cases)

### 2.1 Kiểm thử Hạ tầng & Kết nối Docker (TC-OPR-D*)
| Test ID | Hạng mục | Điều kiện Tiền đề | Các bước Thực hiện | Kết quả Kỳ vọng |
|---|---|---|---|---|
| `TC-OPR-D01` | Khởi chạy Container Operaton | Docker đang chạy, CSDL `operaton_db` đã được tạo | Chạy `docker compose up -d` với file `docker-compose.operaton.yml` | Container ở trạng thái `healthy`, port 8080 mở |
| `TC-OPR-D02` | Ping REST API Version | Container đang chạy | Gửi request `GET http://localhost:8080/engine-rest/version` | Trả về status 200 OK kèm phiên bản động cơ |

---

### 2.2 Kiểm thử Đơn vị Backend (Unit Tests — TC-OPR-U*)
| Test ID | Hạng mục | File Test | Nội dung Kiểm thử |
|---|---|---|---|
| `TC-OPR-U01` | Parse BPMN XML Hợp lệ | `bpmn-parser.service.spec.ts` | Truyền file `FLOW 1` XML, kiểm tra trích xuất đúng 4 tasks, 1 gateway, 2 outgoing conditions |
| `TC-OPR-U02` | Parse Multi-instance Task | `bpmn-parser.service.spec.ts` | Kiểm tra phát hiện đúng cờ `isMultiInstance = true` và biến mảng `actorList_*` |
| `TC-OPR-U03` | Phát hiện BPMN Lỗi | `bpmn-parser.service.spec.ts` | Truyền XML thiếu StartEvent hoặc thiếu executable process, kiểm tra ném lỗi `BadRequestException` |
| `TC-OPR-U04` | Xử lý Timeout Engine | `operaton-client.service.spec.ts` | Giả lập Operaton server phản hồi sau 11s (> timeout 10s), kiểm tra ném lỗi `GatewayTimeoutException` |

---

### 2.3 Kiểm thử Tích hợp với Operaton Thật (Integration Tests — TC-OPR-I*)
| Test ID | Tên Ca Kiểm thử | Dữ liệu Đầu vào | Kỳ vọng |
|---|---|---|---|
| `TC-OPR-I01` | Deploy Quy trình Mẫu `FLOW 1` | File `e-office-purchase-flow-1.bpmn`, category `e-Office` | `POST /engine-rest/deployment/create` trả về 200, tạo ra `processDefinitionId` mới |
| `TC-OPR-I02` | Lọc Danh sách theo Category | Query `category=e-Office` | Chỉ trả về các process thuộc `e-Office`, không chứa các category khác |
| `TC-OPR-I03` | Rẽ nhánh Giá trị Cao (>= 50tr) | Start process với `var_amount = 60000000` | Task đang mở đầu tiên là `step_review_1` (Ban Tài chính) |
| `TC-OPR-I04` | Rẽ nhánh Giá trị Thấp (< 50tr) | Start process với `var_amount = 15000000` | Task đang mở đầu tiên là `step_review_2` (Ban Mua sắm) |
| `TC-OPR-I05` | Chuyển tiếp Bước Tuần tự | Complete task `step_review_1` | Operaton đóng `step_review_1` và mở task tiếp theo `step_department_head` |
| `TC-OPR-I06` | Hoàn thành Toàn bộ Luồng | Complete lần lượt đến `step_final_approver` | Instance kết thúc thành công (`state = COMPLETED`), không còn task mở |
| `TC-OPR-I07` | Hủy Phiên Quy trình | Gọi `DELETE /process-instance/:id` | Instance chuyển sang trạng thái đã xóa, các task mở bị hủy bỏ |

---

### 2.4 Kiểm thử Giao diện Web Modeler (Frontend — TC-OPR-F*)
| Test ID | Hạng mục | Các bước Thực hiện | Kết quả Kỳ vọng |
|---|---|---|---|
| `TC-OPR-F01` | Khởi tạo Canvas `bpmn-js` | Mở màn hình `/admin/workflows/designer` | Canvas render mượt mà, hiển thị thanh công cụ Palette |
| `TC-OPR-F02` | Thay đổi Thuộc tính Node | Chọn 1 UserTask, sửa tên và bật toggle "Cho phép người trình sửa" | Inspector panel cập nhật, XML sinh ra có thuộc tính `allowOverride` |
| `TC-OPR-F03` | Chặn Phát hành khi Sơ đồ Rời rạc | Xóa đường nối giữa StartEvent và UserTask, bấm "Phát hành" | Hiển thị thông báo lỗi kiểm chuẩn, không gửi API deploy |
| `TC-OPR-F04` | Phát hành Thành công | Bấm "Phát hành sang Operaton" trên sơ đồ hợp lệ | Gọi API deploy thành công, hiển thị Toast xanh và ID phiên bản mới |

