# 04 — Cẩm nang Hướng dẫn Dành cho Quản trị viên & Cán bộ Quy trình

**Dành cho:** Quản trị viên hệ thống (Admin), Cán bộ Pháp chế - Hành chính, Process Owner  
**Mục tiêu:** Hướng dẫn 4 năng lực quản trị cốt lõi: Thiết lập cơ cấu tổ chức, thiết kế biểu mẫu động kéo-thả, vẽ luồng quy trình nghiệp vụ BPMN và xuất bản Thủ tục hành chính.

---

## 1. Quản lý Cơ cấu Tổ chức & Phân nhiệm (Organization & HR)

Trước khi thiết lập bất kỳ quy trình nào, hệ thống cần biết cấu trúc phòng ban và ai là người đứng đầu mỗi đơn vị.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  🏢 QUẢN LÝ TỔ CHỨC (Cây Cơ cấu Phòng ban Doanh nghiệp)                         [+ Thêm đơn vị]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ BAN TỔNG GIÁM ĐỐC                                      (Quản lý: Quản Trị Viên Hệ Thống)        │
│    ├── 📁 Phòng Hành Chính Nhân Sự                      (Quản lý: Trần Văn Nhân Viên)            │
│    ├── 📁 Phòng Tài Chính Kế Toán                       (Quản lý: Lê Thị Kế Toán)                │
│    └── ▼ Khối Vận Hành & Chuỗi Cung Ứng                                                          │
│           ├── 📁 Phòng Mua Hàng                         (Quản lý: Nguyễn Văn Mua Sắm)            │
│           └── 📁 Phòng Quản Lý Kho Vận                  (Quản lý: Phạm Văn Thủ Kho)              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Thao tác thực hiện:
1. Vào menu **"Tổ chức"** trên thanh điều hướng bên trái.
2. **Thêm phòng ban mới:** Bấm **"+ Thêm đơn vị"**, nhập Tên phòng ban và chọn Đơn vị cấp trên (Parent Unit) để tạo cây phân cấp hình nhánh.
3. **Bổ nhiệm Trưởng phòng (Manager):**
   - Bấm vào phòng ban -> Chọn tab **"Nhân sự"**.
   - Tại dòng nhân sự phụ trách, chọn vai trò là **`Quản lý (Manager)`**.
   - *Lưu ý quan trọng:* Việc bổ nhiệm vai trò Quản lý này sẽ giúp tính năng **Phân giải Trưởng phòng tự động** ở các bước duyệt hoạt động chuẩn xác 100%.
4. **Cập nhật Chức danh (Job Title):**
   - Vào menu **"Tài khoản"** -> Chọn nhân sự cần sửa -> Cập nhật chức danh chuẩn (Ví dụ: *"Kế Toán Trưởng"*, *"Giám Đốc Vận Hành"*).

---

## 2. Thiết kế Biểu mẫu Động (Form Builder)

