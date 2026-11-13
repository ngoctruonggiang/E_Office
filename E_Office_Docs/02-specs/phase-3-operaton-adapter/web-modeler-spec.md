# Đặc tả Web BPMN Modeler nhúng trên e-Office (`bpmn-js`)

**Trạng thái:** `APPROVED` (Phase 3)  
**Tài liệu liên quan:** [ui-wireframe-and-rules.md](../phase-2-form-layout-engine/ui-wireframe-and-rules.md), [bpmn-modeling-standards.md](./bpmn-modeling-standards.md), [ADR-006](../../00-overview/adr/ADR-006-operaton-deployment-and-modeler-strategy.md).

---

## 1. Mục tiêu & Trải nghiệm Người dùng (UX Vision)

Module **Web BPMN Modeler** mang lại trải nghiệm "All-in-one" cho Quản trị viên e-Office:
- Không bắt buộc phải tải và cài đặt phần mềm desktop Operaton Modeler.
- Trực tiếp mở tab **"Thiết kế Luồng Quy trình"** ngay trên giao diện web của e-Office (Next.js), vẽ các bước phê duyệt bằng thao tác kéo-thả trực quan trên canvas `bpmn-js`.
- Bấm nút **"Phát hành sang Operaton"**, hệ thống tự động kiểm tra tính hợp lệ của sơ đồ và đẩy trực tiếp lên Operaton Engine qua API `POST /operaton/deploy`.

---

## 2. Bố cục Giao diện (GAFOOD × RAMP Design Rules)

