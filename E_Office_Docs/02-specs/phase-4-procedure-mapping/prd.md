# Đặc tả Yêu cầu Sản phẩm (PRD) — Module Thủ tục (Procedure Module)

**Mã tài liệu:** `SPEC-PRC-PRD-01`  
**Thuộc Phase:** `Phase 4 — Lớp Cầu nối Procedure (Mapping Form + Workflow + Tác nhân + Tham số)`  
**Trạng thái:** `PENDING_REVIEW`  
**Ngày lập:** 13/11/2026  
**Tác giả:** Google DeepMind / Antigravity Agent  
**Liên kết kiến trúc:**  
- [`architecture_operatioin_eoffice.md`](../../architecture_operatioin_eoffice.md)  
- [`00-overview/01-vision-and-3-pillars.md`](../../00-overview/01-vision-and-3-pillars.md)  
- [`00-overview/03-roadmap-phases.md`](../../00-overview/03-roadmap-phases.md)  
- [`00-overview/04-traceability-matrix.md`](../../00-overview/04-traceability-matrix.md) (`REQ-PRC-01`, `REQ-PRC-02`)  
- [`00-overview/adr/ADR-003-requestor-actor-override.md`](../../00-overview/adr/ADR-003-requestor-actor-override.md)  
- [`00-overview/adr/ADR-005-version-pinning.md`](../../00-overview/adr/ADR-005-version-pinning.md)  

---

## 1. Bối cảnh & Vấn đề Cần giải quyết

Hệ thống GAFOOD E-Office được thiết kế theo kiến trúc 3 trụ cột độc lập nhưng tương thích cao:
1. **Biểu mẫu động (Form Engine — Hoàn tất ở Phase 2):** Cung cấp khả năng dựng giao diện Form linh hoạt (Grid, Section, Repeater Table, Ẩn/hiện có điều kiện), lưu dữ liệu theo mô hình EAV (`FormResponseValue`) gắn với phiên bản Form (`FormVersion`).
2. **Động cơ Quy trình (Operaton BPMN Engine — Hoàn tất ở Phase 3):** Vận hành container Operaton Engine độc lập chuẩn BPMN 2.0, hỗ trợ luồng Tuần tự, Song song, Gateway điều kiện (`var_*`), và Multi-Instance (`actorList_*`).
3. **Cần một Lớp Cầu nối Trung tâm (Procedure — Phase 4):**
   - Biểu mẫu không nên biết chi tiết luồng BPMN bên trong Operaton.
   - Sơ đồ BPMN không nên bị gắn cứng vào bất kỳ biểu mẫu cụ thể nào (1 quy trình BPMN như `FLOW 1` có thể tái sử dụng cho nhiều nghiệp vụ khác nhau: Mua sắm hàng hóa, Đề xuất vật tư, Chi phí công tác...).
   - Do đó, **Thủ tục (`Procedure`)** chính là bản thiết kế nghiệp vụ hoàn chỉnh (Business Blueprint), chịu trách nhiệm:
     - Ghép 1 phiên bản Biểu mẫu (`FormVersion`) với 1 Quy trình phê duyệt (`Operaton ProcessDefinition`).
     - **Ánh xạ tham số động (Dynamic Parameter Mapping):** Nối trường Form (`FormField.key`) vào biến điều kiện rẽ nhánh Gateway (`var_*`).
     - **Ánh xạ người duyệt mặc định (Actor Assignment Mapping):** Gán User cụ thể (kèm thông tin Phòng ban, Chức danh) vào các bước duyệt (`actor_*`), cấu hình quyền cho phép người trình sửa (`allowOverride`).
     - **Khóa cứng phiên bản (Version Pinning — ADR-005):** Khi phát hành (`PUBLISHED`), `ProcedureVersion` trở thành bất biến, đảm bảo các yêu cầu đang xử lý dở dang không bao giờ bị ảnh hưởng khi Admin sửa biểu mẫu hay sửa luồng quy trình.

---

## 2. Mục tiêu Nghiệp vụ (Business Objectives)

