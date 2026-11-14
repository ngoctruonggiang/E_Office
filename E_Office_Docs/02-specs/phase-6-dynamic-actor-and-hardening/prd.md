# PRD — Phase 6: Gán Tác nhân Động (Phòng ban / Chức danh) & E2E Hardening

**Trạng thái:** `APPROVED` (Phase 6 Spec)  
**Phụ trách:** AI Coordinator & Người dùng  
**Tài liệu liên quan:** [01-vision-and-3-pillars.md](../../00-overview/01-vision-and-3-pillars.md), [03-roadmap-phases.md](../../00-overview/03-roadmap-phases.md), [04-traceability-matrix.md](../../00-overview/04-traceability-matrix.md), [dynamic-actor-rules.md](./dynamic-actor-rules.md).

---

## 1. Bối cảnh & Mục tiêu

Sau khi hoàn thành Phase 1 đến Phase 5, hệ thống e-Office đã sở hữu:
- Hệ thống Định danh Keycloak IAM đồng bộ đầy đủ Họ tên, Phòng ban, Chức danh (Phase 1).
- Trình thiết kế biểu mẫu Form Layout đa cột, section, bảng repeater (Phase 2).
- Bộ máy điều phối BPMN 2.0 Operaton Engine độc lập qua Docker (Phase 3).
- Lớp cấu hình Thủ tục kết nối Form + Workflow + Ánh xạ biến (Phase 4).
- Luồng nộp đơn Run-time, xem trước nhánh rẽ BPMN, người trình override người duyệt, và ký số PDF (Phase 5).

Tuy nhiên, ở Phase 4 & 5, người duyệt mặc định trong Thủ tục đang được cấu hình **cố định đích danh từng cá nhân** (`assigneeType: 'DIRECT_USER'`, ví dụ: gán cứng cho *Ông Nguyễn Văn Mua Sắm*). Trong môi trường doanh nghiệp thực tế:
- Khi một thủ tục chung áp dụng cho toàn công ty (như *Đơn xin nghỉ phép*, *Đề xuất mua sắm thiết bị*), bước duyệt đầu tiên luôn phải là **"Trưởng phòng trực tiếp của người nộp đơn"**. Nếu gán cứng 1 người, nhân viên phòng Kế toán nộp đơn cũng bị chuyển sang Trưởng phòng Mua hàng.
- Bước duyệt thẩm định kỹ thuật hoặc tài chính cần được gán cho **"Người giữ chức danh Kế toán trưởng tại Phòng Kế toán"** thay vì gán tên cụ thể, để khi có biến động nhân sự (thay đổi người giữ chức danh), thủ tục không bị lỗi thời.

### Mục tiêu cốt lõi của Phase 6:
1. **Thiết lập Bộ máy Phân giải Tác nhân Động (`ActorResolverService`):** Tự động suy luận người duyệt thực tế theo cây tổ chức `Organization` và thuộc tính chức danh `title` từ Keycloak/DB.
2. **Hỗ trợ 3 Loại Quy tắc Động:**
   - `DIRECT_MANAGER`: Tự động tìm Trưởng phòng / Quản lý trực tiếp của người nộp đơn.
   - `DEPARTMENT_TITLE`: Tìm người giữ Chức danh cụ thể tại Phòng ban xác định (ví dụ: *Kế toán trưởng* tại *Phòng Tài Chính Kế Toán*).
   - `REQUESTOR_DEPT_TITLE`: Tìm người giữ Chức danh xác định tại **chính phòng ban của người nộp đơn** (ví dụ: *Phó phòng* cùng phòng ban).
3. **Cơ chế Dự phòng Không bế tắc (Zero-Deadlock Fallback Strategy):** Khi một vị trí bị khuyết người (phòng ban chưa có trưởng phòng, hoặc người giữ chức danh nghỉ việc), hệ thống tự động leo lên cấp cha (`PARENT_MANAGER`) hoặc chuyển tiếp cho người dự phòng được chỉ định trước (`SPECIFIC_USER`).
4. **Bảo tồn Quyền Override của Người trình (ADR-003):** Người trình vẫn có thể xem trước người duyệt được tự động suy luận và linh hoạt thay thế/bổ sung người duyệt nếu bước duyệt cho phép `allowOverride`.
5. **E2E Hardening & Đồng bộ Toàn diện:** Rà soát kiểm thử hồi quy toàn bộ hệ thống, kiểm tra tải và bảo mật, cập nhật đồ thị kiến trúc tri thức qua `graphify`.

---

## 2. Phạm vi Nghiệp vụ & Ranh giới (Scope & Boundaries)

### 2.1 Trong phạm vi Phase 6
- **Backend:**
  - Khai báo chi tiết cấu hình JSON `ruleConfig` trên model `ProcedureActorMapping` trong `procedure.prisma`.
  - Triển khai `ActorResolverService`: giải quyết tác nhân động dựa trên `Organization`, `OrganizationMember.role = 'manager'`, và `User.title`.
  - Tích hợp `ActorResolverService` vào luồng `POST /requests/preview-flow` và `POST /requests` khi tạo đơn mới.
  - Endpoint `POST /procedures/versions/:versionId/resolve-actors` để kiểm tra thử nghiệm việc giải quyết tác nhân ngay trong màn hình cấu hình.