Màn hình Web Modeler được tổ chức thành 3 khu vực chính:

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [<- Quay lại]  Tên: [Quy trình Yêu cầu Mua sắm (FLOW 1)]  [Nhóm: e-Office]  [Tải XML] [Phát hành ^] │
├───────────────────────────────┬───────────────────────────────────────┬───────────────────────────────┤
│ Palette (Công cụ vẽ)          │ Canvas Thiết kế BPMN (`bpmn-js`)      │ Inspector (Cấu hình Node)     │
│                               │                                       │                               │
│ (O) Bắt đầu (Start Event)     │   (O)                                 │ ── Thuộc tính Bước Duyệt ──── │
│ [ ] Bước duyệt (User Task)    │    │                                  │ Tên bước: [Xem xét 1]         │
│ <X> Rẽ nhánh điều kiện (XOR)  │   <X> ──── [Xem xét 1]                │ Mã bước:  step_review_1       │
│ <+> Duyệt song song (AND)     │    │                                  │ Biến gán: actor_step_review_1 │
│ (*) Kết thúc (End Event)      │   [Trưởng phòng]                      │ [x] Cho phép người trình sửa  │
│                               │    │                                  │ [ ] Duyệt song song (Multi)   │
│                               │   (*)                                 │                               │
│                               │                                       │ ── Điều kiện Rẽ nhánh ─────── │
│                               │                                       │ Biểu thức:                    │
│                               │                                       │ [ ${var_amount >= 50000000} ] │
└───────────────────────────────┴───────────────────────────────────────┴───────────────────────────────┘
```

### 2.1 Thanh Công cụ Trên (Header Bar)
- **Nút Quay lại:** Trở về danh sách quy trình.
- **Tên quy trình:** Input cho phép sửa trực tiếp tiêu đề quy trình.
- **Huy hiệu Nhóm (Category Badge):** Hiển thị `e-Office` (cố định để đảm bảo tính phân nhóm).
- **Bộ nút Hành động:**
  - *Nhập XML*: Mở file `.bpmn` hoặc dán code XML.
  - *Tải XML*: Tải file `.bpmn` về máy tính.
  - *Phát hành sang Operaton*: Nút hành động chính (`variant="primary"`), thực hiện kiểm tra và gửi deploy.

### 2.2 Palette Công cụ Rút gọn (Simplified Palette)
Để người dùng không bị choáng ngợp bởi hàng trăm ký hiệu kỹ thuật của BPMN, Palette trên web e-Office được **tinh gọn tập trung đúng vào nghiệp vụ trình ký văn phòng**:
1. **Start Event (Sự kiện Bắt đầu):** Đại diện cho người trình nộp đơn.
2. **User Task (Bước Phê duyệt):** Bước duyệt/ký của nhân sự.
3. **Exclusive Gateway (Cổng Rẽ nhánh XOR):** Đánh giá điều kiện biến để rẽ nhánh.
4. **Parallel Gateway (Cổng Phê duyệt Song song AND):** Mở đồng thời nhiều bước duyệt độc lập.
5. **End Event (Sự kiện Kết thúc):** Hoàn thành quy trình hoặc từ chối.

### 2.3 Bảng Cấu hình Thuộc tính (Inspector Panel)
Tự động thay đổi nội dung theo node đang được chọn trên Canvas:
- **Khi chọn `UserTask`:**
  - `Tên bước`: Nhãn hiển thị cho người dùng (ví dụ: *Xem xét 1 - Ban Tài chính*).
  - `Mã bước (ID)`: Chuỗi duy nhất dạng `step_<name>`, tự động sinh nếu để trống.
  - `Biến tác nhân (Assignee)`: Mặc định tự động điền `actor_<id>`.
  - `Cho phép người trình thay đổi người duyệt`: Checkbox toggle (ghi vào extension property `allowOverride`).
  - `Duyệt song song nhiều người`: Checkbox toggle (chuyển node thành Multi-instance với biến `actorList_<id>`).
- **Khi chọn `Sequence Flow` đi ra từ Gateway:**
  - `Tên nhánh`: Ví dụ *Từ 50 triệu trở lên*.
  - `Biểu thức điều kiện (UEL Expression)`: Ô nhập biểu thức, ví dụ `${var_amount >= 50000000}`. Có sẵn danh sách gợi ý biến nhanh.

---

## 3. Quy tắc Kiểm chuẩn Trước khi Phát hành (Pre-Deploy Validation)

Trước khi gửi file BPMN XML sang Operaton Engine, Frontend thực hiện kiểm tra nhanh:
1. **Bắt buộc có ít nhất 1 `StartEvent` và 1 `EndEvent`**.
2. **Không có Node bị cô lập:** Mọi `UserTask` và `Gateway` phải có ít nhất 1 đường luồng nối vào (incoming) và 1 đường luồng nối ra (outgoing).
3. **Mọi `UserTask` đều phải có ID và Tên:** Không để ID trống hoặc trùng lặp.
4. **Các nhánh của `Exclusive Gateway` phải có điều kiện:** Ngoại trừ nhánh mặc định (Default flow).

Nếu vi phạm, hiển thị thông báo lỗi đỏ dạng Toast/Banner chỉ rõ node vi phạm để người dùng sửa trước khi bấm phát hành.

---

## 4. Bản địa hóa Đa ngôn ngữ (i18n Keys)

Bổ sung vào `frontend/lib/i18n/locales/vi.ts` và `en.ts`:
- `workflow.modeler.title`: "Thiết kế Luồng Quy trình" / "Workflow Modeler"
- `workflow.modeler.deploy`: "Phát hành sang Operaton" / "Deploy to Operaton"
- `workflow.modeler.deploySuccess`: "Phát hành quy trình thành công" / "Process deployed successfully"
- `workflow.modeler.importXml`: "Nhập tệp BPMN" / "Import BPMN"
- `workflow.modeler.exportXml`: "Tải tệp BPMN" / "Export BPMN"
- `workflow.modeler.taskName`: "Tên bước duyệt" / "Task Name"
- `workflow.modeler.taskKey`: "Mã bước" / "Task Key"
- `workflow.modeler.allowOverride`: "Cho phép người trình đổi người duyệt" / "Allow requestor override"
- `workflow.modeler.isMultiInstance`: "Duyệt song song nhiều người" / "Parallel multi-approver"
- `workflow.modeler.conditionExpr`: "Biểu thức điều kiện" / "Condition Expression"

