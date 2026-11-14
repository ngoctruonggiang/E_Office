# Kế hoạch Kiểm thử (Test Plan) — Phase 6: Gán Tác nhân Động & E2E Hardening

**Trạng thái:** `APPROVED` (Phase 6 Spec)  
**Tài liệu liên quan:** [prd.md](./prd.md), [dynamic-actor-rules.md](./dynamic-actor-rules.md), [api-contract.md](./api-contract.md).

---

## 1. Mục tiêu Kiểm thử
Xác minh 100% tính chính xác và an toàn của cơ chế phân giải tác nhân động:
1. Lưu trữ và thẩm định cấu hình quy tắc động trong Thủ tục.
2. Suy luận chính xác người duyệt theo Trưởng phòng trực tiếp và Chức danh theo phòng ban.
3. Kích hoạt cơ chế Fallback không bế tắc khi khuyết nhân sự.
4. Tích hợp trọn vẹn vào luồng nộp đơn Run-time và giao task trên BPMN Operaton Engine.
5. Kiểm thử hồi quy toàn diện toàn bộ các chức năng từ Phase 1 đến Phase 6.

---

## 2. Ma trận Kịch bản Kiểm thử (Test Cases)

| Mã TC | Phân loại | Mục tiêu kiểm thử | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **`TC-DYN-01`** | Configuration | Cấu hình bước duyệt dùng quy tắc `DIRECT_MANAGER` | Lưu `ruleConfig: { ruleType: 'DIRECT_MANAGER', fallbackStrategy: 'PARENT_MANAGER' }` vào Procedure Draft. | HTTP 200, DB lưu chính xác trường `assigneeType = DYNAMIC_RULE` và đối tượng `ruleConfig`. |
| **`TC-DYN-02`** | Validation | Thẩm định Thủ tục có bước duyệt động | Gọi `POST /procedures/versions/:versionId/validate`. | `isValid: true`, không báo lỗi `VAL-ACT-01` thiếu người duyệt vì đã có quy tắc động. |
| **`TC-DYN-03`** | Resolution | Phân giải Trưởng phòng trực tiếp khi nộp đơn | 1. Nhân viên `staff@gafood.local` (Phòng Hành Chính Nhân Sự) nộp đơn.<br>2. Gọi `POST /requests/preview-flow`. | Bước 1 tự động gán cho Quản lý của Phòng Hành Chính Nhân Sự. |
| **`TC-DYN-04`** | Resolution | Phân giải Chức danh theo phòng (`DEPARTMENT_TITLE`) | Cấu hình bước 2 tìm chức danh "Kế Toán Trưởng" tại "Phòng Tài Chính Kế Toán". | Bước 2 tự động gán chính xác cho `accountant@gafood.local` (`Lê Thị Kế Toán`). |
| **`TC-DYN-05`** | Fallback | Xử lý khi phòng ban khuyết Manager | 1. Xóa tạm Manager của phòng ban nhân viên.<br>2. Kiểm tra phân giải tác nhân. | Hệ thống tự động kích hoạt `PARENT_MANAGER` và chuyển tiếp lên Manager của đơn vị cấp trên (hoặc Root / Ban Giám Đốc). |
| **`TC-DYN-06`** | E2E Integration | Khởi tạo đơn và giao Task trên Operaton | 1. Nộp đơn chính thức `POST /requests`.<br>2. Kiểm tra Task trên Operaton `/engine-rest/task`. | Biến `actor_<taskKey>` trên Operaton nhận đúng User ID được phân giải động. Task xuất hiện trong danh sách công việc của người duyệt. |
| **`TC-DYN-07`** | Hardening | Biên dịch & Rà soát Hồi quy Toàn hệ thống | 1. Chạy `npm run build` trên Backend NestJS.<br>2. Chạy `npm run build` trên Frontend Next.js. | 100% build pass với 0 lỗi, toàn bộ các luồng Phase 1-5 không bị ảnh hưởng. |

---

## 3. Tiêu chí Hoàn thành Phase 6 (Exit Criteria)
1. 100% 7 Test Cases trên đều `PASS`.
2. Toàn bộ tài liệu trong `E_Office_Docs/02-specs/phase-6-dynamic-actor-and-hardening/` đạt chuẩn kiểm soát tuân thủ.
3. Cập nhật ma trận truy vết [04-traceability-matrix.md](../../00-overview/04-traceability-matrix.md) chuyển `REQ-DYN-01` sang `VERIFIED`.