- **Frontend:**
  - Nâng cấp `ActorMappingTab.tsx` trong `ProcedureBuilder`: cho phép chọn giữa **"Chỉ định đích danh User"** và **"Quy tắc động"** (Trưởng phòng trực tiếp, Chức danh theo phòng ban).
  - Bổ sung cấu hình Fallback cho từng bước duyệt động.
  - Cập nhật màn hình nộp đơn `CreateRequestWizard` / `FlowPreviewAndActorStep`: hiển thị rõ nhãn nguồn gốc của người duyệt (ví dụ: *"Trần Văn Nhân Viên &rarr; Tự động giải quyết: Trưởng phòng trực tiếp"*).
- **Hệ thống & Tài liệu:**
  - Full E2E Test Suite kiểm thử kịch bản duyệt theo quy tắc động.
  - Cập nhật ma trận truy vết [04-traceability-matrix.md](../../00-overview/04-traceability-matrix.md).

---

## 3. Chân dung Người dùng & User Stories

### US-DYN-01: Chuyên viên quy trình cấu hình duyệt theo Trưởng phòng trực tiếp
> **Là một** Người thiết lập thủ tục (Procedure Designer),  
> **Tôi muốn** tại bước 1 của thủ tục mua sắm chọn quy tắc "Trưởng phòng trực tiếp của người trình",  
> **Để** mọi nhân viên từ bất kỳ phòng ban nào khi nộp đơn đều tự động chuyển đơn cho đúng cấp quản lý của mình mà tôi không phải tạo hàng chục thủ tục riêng cho từng phòng.

### US-DYN-02: Chuyên viên quy trình cấu hình duyệt theo Chức danh chuyên trách
> **Là một** Người thiết lập thủ tục,  
> **Tôi muốn** tại bước 2 chọn quy tắc "Người giữ chức danh Kế toán trưởng tại Phòng Tài Chính Kế Toán",  
> **Để** hồ sơ luôn được gửi đúng tới người có thẩm quyền tài chính mà không bị phụ thuộc vào ID của một nhân sự cụ thể.

### US-DYN-03: Nhân viên nộp đơn thấy rõ người duyệt được tự động gán
> **Là một** Nhân viên nộp đơn (Requestor),  
> **Tôi muốn** khi chọn thủ tục và xem trước luồng phê duyệt, hệ thống tự động điền sẵn tên Trưởng phòng của tôi kèm nhãn chú thích rõ ràng,  
> **Để** tôi an tâm biết hồ sơ sẽ đi đúng người mà không cần phải tự tra cứu danh bạ.

### US-DYN-04: Hệ thống tự động kích hoạt cơ chế dự phòng khi khuyết vị trí
> **Là một** Quản trị hệ thống,  
> **Tôi muốn** khi một phòng ban mới thành lập chưa bổ nhiệm trưởng phòng, hệ thống tự động chuyển đơn lên Trưởng đơn vị cấp trên (Parent Manager),  
> **Để** quy trình phê duyệt không bao giờ bị nghẽn (deadlock) hoặc đứng im vô thời hạn.

### US-DYN-05: Toàn bộ hệ thống được thẩm định E2E vững chắc
> **Là một** Lãnh đạo doanh nghiệp,  
> **Tôi muốn** toàn bộ chuỗi mắt xích từ Form Layout, BPMN Modeler, Procedure Mapping, Keycloak IAM, Ký số PDF đến Quy tắc động được kiểm thử khép kín,  
> **Để** đảm bảo hệ thống e-Office sẵn sàng đưa vào vận hành thực tế tại doanh nghiệp.

---

## 4. Tiêu chí Chấp thuận (Acceptance Criteria)

- [ ] **AC-DYN-01:** Admin cấu hình được quy tắc `DIRECT_MANAGER` và `DEPARTMENT_TITLE` kèm chiến lược Fallback trong Tab "Người duyệt" của `ProcedureBuilder`.
- [ ] **AC-DYN-02:** Khi nhân viên thuộc Phòng Mua hàng nộp đơn, hệ thống tự động gán đúng Trưởng phòng Mua hàng làm người duyệt bước 1.
- [ ] **AC-DYN-03:** Khi nhân viên thuộc Phòng Kế toán nộp đơn cho cùng thủ tục, hệ thống tự động gán đúng Kế toán trưởng làm người duyệt bước 1.
- [ ] **AC-DYN-04:** Trường hợp phòng ban khuyết Manager, cơ chế Fallback `PARENT_MANAGER` tự động chuyển tiếp lên Manager của đơn vị cấp trên.
- [ ] **AC-DYN-05:** Người nộp đơn có thể đổi người duyệt nếu bước duyệt bật `allowOverride: true`.
- [ ] **AC-DYN-06:** 100% test case trong Test Plan pass, `npm run build` trên cả Backend và Frontend pass với 0 lỗi.

