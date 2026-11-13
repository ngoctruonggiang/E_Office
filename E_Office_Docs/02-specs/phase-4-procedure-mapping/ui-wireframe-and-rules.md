# Đặc tả Giao diện & Trải nghiệm Người dùng (UI/UX Spec) — Procedure Module

**Mã tài liệu:** `SPEC-PRC-UI-01`  
**Thuộc Phase:** `Phase 4 — Lớp Cầu nối Procedure`  
**Trạng thái:** `PENDING_REVIEW`  
**Ngày lập:** 13/11/2026  
**Tác giả:** Google DeepMind / Antigravity Agent  
**Tuân thủ:** Chuẩn Thiết kế Doanh nghiệp GAFOOD × RAMP (Tailwind CSS, Lucide Icons, Shadcn UI pattern, Đa ngôn ngữ Việt - Anh).  

---

## 1. Nguyên tắc Thiết kế & Trải nghiệm (Design Principles)

1. **Minh bạch Hai chiều (Bi-directional Visibility):** Người cấu hình vừa thấy sơ đồ BPMN vừa thấy bảng người duyệt và biến rẽ nhánh tương ứng, không phải chuyển qua lại giữa nhiều trang.
2. **Danh bạ Trực quan (Rich User Directory Context):** Khi gán người duyệt, giao diện luôn thể hiện đồng thời 3 thông tin quan trọng: **Họ tên + Chức danh + Phòng ban**. Điều này giúp Admin tránh gán nhầm người khi công ty có nhiều nhân viên trùng tên.
3. **Phản hồi Thẩm định Tức thì (Real-time Validation Feedback):** Khi thiếu mapping hoặc kiểu dữ liệu không khớp, giao diện hiển thị cảnh báo ngay tại dòng vi phạm và trong thanh Drawer kiểm tra, giải thích lý do cụ thể và cách khắc phục.
4. **Bảo vệ Trạng thái Bất biến (Immutability Protection):** Các phiên bản đã `PUBLISHED` hiển thị rõ huy hiệu "Đã xuất bản (Chỉ đọc)". Nút "Chỉnh sửa" sẽ tự động đề xuất "Tạo phiên bản mới (New Draft Version)" thay vì cho phép sửa trực tiếp.

---

## 2. Wireframe Màn hình Quản lý Danh mục Thủ tục (`/procedures`)

### 2.1. Bố cục Tổng thể

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  GAFOOD E-OFFICE  >  Cấu hình  >  Danh mục Thủ tục                                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [icon] Quản lý Thủ tục Doanh nghiệp                                                [ + Tạo Thủ tục ]  │
│  Thiết lập các quy trình giấy tờ, biểu mẫu và luồng phê duyệt chuẩn hóa                                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ 🔍 Tìm kiếm mã hoặc tên thủ tục... ]  [ Phòng ban: Tất cả ▼ ]  [ Trạng thái: Tất cả ▼ ]            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  MÃ THỦ TỤC       TÊN THỦ TỤC            PHÒNG BAN        BIỂU MẪU GẮN KÈM   LUỒNG OPERATON  TRẠNG THÁI│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  PROC_PURCHASE_01 Đề xuất mua sắm thiết bị [Phòng Mua hàng] Đơn mua sắm (v2)  FLOW 1 (v1)     [PUBLISHED]│
│                   └── 4 bước duyệt • 1 biến rẽ nhánh                                   [Sửa nháp] [•••]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  PROC_LEAVE_01    Đơn xin nghỉ phép      [Phòng Nhân sự]  Phiếu nghỉ phép(v1) Quy trình nghỉ  [PUBLISHED]│
│                   └── 2 bước duyệt • 0 biến rẽ nhánh                                   [Sửa nháp] [•••]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  PROC_PAYMENT_01  Đề nghị thanh toán     [Phòng Kế toán]  Đề nghị chi (v3)    Chưa gắn luồng  [ DRAFT ]│
│                   └── Chưa hoàn tất cấu hình                                          [Tiếp tục] [•••]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Hiển thị 1 - 3 của 3 thủ tục                                                    [ < Trang 1 / 1 > ]  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Wireframe Màn hình Thiết kế & Cấu hình Thủ tục (`/procedures/[id]/versions/[versionId]`)

