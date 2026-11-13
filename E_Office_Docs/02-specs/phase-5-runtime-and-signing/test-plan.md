# Kế hoạch Kiểm thử Toàn diện (Test Plan) — Module Vận hành Run-time & Ký số PDF

**Mã tài liệu:** `SPEC-RUN-TST-01`  
**Thuộc Phase:** `Phase 5 — Vận hành Run-time (Request + Preview/Override Tác nhân + Ký PDF + Vòng đời Operaton)`  
**Trạng thái:** `PENDING_REVIEW`  
**Ngày lập:** 13/11/2026  
**Tác giả:** Google DeepMind / Antigravity Agent  
**Liên kết kiến trúc:**  
- [`architecture_operatioin_eoffice.md`](../../architecture_operatioin_eoffice.md)  
- [`00-overview/04-traceability-matrix.md`](../../00-overview/04-traceability-matrix.md) (`REQ-RUN-01` .. `REQ-RUN-04`)  
- [`02-specs/phase-5-runtime-and-signing/prd.md`](./prd.md)  
- [`02-specs/phase-5-runtime-and-signing/api-contract.md`](./api-contract.md)  

---

## 1. Mục tiêu & Phạm vi Kiểm thử

Kế hoạch này đảm bảo kiểm thử toàn diện mọi khía cạnh kỹ thuật và nghiệp vụ của Phase 5:
1. **Tính chính xác của Động cơ Mô phỏng Luồng (Flow Simulation Engine):** Đánh giá đúng rẽ nhánh Exclusive Gateway (`XOR`) dựa trên số liệu form người dùng nhập.
2. **Quyền Ghi đè Tác nhân (Actor Override - ADR-003):** Cho phép sửa người duyệt khi `allowOverride = true` và chặn hoàn toàn khi `allowOverride = false`.
3. **Ràng buộc Chặt chẽ Ký số PDF (Sign-then-Approve Enforcement):** Tuyệt đối không cho phép duyệt task khi chưa ký số văn bản đính kèm bắt buộc.
4. **Tính Toàn vẹn Vòng đời & Đồng bộ Operaton:** Xử lý chính xác các ca `REQUEST_CHANGES`, `resubmit`, `REJECT`, `CANCEL`, `CLONE`.
5. **Hiệu năng Bảng hình chiếu (TaskProjection):** Màn hình "Công việc của tôi" truy vấn mượt mà dưới 100ms.

---

## 2. Ma trận Ca kiểm thử (Test Matrix)

### 2.1. Kiểm thử Đơn vị (Unit Tests — `backend/src/modules/request/`)

| Mã TC | Hạng mục kiểm thử | Dữ liệu đầu vào / Điều kiện | Kết quả kỳ vọng | Yêu cầu truy vết |
|---|---|---|---|---|
| `TC-RUN-U01` | Trích xuất biến từ Form EAV | `fieldKey: total_amount`, giá trị `75000000`, targetType `NUMBER` | Biến `var_total_amount` được sinh ra với kiểu số nguyên `75000000`. | `REQ-RUN-01` |
| `TC-RUN-U02` | Trích xuất biến bảng lặp `TABLE` | Bảng hàng hóa có cột `amount` [10M, 20M], targetType `NUMBER` | Biến `var_total_items_amount` có giá trị tổng `30000000`. | `REQ-RUN-01` |
| `TC-RUN-U03` | Đánh giá biểu thức điều kiện số | Biểu thức `${var_amount > 50000000}`, context `var_amount = 75000000` | Trả về `true`. | `REQ-RUN-01` |
| `TC-RUN-U04` | Đánh giá biểu thức điều kiện kết hợp | Biểu thức `${var_amount > 50000000 && var_urgent == true}` | Trả về `true` khi cả 2 điều kiện thỏa, `false` khi một trong hai sai. | `REQ-RUN-01` |
| `TC-RUN-U05` | Mô phỏng đường đi BPMN (Simulation) | Sơ đồ BPMN có XOR Gateway phân nhánh theo `var_amount` | Trả về đúng `activeTaskKeys` và `bypassedTaskKeys`. | `REQ-RUN-01` |
| `TC-RUN-U06` | Mô phỏng luồng không khớp nhánh | Giá trị biến không thỏa mãn nhánh nào của Gateway | Chọn nhánh `defaultFlow` theo chuẩn BPMN 2.0. | `REQ-RUN-01` |
| `TC-RUN-U07` | Cho phép Override tác nhân hợp lệ | `allowOverride = true`, người trình chọn User mới | Lưu thành công với `isOverridden = true`. | `REQ-RUN-02` |
| `TC-RUN-U08` | Chặn Override tác nhân trái phép | `allowOverride = false`, người trình cố tình gửi User mới | Ném lỗi `403 Forbidden` (`ERR_ACTOR_OVERRIDE_DENIED`). | `REQ-RUN-02` |
| `TC-RUN-U09` | Chặn duyệt khi chưa ký số | Task có ô chữ ký `PENDING` gán cho user hiện tại | Gọi `approve` trả về `422 Unprocessable Entity` (`ERR_SIGNATURE_REQUIRED`). | `REQ-RUN-03` |
| `TC-RUN-U10` | Ký số và Duyệt liên hoàn | User gửi ảnh chữ ký hợp lệ qua `sign-and-approve` | `SignatureField` chuyển `SIGNED`, task Operaton được hoàn thành. | `REQ-RUN-03` |
| `TC-RUN-U11` | Từ chối không cần ký số | Task có ô chữ ký nhưng người duyệt chọn `reject` | Cho phép từ chối mà không yêu cầu ký số; hủy task. | `REQ-RUN-03` |
| `TC-RUN-U12` | Nhân bản hồ sơ (`CLONE`) | Clone với `mode = "reserve"` | Bản nháp mới giữ nguyên các giá trị form và người duyệt đã override hợp lệ. | `REQ-RUN-04` |

