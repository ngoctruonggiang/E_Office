# Đặc tả Yêu cầu Sản phẩm (PRD) — Module Vận hành Run-time & Ký số PDF

**Mã tài liệu:** `SPEC-RUN-PRD-01`  
**Thuộc Phase:** `Phase 5 — Vận hành Run-time (Request + Preview/Override Tác nhân + Ký PDF + Vòng đời Operaton)`  
**Trạng thái:** `APPROVED`  
**Ngày lập:** 13/11/2026  
**Tác giả:** Google DeepMind / Antigravity Agent  
**Liên kết kiến trúc:**  
- [`architecture_operatioin_eoffice.md`](../../architecture_operatioin_eoffice.md)  
- [`00-overview/01-vision-and-3-pillars.md`](../../00-overview/01-vision-and-3-pillars.md)  
- [`00-overview/03-roadmap-phases.md`](../../00-overview/03-roadmap-phases.md)  
- [`00-overview/04-traceability-matrix.md`](../../00-overview/04-traceability-matrix.md) (`REQ-RUN-01`, `REQ-RUN-02`, `REQ-RUN-03`, `REQ-RUN-04`)  
- [`00-overview/adr/ADR-003-requestor-actor-override.md`](../../00-overview/adr/ADR-003-requestor-actor-override.md)  
- [`00-overview/adr/ADR-005-version-pinning.md`](../../00-overview/adr/ADR-005-version-pinning.md)  
- [`02-specs/phase-4-procedure-mapping/prd.md`](../phase-4-procedure-mapping/prd.md)  

---

## 1. Bối cảnh & Mục tiêu Sản phẩm

### 1.1. Bối cảnh
Ở các giai đoạn trước:
- **Phase 2 (Form Engine):** Đã xây dựng engine biểu mẫu động đa cột, section, bảng lặp tính tổng (`TABLE`), ẩn hiện có điều kiện (`visibleWhen`), đính kèm slot tài liệu, và mô hình lưu trữ EAV độc lập.
- **Phase 3 (Operaton Adapter):** Đã thiết lập động cơ BPMN Operaton độc lập qua REST API, bộ phân tích BPMN XML chuẩn hóa biến `var_*`, `actor_*`, `actorList_*`, và Web Modeler trực quan.
- **Phase 4 (Procedure Mapping):** Đã hoàn thành lớp cầu nối `Procedure` gắn kết phiên bản Biểu mẫu (`FormVersion`) với Quy trình (`Operaton ProcessDefinition`), cấu hình ánh xạ biến rẽ nhánh và người duyệt mặc định kèm quyền cho phép người trình ghi đè (`allowOverride`).

Tuy nhiên, toàn bộ dữ liệu ở Phase 2, 3, 4 mới chỉ là **Metadata & Thiết kế tĩnh (Design-time Blueprint)**. Doanh nghiệp cần đưa vào **Vận hành thực tế (Run-time Execution)**: nhân viên tạo đề xuất thực tế (`FormResponse` / `Request`), hệ thống tự động đánh giá dữ liệu form để kích hoạt luồng phê duyệt tương ứng trên Operaton, tích hợp ký số văn bản PDF, và theo dõi tiến độ duyệt xuyên suốt.

### 1.2. Mục tiêu Nghiệp vụ (Business Objectives)
1. **Trải nghiệm Người trình (Requester) Thông minh & Trực quan:**
   - Người trình chỉ cần chọn **Thủ tục** muốn thực hiện (ví dụ: *Đề xuất mua sắm thiết bị*, *Xin nghỉ phép*, *Thanh toán công tác phí*).
   - Biểu mẫu tự động hiển thị chuẩn layout của version đã phát hành.
   - Khi nhập số liệu (ví dụ: số tiền đề xuất, thời gian nghỉ), hệ thống **mô phỏng ngay lập tức luồng phê duyệt** trên sơ đồ BPMN, làm nổi bật nhánh điều kiện dự kiến (Bypass hay Active).
   - Người trình nhìn rõ danh sách người duyệt mặc định (kèm phòng ban, chức danh) và có quyền bổ sung/thay đổi người duyệt ở các bước được cấp phép (`allowOverride: true` theo ADR-003).
2. **Ký số Trực tiếp trên Tài liệu (PDF Signing Integration):**
   - Hỗ trợ đính kèm tài liệu PDF tờ trình/hợp đồng và xác định vị trí ký số của từng người duyệt thực tế.
   - Ràng buộc chặt chẽ nghiệp vụ: Khi hồ sơ có yêu cầu ký số, người duyệt **bắt buộc phải hoàn thành thao tác ký số trên PDF** trước khi hoàn thành nhiệm vụ duyệt (`APPROVE`) trên Operaton.