1. **Chuẩn hóa Danh mục Thủ tục Doanh nghiệp:** Toàn bộ các quy trình giấy tờ hành chính, đề xuất, mua sắm, nhân sự của GAFOOD được quản lý tập trung dưới dạng các Thủ tục rõ ràng, có phân loại phòng ban áp dụng và mã thủ tục quy chuẩn.
2. **Tối đa hóa khả năng Tái sử dụng:** Một sơ đồ BPMN đã kiểm thử chuẩn chỉ cần vẽ 1 lần trên Operaton Modeler / Web Modeler và có thể dùng cho nhiều Thủ tục khác nhau chỉ bằng thao tác cấu hình mapping trên web.
3. **Minh bạch thẩm quyền duyệt:** Mọi bước duyệt trong thủ tục đều hiển thị rõ người duyệt mặc định, phòng ban và chức danh của họ.
4. **Linh hoạt thích ứng thực tế:** Hỗ trợ cờ `allowOverride: true` cho từng bước duyệt. Tránh tình trạng "mẫu quá cứng nhắc" khiến người dùng không áp dụng được khi có trường hợp ngoại lệ (ủy quyền, nhân sự nghỉ, bước tư vấn bổ sung).

---

## 3. Phạm vi (Scope)

### 3.1. Trong phạm vi (In-Scope — Phase 4)
- **Data Model:** Thiết kế và migration các bảng: `Procedure`, `ProcedureVersion`, `ProcedureActorMapping`, `ProcedureVariableMapping`.
- **Backend API (`ProcedureModule`):**
  - CRUD thông tin chung của Thủ tục (mã code, tên, mô tả, phòng ban áp dụng, icon, màu sắc).
  - Quản lý phiên bản Thủ tục (`ProcedureVersion`): Tạo bản nháp (`DRAFT`), xem chi tiết, sao chép version.
  - Cấu hình Mapping:
    - Lưu danh sách biến `ProcedureVariableMapping` (`varName` <-> `fieldKey`, kiểu dữ liệu `NUMBER`, `STRING`, `BOOLEAN`).
    - Lưu danh sách người duyệt `ProcedureActorMapping` (`taskDefinitionKey`, `taskName`, `defaultUserId`, `allowOverride`, `required`, `order`).
  - **Công cụ Thẩm định tính toàn vẹn (Pre-publish Validation Engine):** Kiểm tra đối soát giữa BPMN XML từ Operaton và FormVersion:
    - Tất cả biến rẽ nhánh trong BPMN (`conditionVariables`) bắt buộc phải được ánh xạ vào trường Form hợp lệ.
    - Tất cả UserTask trong BPMN bắt buộc phải có cấu hình Actor Mapping.
    - Kiểm tra tính tương thích về kiểu dữ liệu (vd: biến rẽ nhánh so sánh số thì trường form phải là `NUMBER` hoặc cột `TABLE` kiểu số).
  - **Phát hành Phiên bản (`Publish ProcedureVersion`):** Chuyển version từ `DRAFT` &rarr; `PUBLISHED`, đánh dấu phiên bản hiệu lực hiện tại, khóa bất biến version cũ.
  - **Thư mục Nhân sự (User & Org Directory Helper API):** API trả về danh sách User khả dụng kèm thông tin chi tiết: Chức danh (`role`/`title`), Phòng ban (`organization.name`, `organization.type`) để phục vụ giao diện gán người duyệt trực quan.
- **Frontend UI (`features/procedure/`):**
  - Màn hình Quản lý danh mục Thủ tục (`/procedures`): Bảng danh sách, tìm kiếm, lọc theo trạng thái/phòng ban, trạng thái version hiệu lực.
  - Màn hình Thiết kế / Cấu hình Thủ tục (`/procedures/builder` hoặc `/procedures/[id]/versions/[versionId]`):
    - Wizard/Tabs 4 bước trực quan:
      1. *Thông tin chung*: Tên, mã, mô tả, phòng ban áp dụng.
      2. *Chọn Form*: Dropdown form + version, xem trước layout thu nhỏ.
      3. *Chọn Workflow*: Dropdown workflow từ Operaton (`category="e-Office"`), xem trước sơ đồ BPMN tương tác.
      4. *Bảng Ánh xạ Tham số & Người duyệt*: Cấu hình chi tiết `var_*` và `actor_*` với Autocomplete User Picker (hiển thị Avatar + Tên + Phòng ban + Chức danh).
    - Hộp kiểm tra hợp lệ (Validation Drawer) và hành động Xuất bản (Publish).

### 3.2. Ngoài phạm vi (Out-of-Scope — Chuyển sang Phase 5 & Phase 6)
- **Tạo và Vận hành Request (Phase 5):** Người trình điền form, xem trước luồng BPMN, đổi người duyệt trên từng request cụ thể, khởi chạy Process Instance trên Operaton.
- **Ký số tài liệu PDF đính kèm (Phase 5):** Ghép ô chữ ký số với danh sách người duyệt thực tế.
- **Quy tắc gán người duyệt động nâng cao (Phase 6):** Tự động suy diễn "Trưởng phòng của người trình", "Kế toán trưởng theo chi nhánh" thông qua cây cấu trúc tổ chức phức tạp. Ở Phase 4 chỉ tập trung gán User cụ thể (`DIRECT_USER`) kèm hiển thị phòng ban/chức danh.