---

### 2.2. Kiểm thử Tích hợp (Integration Tests)

| Mã TC | API Endpoint / Luồng | Mô tả ca kiểm thử | Kết quả kỳ vọng |
|---|---|---|---|
| `TC-RUN-I01` | `POST /requests/from-procedure` | Tạo request từ Procedure đang PUBLISHED | Trả về 201 Created, gắn đúng `procedureVersionId`, nạp `LayoutSchema` và `defaultActors`. |
| `TC-RUN-I02` | `POST /requests/:id/preview-flow` | Gửi dữ liệu form nháp lên để mô phỏng | Trả về 200 OK với danh sách nhánh active và danh sách người duyệt dự kiến. |
| `TC-RUN-I03` | `POST /requests/:id/submit` | Nộp hồ sơ và khởi chạy tiến trình Operaton | Operaton sinh ra `processInstanceId`, `FormResponse.status = PENDING`, bảng `TaskProjection` được điền task đầu tiên. |
| `TC-RUN-I04` | `GET /requests/duty` | Truy vấn danh sách việc cần xử lý của user | Trả về đúng các task `ACTIVE` gán cho user đó, thời gian đáp ứng < 100ms. |
| `TC-RUN-I05` | `POST /requests/:id/tasks/:taskId/request-changes` | Người duyệt yêu cầu chỉnh sửa hồ sơ | `FormResponse.status = REQUEST_CHANGES`, form mở khóa cho người trình sửa. |
| `TC-RUN-I06` | `POST /requests/:id/cancel` | Người trình hủy hồ sơ đang chạy | Operaton xóa process instance, `TaskProjection` chuyển `CANCELLED`, hồ sơ chuyển `CANCELLED`. |

---

### 2.3. Kịch bản Kiểm thử Đầu-Cuối (End-to-End Scenarios)

#### Kịch bản 1: Mua sắm Nhỏ (Giá trị <= 50M) — Phê duyệt Rút gọn (`TC-RUN-E01`)
1. Người trình tạo hồ sơ từ thủ tục *"Mua sắm Thiết bị"*.
2. Nhập số tiền `25.000.000 VNĐ`.
3. Xem trước luồng: Sơ đồ BPMN hiển thị luồng chỉ đi qua **Trưởng phòng duyệt**, bỏ qua bước **Ban Giám đốc**.
4. Người trình nộp hồ sơ.
5. Trưởng phòng vào *"Công việc của tôi"*, mở hồ sơ xem form và nhấn Phê duyệt.
6. Hồ sơ hoàn tất và chuyển sang trạng thái `APPROVED`.

#### Kịch bản 2: Mua sắm Lớn (Giá trị > 50M) + Ghi đè Người duyệt + Ký số PDF (`TC-RUN-E02`)
1. Người trình tạo hồ sơ từ thủ tục *"Mua sắm Thiết bị"*.
2. Nhập số tiền `80.000.000 VNĐ`.
3. Đính kèm file PDF tờ trình và đặt 2 ô chữ ký:
   - Ô 1 cho Trưởng phòng duyệt.
   - Ô 2 cho Tổng Giám đốc duyệt.
4. Tại bước Xem trước luồng:
   - Sơ đồ hiển thị luồng đi qua cả **Trưởng phòng** và **Ban Giám đốc**.
   - Tại bước Trưởng phòng (`allowOverride = true`), người trình đổi từ "Trưởng phòng A" sang "Phó phòng B" (do A đi vắng).
   - Tại bước Ban Giám đốc (`allowOverride = false`), giao diện khóa cứng không cho sửa.
5. Người trình nộp hồ sơ.
6. Phó phòng B đăng nhập vào xem hồ sơ:
   - Thử bấm "Phê duyệt" trực tiếp &rarr; Hệ thống báo lỗi 422 yêu cầu ký số.
   - Bấm "Ký số & Phê duyệt" &rarr; Con dấu hiển thị trên PDF, task hoàn thành.
7. Operaton chuyển token sang bước Tổng Giám đốc:
   - Task xuất hiện trong danh sách việc của Tổng Giám đốc.
   - Tổng Giám đốc ký số và duyệt.
8. Hồ sơ chuyển sang `APPROVED`, file PDF có đầy đủ 2 chữ ký.

#### Kịch bản 3: Luồng Yêu cầu Sửa đổi & Nộp lại (`TC-RUN-E03`)
1. Người duyệt nhận thấy thiếu báo giá, gửi `REQUEST_CHANGES` kèm bình luận.
2. Hồ sơ chuyển trạng thái `REQUEST_CHANGES`.
3. Người trình mở hồ sơ, thấy bình luận của người duyệt, đính kèm thêm file báo giá và nhấn "Nộp lại".
4. Hồ sơ quay lại trạng thái `PENDING` và xuất hiện lại trong danh sách duyệt của người duyệt.