3. **Hiệu năng Cao cho "Công việc của tôi" (My Duties Performance):**
   - Duy trì bảng hình chiếu nhiệm vụ (`TaskProjection`) được đồng bộ thời gian thực từ Operaton để phục vụ hàng ngàn người dùng truy vấn danh sách chờ duyệt với phân trang, lọc theo thủ tục, ngày gửi, người gửi với độ trễ < 100ms.
4. **Vòng đời Toàn diện & Đồng bộ Tuyệt đối (Zero-drift Lifecycle):**
   - Đồng bộ hai chiều trạng thái giữa e-Office (`FormResponse.status`) và Operaton Process Instance khi xảy ra các sự kiện: Yêu cầu sửa đổi (`REQUEST_CHANGES`), Từ chối (`REJECTED`), Hủy bỏ (`CANCELLED`), và Sao chép (`CLONE`).

---

## 2. Đối tượng Người dùng & Vai trò (User Personas)

| Vai trò | Mô tả | Trọng tâm trải nghiệm |
|---|---|---|
| **Người trình (Requester)** | Nhân viên khởi tạo hồ sơ/yêu cầu công việc. | Tạo yêu cầu nhanh, giao diện form rõ ràng, thấy trước luồng duyệt và người duyệt, được quyền sửa người duyệt nếu có quyền, theo dõi trạng thái hồ sơ thời gian thực. |
| **Người duyệt (Approver)** | Trưởng phòng, Kế toán, Giám đốc, Ban Lãnh đạo có nhiệm vụ xử lý hồ sơ. | Màn hình "Công việc của tôi" tập trung, xem nhanh biểu mẫu + tài liệu PDF đính kèm (split-view), ký số 1-click và ra quyết định duyệt/từ chối/yêu cầu sửa có lý do. |
| **Văn thư / Giám sát (Auditor/Admin)** | Theo dõi toàn bộ luồng phê duyệt của công ty, phát hiện hồ sơ bị nghẽn (bottleneck). | Xem trực quan sơ đồ BPMN có tô màu bước đã hoàn tất (xanh lá), bước đang chờ (vàng nhấp nháy), bước rẽ nhánh bị bỏ qua (xám). |

---

## 3. Phạm vi Tính năng (Scope)

### 3.1. Trong phạm vi (In-Scope — Phase 5)
- **Tạo Yêu cầu từ Thủ tục (`POST /requests/from-procedure`):**
  - Khởi tạo bản ghi `FormResponse` gắn chặt với `procedureVersionId` (ADR-005 Version Pinning).
  - Tự động nạp `FormVersion.layoutSchema` để render form.
- **Mô phỏng Luồng & Đánh giá Rẽ nhánh (`POST /requests/preview-flow`):**
  - Trích xuất dữ liệu form, ánh xạ qua `ProcedureVariableMapping` thành các biến `var_*`.
  - Đánh giá biểu thức điều kiện tại các Exclusive Gateway (`XOR`) để xác định chuỗi công việc dự kiến sẽ chạy.
  - Hiển thị trực quan trên sơ đồ BPMN: tô màu xanh nhánh được chọn, làm mờ nhánh không thỏa điều kiện.
- **Xem trước & Ghi đè Tác nhân Thực tế (`RequestActualActor` & ADR-003):**
  - Lấy danh sách người duyệt mặc định từ `ProcedureActorMapping`.
  - Cho phép người trình sửa người duyệt nếu bước đó có `allowOverride = true`.
  - Hỗ trợ thêm nhiều người duyệt nếu bước duyệt được thiết kế dạng Multi-Instance (`actorList_*`).
  - Khóa không cho sửa nếu `allowOverride = false`.
- **Thiết lập Ký số PDF (`SignatureField`):**
  - Đính kèm file PDF chính (tờ trình, phiếu đề xuất).
  - Kéo thả / thiết lập ô chữ ký cho các người duyệt thực tế (`assigneeId`) tương ứng với từng bước trong quy trình.
- **Khởi chạy Quy trình trên Operaton (`POST /requests/:id/submit`):**
  - Khởi tạo Process Instance trên Operaton với `businessKey = request.id`.
  - Truyền đầy đủ biến: các biến điều kiện `var_*` và danh sách tác nhân `actor_*` / `actorList_*`.
  - Chuyển `FormResponse.status` sang `PENDING`.
  - Lưu các task hiện tại vào bảng `TaskProjection`.
- **Màn hình "Công việc của tôi" (`/requests/duty`):**
  - Phân trang, lọc theo trạng thái (Cần xử lý, Đã xử lý), tìm kiếm theo tiêu đề thủ tục và người trình.
  - Dữ liệu truy vấn siêu tốc từ `TaskProjection` kết hợp quan hệ với `FormResponse`.