Giao diện cấu hình được tổ chức theo thanh Tabs chuyên sâu 4 bước kết hợp thanh hành động trên đầu:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  GAFOOD E-OFFICE  >  Thủ tục  >  PROC_PURCHASE_01  >  Phiên bản 1 (Bản nháp)                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [icon] Yêu cầu Mua sắm Hàng hóa & Dịch vụ                 [ Lưu nháp ] [ Thẩm định ] [ 🚀 Xuất bản ]  │
│  Mã: PROC_PURCHASE_01 • Bản nháp v1 • Lần sửa cuối: 10 phút trước                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ (1) Thông tin chung ]   [ (2) Form & Workflow ]   [ (3) Ánh xạ Tham số ]   [ (4) Người duyệt (Actors) ]│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Tab 1 — Thông tin Chung
- **Mã thủ tục:** Input text (in hoa, chỉ gồm chữ cái, số và gạch dưới, vd: `PROC_PURCHASE_01`). Bị khóa sau khi đã lưu.
- **Tên thủ tục:** Input text (vd: *Yêu cầu Mua sắm Hàng hóa & Dịch vụ*).
- **Mô tả:** Textarea ghi rõ mục đích, hướng dẫn chung cho nhân viên khi nộp đơn.
- **Đơn vị chủ quản:** Dropdown chọn Phòng ban từ cây Tổ chức (`Organization`).
- **Icon & Màu nhận diện:** Bảng chọn icon (Lucide) và màu sắc (Blue, Green, Purple, Amber, Red).

---

### 3.2. Tab 2 — Chọn Biểu mẫu & Quy trình Operaton
Màn hình chia làm hai cột cân đối (Split View):