---

## 4. Đối tượng Sử dụng & Trường hợp Sử dụng (Use Cases)

### 4.1. Đối tượng (User Personas)
1. **Quản trị viên Hệ thống / Quản trị viên Quy trình (Admin / Process Owner):**
   - Tạo mới, cấu hình và bảo trì các Thủ tục của công ty.
   - Ghép nối các biểu mẫu đã tạo và các sơ đồ BPMN đã phát hành trên Operaton.
   - Thiết lập người duyệt mặc định cho các phòng ban.
2. **Người trình đơn / Nhân viên (Requester / End-User):**
   - Xem danh sách các thủ tục khả dụng khi bấm "Tạo mới yêu cầu" (ở Phase 5).
   - Được kế thừa toàn bộ cấu hình chuẩn đã được Admin thiết lập sẵn tại Phase 4.

### 4.2. Danh sách Use Cases cốt lõi

| UC ID | Tên Use Case | Mô tả | Tác nhân chính |
|---|---|---|---|
| `UC-PRC-01` | Tạo mới Thủ tục | Tạo bản ghi Thủ tục mới với mã quy chuẩn (vd: `PROC_PURCHASE_01`) và khởi tạo `ProcedureVersion 1 (DRAFT)`. | Admin |
| `UC-PRC-02` | Ghép Form & Workflow | Chọn một `FormVersion` đang có và một `ProcessDefinition` từ Operaton. Hệ thống tự động phân tích BPMN XML để bóc tách danh sách `conditionVariables` và `userTasks`. | Admin |
| `UC-PRC-03` | Cấu hình Ánh xạ Tham số | Với mỗi biến `var_*`, chọn trường `FormField.key` tương ứng, chỉ định kiểu dữ liệu. | Admin |
| `UC-PRC-04` | Cấu hình Người duyệt & Quyền Override | Với mỗi `UserTask`, chọn User mặc định (xem rõ Chức danh + Phòng ban), tích chọn `allowOverride` (cho phép người trình sửa hay bắt buộc cố định). | Admin |
| `UC-PRC-05` | Thẩm định & Xuất bản (Publish) | Hệ thống kiểm tra toàn vẹn mapping. Nếu pass &rarr; Chuyển version thành `PUBLISHED`, ghim cứng liên kết. | Admin |
| `UC-PRC-06` | Nâng cấp Phiên bản (New Version) | Khi có thay đổi biểu mẫu hoặc quy trình, Admin tạo `ProcedureVersion 2 (DRAFT)` từ version 1, chỉnh sửa mapping và publish bản mới mà không ảnh hưởng version cũ. | Admin |

---

## 5. Tiêu chí Chấp thuận (Acceptance Criteria)

1. **Khóa cứng phiên bản (ADR-005):**
   - Mỗi `ProcedureVersion` khi `PUBLISHED` phải lưu snapshot hoặc foreign key trỏ chính xác vào `formVersionId` và `operatonProcessDefinitionId` (hoặc definition key + version).
   - Dữ liệu `ProcedureActorMapping` và `ProcedureVariableMapping` được gắn chặt vào `procedureVersionId`.
2. **Bảo toàn dữ liệu danh bạ người duyệt:**
   - Khi hiển thị chọn người duyệt mặc định, hệ thống phải truy vấn được Phòng ban (`Department`) và Chức danh (`Position`/`Role`) của User từ module `Organization` hoặc hồ sơ người dùng.
3. **Thẩm định chặt chẽ (Zero-Drift Validation):**
   - Không cho phép `Publish` nếu có bất kỳ biến `var_*` nào xuất hiện trong điều kiện rẽ nhánh BPMN mà chưa được gán trường Form tương ứng.
   - Báo lỗi rõ ràng nếu trường Form được map có kiểu dữ liệu không tương thích với biến rẽ nhánh.
4. **Hỗ trợ cờ `allowOverride`:**
   - Mỗi bước duyệt phải lưu rõ cờ `allowOverride` (mặc định `true`), sẵn sàng cho giao diện nộp đơn của Phase 5.
5. **Giao diện chuẩn GAFOOD × RAMP:**
   - Trực quan, hiển thị preview sơ đồ BPMN trực tiếp để Admin vừa nhìn luồng vừa cấu hình người duyệt tương ứng từng node trên sơ đồ.