- **Ký số & Phê duyệt Liên hoàn (Sign-then-Approve Enforcement):**
  - Nếu bước duyệt có ô chữ ký `SignatureField` gán cho user hiện tại: bắt buộc ký số thành công trước khi hoàn thành task `APPROVE` trên Operaton.
  - Khi ký: đóng dấu chữ ký cá nhân (chữ ký mẫu lưu trong profile hoặc vẽ tay), cập nhật tọa độ trên PDF và hoàn thành task Operaton trong một luồng nghiệp vụ an toàn.
- **Quản lý Vòng đời & Xử lý Ngoại lệ:**
  - **Yêu cầu Chỉnh sửa (`REQUEST_CHANGES`):** Chuyển trạng thái hồ sơ về `REQUEST_CHANGES`, gửi thông báo đến người trình để bổ sung thông tin.
  - **Từ chối (`REJECTED`):** Người duyệt nhập lý do từ chối; hệ thống hủy hoặc kết thúc Process Instance trên Operaton; chuyển trạng thái `REJECTED`.
  - **Hủy yêu cầu (`CANCELLED`):** Người trình chủ động hủy hồ sơ khi đang chạy; hệ thống gọi Operaton REST API hủy Process Instance; chuyển trạng thái `CANCELLED`.
  - **Sao chép yêu cầu (`CLONE`):** Nhân bản dữ liệu form từ hồ sơ cũ sang một bản nháp mới (`cloneMode = reset | reserve`), tự động liên kết phiên bản Thủ tục mới nhất đang phát hành.
- **Chi tiết Yêu cầu (Split-View Detail Screen):**
  - Bên trái: Dữ liệu Form đã điền + Tài liệu PDF đã ký + Lịch sử bình luận/trao đổi.
  - Bên phải: Sơ đồ BPMN tương tác hiển thị vị trí token hiện tại, tiến độ các bước và nhật ký hoạt động.

### 3.2. Ngoài phạm vi (Out-of-Scope — Chuyển sang Phase 6)
- Tự động suy diễn chức danh nâng cao theo cây sơ đồ phòng ban (Dynamic Role Resolution: "Trưởng phòng của người trình", "Kế toán chi nhánh") -> Thuộc **Phase 6**. Ở Phase 5, hệ thống sử dụng danh sách người duyệt mặc định đã gán ở Procedure và danh sách người duyệt được người trình chỉ định trực tiếp.
- Ký số bằng USB Token PKI / HSM phần cứng (Digital Certificate X.509) -> Sử dụng chữ ký điện tử nội bộ dạng ảnh/stamp xác thực tài khoản e-Office theo chuẩn hiện hành của dự án.

---

## 4. Chi tiết Yêu cầu Nghiệp vụ & Tiêu chí Nghiệm thu

### 4.1. `REQ-RUN-01`: Tạo Yêu cầu, Điền Form & Mô phỏng Luồng BPMN
- **Mô tả:** Người trình vào danh mục Thủ tục, chọn một thủ tục đang `PUBLISHED`, hệ thống tạo một `FormResponse` ở trạng thái `DRAFT` ghim cứng `procedureVersionId`. Người trình điền biểu mẫu theo `LayoutSchema`. Khi người trình nhập các trường liên quan đến biến rẽ nhánh, hệ thống tính toán và làm nổi bật nhánh dự kiến trên sơ đồ BPMN.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  1. `AC-RUN-01.1`: Không cho phép tạo Request từ Thủ tục chưa được xuất bản (`DRAFT` hoặc `ARCHIVED`).
  2. `AC-RUN-01.2`: Dữ liệu form được tự động validate theo rules của `LayoutSchema` (bắt buộc, số dương, định dạng email...).
  3. `AC-RUN-01.3`: Khi gọi API mô phỏng luồng (`POST /requests/preview-flow`), hệ thống trích xuất đúng các biến `var_*` theo `ProcedureVariableMapping` và đánh giá đúng biểu thức điều kiện (ví dụ: `${var_total_amount > 50000000}`).
  4. `AC-RUN-01.4`: Phản hồi mô phỏng trả về danh sách các `activeTaskKeys`, `bypassedTaskKeys` và đường đi `activeFlowIds` để frontend tô màu sơ đồ BPMN.