```
┌───────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ CỘT TRÁI: CHỌN BIỂU MẪU (FORM ENGINE)         │ CỘT PHẢI: CHỌN QUY TRÌNH (OPERATON BPMN)               │
├───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Biểu mẫu: [ Đơn đề xuất mua sắm thiết bị   ▼ ]│ Quy trình: [ FLOW 1 - Mua sắm hàng hóa (v1)        ▼ ] │
│ Phiên bản: [ Phiên bản 2 (Mới nhất)         ▼ ]│ Định danh: Process_e_office_purchase_flow_1:1         │
│                                               │ Nhóm: e-Office • Ngày deploy: 13/11/2026               │
├───────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Xem trước Biểu mẫu thu nhỏ:                   │ Xem trước Sơ đồ BPMN (nhúng bpmn-js viewer):           │
│ ┌───────────────────────────────────────────┐ │ ┌────────────────────────────────────────────────────┐ │
│ │ Mục đích mua sắm: [                       ]│ │  (O) -> [Kiểm tra] -> { >20tr? } -> [Mua hàng thẩm định]│
│ │ Tổng tiền đề xuất: [                      ]│ │                        └── <=20tr? -> [Kế toán duyệt] │
│ │ Chi tiết danh mục: (Bảng 3 cột)           │ │  ...                                                 │
│ └───────────────────────────────────────────┘ │ └────────────────────────────────────────────────────┘ │
│ [ ↗ Mở trình sửa Form ]                       │ [ ↗ Mở trình vẽ BPMN Modeler ]                         │
└───────────────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

### 3.3. Tab 3 — Ánh xạ Tham số Rẽ nhánh (Variable Mapping)
Bảng tự động liệt kê tất cả các biến rẽ nhánh phát hiện trong BPMN XML và yêu cầu chọn trường tương ứng từ Form:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BẢNG ÁNH XẠ THAM SỐ RẼ NHÁNH CHO OPERATON ENGINE                                                     │
│  Các biến dưới đây được trích xuất từ các Gateway trong BPMN. Vui lòng chọn trường form tương ứng.     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  BIẾN TRONG BPMN      BIỂU THỨC SỬ DỤNG      TRƯỜNG FORM ÁNH XẠ         KIỂU DỮ LIỆU   GIÁ TRỊ DỰ PHÒNG│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  var_amount           ${var_amount > 20tr}   [ tong_tien_de_xuat (Số) ▼ ] [ SỐ (Float) ▼ ] [ 0        ]│
│                                              (Tổng tiền đề xuất)                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  var_is_urgent        ${var_is_urgent==true} [ do_khan_cap (Lựa chọn) ▼ ] [ BOOLEAN    ▼ ] [ false    ]│
│                                              (Mức độ khẩn cấp)                                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4. Tab 4 — Cấu hình Người duyệt & Quyền Override (Actor Mapping)
Bảng liệt kê tất cả các `UserTask` có trong sơ đồ BPMN, cho phép chọn User cụ thể và hiển thị rõ chức danh, phòng ban:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BẢNG CẤU HÌNH NGƯỜI DUYỆT TỪNG BƯỚC                                                                   │
│  Thiết lập người duyệt mặc định và quyết định xem người làm đơn có được phép thay đổi người duyệt không│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ STT  BƯỚC DUYỆT (BPMN TASK)     NGƯỜI DUYỆT MẶC ĐỊNH                    CHO PHÉP SỬA?  BẮT BUỘC?       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1    Bộ phận Mua hàng thẩm định [ 🔍 Tìm người: Mai...              ▼ ] [x] Cho phép   [x] Bắt buộc    │
│      Key: step_review_1         ┌─────────────────────────────────────┐ (Người trình có (Không được bỏ │
│                                 │ [Avatar] Nguyễn Thị Mai             │  thể đổi người)  trống bước này│
│                                 │ Phòng Mua hàng • Chuyên viên Senior │                                │
│                                 │ mai.nt@gafood.vn                    │                                │
│                                 └─────────────────────────────────────┘                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2    Kế toán mua hàng duyệt     [ 🔍 Tìm: Lê Văn Hoàng (Kế toán)    ▼ ] [x] Cho phép   [x] Bắt buộc    │
│      Key: step_review_2         Phòng Kế toán Tài chính • Kế toán viên                                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3    Trưởng phòng phụ trách     [ 🔍 Tìm: Phạm Minh Tuấn (TP)       ▼ ] [x] Cho phép   [x] Bắt buộc    │
│      Key: step_department_head  Khối Vận hành • Trưởng phòng                                           │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4    Tổng Giám đốc phê duyệt    [ 🔍 Tìm: Trần Văn An (TGĐ)         ▼ ] [ ] Cố định    [x] Bắt buộc    │
│      Key: step_final_approver   Ban Giám đốc • Tổng Giám đốc            (Khóa cứng,                    │
│                                                                          không cho đổi)                │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Thanh Kiểm tra & Hộp thoại Xuất bản (Validation Drawer & Publish Modal)

### 4.1. Validation Drawer (Khi bấm "Thẩm định" hoặc bấm "Xuất bản" khi có lỗi)
- Xuất hiện từ cạnh phải màn hình (Slide-over drawer).
- Phân nhóm:
  - ❌ **Lỗi chặn xuất bản (Blocker Errors):**
    - `[step_review_2]`: Chưa gán người duyệt mặc định cho bước bị khóa cố định.
    - `[var_amount]`: Chưa chọn trường form ánh xạ.
  - ⚠️ **Cảnh báo (Warnings):**
    - `[tong_tien_de_xuat]`: Trường form không đánh dấu bắt buộc, khuyến nghị nên đặt giá trị dự phòng.
- Click vào từng mục lỗi sẽ tự động nhảy đến đúng Tab và highlight đỏ trường cần sửa.

### 4.2. Modal Xác nhận Xuất bản (Publish Confirmation)
- Khi toàn bộ kiểm tra đạt chuẩn (`0 Blocker Errors`):
  - Hiển thị hộp thoại tóm tắt:
    - *Tên thủ tục:* Yêu cầu Mua sắm Hàng hóa & Dịch vụ (Phiên bản 1)
    - *Biểu mẫu:* Đơn đề xuất mua sắm (Phiên bản 2)
    - *Quy trình Operaton:* FLOW 1 (Phiên bản 1)
    - *Số bước duyệt:* 4 bước
    - *Số biến rẽ nhánh đã map:* 1 biến (`var_amount`)
  - Cảnh báo: *"Sau khi xuất bản, phiên bản này sẽ trở thành bản hiệu lực chính thức cho toàn bộ nhân viên và không thể sửa đổi cấu hình. Mọi thay đổi sau này sẽ được thực hiện trên phiên bản mới."*
  - Nút: `[ Hủy ]` và `[ Xác nhận Xuất bản ]` (Màu xanh chủ đạo).