Biểu mẫu được thiết kế trực quan thông qua công cụ kéo-thả hiện đại, không cần viết code:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ THIẾT KẾ BIỂU MẪU: Đề nghị Mua sắm (Phiên bản 1)                           [Lưu nháp] [Xem trước]│
├──────────────────────┬───────────────────────────────────────────┬───────────────────────────────┤
│ 1. KHO TRƯỜNG DỮ LIỆU│ 2. VÙNG THIẾT KẾ (CANVAS TRUNG TÂM)       │ 3. CẤU HÌNH THUỘC TÍNH        │
│                      │                                           │                               │
│ [T] Chữ ngắn (Text)  │ ┌───────────────────────────────────────┐ │ Tên trường:                   │
│ [#] Con số (Number)  │ │ PHẦN 1: THÔNG TIN CHUNG (2 cột)       │ │ [ Tổng giá trị đề nghị      ] │
│ [v] Danh mục (Select)│ │ [ Tiêu đề đề xuất   ] [ Phòng ban   ] │ │                               │
│ [d] Ngày tháng (Date)│ └───────────────────────────────────────┘ │ Mã tham số (Key):             │
│ [田] Bảng con (Table)│ ┌───────────────────────────────────────┐ │ [ tong_gia_tri              ] │
│ [📎] Đính kèm tệp    │ │ PHẦN 2: BẢNG KÊ VẬT TƯ (Bảng lặp con) │ │                               │
│                      │ │ [Tên hàng] [SL] [Đơn giá] [Thành tiền]│ │ [x] Bắt buộc nhập             │
│                      │ └───────────────────────────────────────┘ │ [x] Tự động tính tổng (SUM)   │
└──────────────────────┴───────────────────────────────────────────┴───────────────────────────────┘
```

1. **Tạo phần (Section) & Chia cột (Grid):**
   - Kéo khối **Section** vào giữa trang để tạo nhóm thông tin (ví dụ: *Thông tin chung*, *Chi tiết đề xuất*).
   - Chọn chia 2 cột, 3 cột hoặc 4 cột tùy theo độ dài của thông tin.
2. **Cấu hình Bảng con chi tiết (Sub-table / Repeater):**
   - Kéo khối **Bảng con** vào canvas.
   - Thêm các cột: *Tên mặt hàng (Text)*, *Số lượng (Number)*, *Đơn giá (Number)*.
   - Bật tính năng **"Tính tổng tự động (SUM)"** cho cột Thành tiền.
3. **Quy tắc Ẩn/Hiện thông minh (Conditional Visibility):**
   - Chọn một trường -> Tại bảng thuộc tính bên phải, chọn mục **"Điều kiện hiển thị"**.
   - Thiết lập điều kiện: *"Chỉ hiện ô 'Giải trình kỹ thuật' khi trường 'Loại mua sắm' = 'Ngoài định mức'"*.

---

## 3. Thiết kế Luồng Quy trình Trực quan (BPMN Modeler)

e-Office tích hợp sẵn công cụ vẽ quy trình chuẩn quốc tế BPMN 2.0 trực tiếp trên trình duyệt web:

1. Vào menu **"Luồng quy trình (BPMN)"** -> Bấm **"+ Thiết kế Luồng mới"**.
2. **Các ký hiệu chuẩn bạn sử dụng:**
   * ⚪ **Hình tròn viền mỏng (Start Event):** Điểm khởi đầu quy trình (khi người dùng bấm nộp đơn).
   * 👤 **Hình chữ nhật bo tròn có hình người (User Task):** Một bước phê duyệt của con người (ví dụ: *Trưởng phòng xem xét*, *Kế toán duyệt*).
   * 🔶 **Hình thoi có dấu X (Exclusive Gateway):** Điểm rẽ nhánh điều kiện (ví dụ: rẽ nhánh theo số tiền > 50 triệu hoặc <= 50 triệu).
   * 🟢 **Hình tròn viền đậm (End Event):** Điểm kết thúc quy trình (Hồ sơ hoàn tất phê duyệt).
3. **Phát hành sang Động cơ quy trình:**
   - Sau khi vẽ và đặt tên các bước xong, bấm nút xanh lá **"Phát hành sang Operaton"** ở góc trên. Luồng quy trình sẽ được đóng gói và sẵn sàng để ghép vào Thủ tục.

---

## 4. Thiết lập Thủ tục Hành chính Hoàn chỉnh (Procedure Builder)

Đây là bước quan trọng nhất kết nối toàn bộ hệ thống lại với nhau. Vào menu **"Thủ tục (Procedures)"** -> Chọn hoặc tạo mới Thủ tục -> Mở trình thiết kế 4 bước:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  THIẾT LẬP THỦ TỤC: Yêu cầu xét hàng tồn kho                                [Thẩm định] [Xuất bản]│
├────────────────────┬────────────────────┬────────────────────────────┬───────────────────────────┤
│ 1. Thông tin chung │ 2. Form & Workflow │ 3. Ánh xạ Tham số (Params) │ 4. Người duyệt (Actors)   │
└────────────────────┴────────────────────┴────────────────────────────┴───────────────────────────┘
```

* **Bước 1 — Thông tin chung:** Đặt Mã thủ tục (viết hoa, không dấu, ví dụ: `PROC_STORE_1`), Tên thủ tục, Mô tả tóm tắt, chọn Biểu tượng và Màu sắc nhận diện.
* **Bước 2 — Ghép Biểu mẫu & Luồng duyệt:** Chọn Biểu mẫu đã tạo ở mục 2 và Sơ đồ quy trình đã vẽ ở mục 3.
* **Bước 3 — Ánh xạ Tham số rẽ nhánh (Variable Mapping):**
  - Ghép trường dữ liệu của Biểu mẫu với biến điều kiện của Quy trình (Ví dụ: Biểu mẫu có trường `tong_gia_tri` -> Ánh xạ sang biến điều kiện `var_tong_tien` trên BPMN để hệ thống tự động rẽ nhánh).
* **Bước 4 — Cấu hình Người duyệt Từng bước (Actor Assignment - Tính năng mới Phase 6):**
  - Đối với mỗi bước duyệt trên sơ đồ, bạn có 2 lựa chọn:
    1. **Chỉ định đích danh User:** Gõ tìm và gán cứng một cá nhân cụ thể.
    2. **Quy tắc động (Khuyến nghị):**
       - `Trưởng phòng trực tiếp (DIRECT_MANAGER)`: Hệ thống sẽ tự tìm Quản lý trực tiếp của người nộp đơn khi chạy thực tế.
       - `Chức danh theo phòng ban (DEPARTMENT_TITLE)`: Ví dụ chọn Phòng: *"Phòng Tài Chính Kế Toán"* và Chức danh: *"Kế Toán Trưởng"*.
  - **Chiến lược khi khuyết người (Fallback):** Chọn *"Tự động chuyển lên Quản lý cấp trên"* để đảm bảo hồ sơ không bao giờ bị nghẽn nếu vị trí đó tạm thời trống.
  - **Nút "Thử nghiệm phân giải":** Bấm nút này để hệ thống tính toán thử ngay xem nếu bạn nộp đơn thì hồ sơ sẽ chạy tới tay ai.

### 5. Thẩm định & Xuất bản (Publishing)
1. Bấm nút **"Thẩm định"** ở góc trên bên phải: Hệ thống sẽ tự động chạy 9 quy tắc kiểm tra (đã map đủ biến chưa, các bước duyệt có người phụ trách chưa...).
2. Nếu thẩm định báo thành công (màu xanh), bấm nút **"Xuất bản (Publish)"**.
3. Thủ tục sẽ chính thức xuất hiện trên danh mục toàn công ty để mọi nhân viên có thể sử dụng. Phiên bản này sẽ được ghim an toàn vĩnh viễn.