### 4.2. `REQ-RUN-02`: Xem trước & Ghi đè Tác nhân Thực tế (ADR-003)
- **Mô tả:** Trước khi nộp yêu cầu, người trình được xem danh sách người duyệt dự kiến cho tất cả các bước trong nhánh được kích hoạt. Người trình có thể thay đổi hoặc thêm người duyệt ở các bước cho phép ghi đè.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  1. `AC-RUN-02.1`: Với các bước có `allowOverride = true` trong `ProcedureActorMapping`, người trình có thể chọn lại User khác hoặc bổ sung User (với bước Multi-Instance).
  2. `AC-RUN-02.2`: Với các bước có `allowOverride = false`, giao diện khóa chọn User và hiển thị icon ổ khóa kèm chú thích: "Bước này do quản trị viên quy định cố định, không được thay đổi".
  3. `AC-RUN-02.3`: Tất cả các bước duyệt nằm trên nhánh dự kiến bắt buộc phải có ít nhất 1 người duyệt hợp lệ trước khi bấm Nộp (`Submit`). Nếu thiếu, chặn nộp và báo lỗi `VAL-ACT-EMPTY`.
  4. `AC-RUN-02.4`: Khi nộp hồ sơ, hệ thống lưu danh sách người duyệt thực tế vào bảng `RequestActualActor`, đồng thời định dạng đúng biến khởi chạy gửi sang Operaton (`actor_<taskKey>` = `userId` hoặc `actorList_<taskKey>` = `[userId1, userId2]`).

### 4.3. `REQ-RUN-03`: Tích hợp Ký số PDF với Nhiệm vụ Operaton
- **Mô tả:** Hồ sơ có văn bản PDF cần ký số. Người trình đặt các ô chữ ký cho người duyệt. Khi người duyệt xử lý task tương ứng, họ phải ký vào ô được chỉ định trước khi hoàn thành phê duyệt trên Operaton.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  1. `AC-RUN-03.1`: Mỗi ô chữ ký `SignatureField` liên kết với một `taskDefinitionKey` (hoặc `actualActorId`) và tọa độ trên trang PDF (`page`, `x`, `y`, `width`, `height`).
  2. `AC-RUN-03.2`: Khi người duyệt ấn "Phê duyệt" (`APPROVE`), hệ thống kiểm tra: Nếu tồn tại ô chữ ký của người duyệt này trên tài liệu chính chưa ký (`status = PENDING`), hệ thống chặn hoàn thành task và kích hoạt màn hình ký số.
  3. `AC-RUN-03.3`: Thao tác ký số cập nhật `SignatureField` thành `SIGNED`, gắn ảnh chữ ký + timestamp + hash, sau đó tự động gọi `OperatonClientService.completeTask(taskId, { approved: true })`.
  4. `AC-RUN-03.4`: Nếu người duyệt chọn "Từ chối" (`REJECT`) hoặc "Yêu cầu sửa" (`REQUEST_CHANGES`), không yêu cầu ký số; task Operaton được hoàn thành hoặc tiến trình bị hủy/rẽ nhánh theo đúng logic nghiệp vụ.

### 4.4. `REQ-RUN-04`: Đồng bộ Vòng đời Toàn diện (`REQUEST_CHANGES`, `REJECT`, `CANCEL`, `CLONE`)
- **Mô tả:** Đảm bảo trạng thái trong cơ sở dữ liệu e-Office luôn nhất quán với trạng thái của Process Instance trên Operaton và danh sách công việc của người dùng.
- **Tiêu chí nghiệm thu (Acceptance Criteria):**
  1. `AC-RUN-04.1`: Khi người duyệt chọn `REQUEST_CHANGES`, trạng thái `FormResponse.status` chuyển thành `REQUEST_CHANGES`. Người trình có thể mở form ra sửa và nộp lại (`POST /requests/:id/resubmit`).
  2. `AC-RUN-04.2`: Khi người duyệt chọn `REJECT`, trạng thái `FormResponse.status` chuyển thành `REJECTED`, Process Instance trên Operaton kết thúc hoặc bị xóa, các task đang chờ bị đóng.
  3. `AC-RUN-04.3`: Khi người trình chọn `CANCEL`, hệ thống gọi `operatonClient.deleteProcessInstance(instanceId, "Cancelled by user")`, cập nhật trạng thái `CANCELLED` và xóa sạch các task đang chờ trong `TaskProjection`.
  4. `AC-RUN-04.4`: Khi người dùng `CLONE` một yêu cầu, hệ thống tạo một `FormResponse` mới ở trạng thái `DRAFT`, sao chép dữ liệu form theo mode (`reset` hoặc `reserve`), và gán `procedureVersionId` của phiên bản mới nhất đang hiệu lực.
  5. `AC-RUN-04.5`: Màn hình `/requests/duty` truy vấn từ `TaskProjection` trả về kết quả chính xác, chỉ hiển thị các task `ACTIVE` thuộc về người dùng hiện tại, có thời gian phản hồi API < 100ms.

