# 02 — Cẩm nang Hướng dẫn Dành cho Người Nộp Đơn (Nhân viên)

**Dành cho:** Toàn thể Cán bộ Nhân viên cần khởi tạo đề xuất, tờ trình phê duyệt  
**Mục tiêu:** Hướng dẫn 6 bước từ khi mở máy tính đến khi hồ sơ được nộp và phê duyệt thành công.

---

## Bước 1: Đăng nhập Hệ thống

1. Truy cập vào địa chỉ website E-Office của công ty (Ví dụ: `http://localhost:3000` hoặc tên miền nội bộ).
2. Tại màn hình Đăng nhập:
   * **Cách 1 (Khuyến nghị): Bấm nút "Đăng nhập bằng Keycloak SSO"**  
     Hệ thống sẽ chuyển bạn sang cổng xác thực tập trung của công ty. Bạn chỉ cần nhập email và mật khẩu tài khoản công ty một lần duy nhất.
   * **Cách 2: Đăng nhập bằng Email & Mật khẩu nội bộ e-Office**  
     Nhập địa chỉ Email làm việc và Mật khẩu do quản trị viên cấp, sau đó bấm **"Đăng nhập"**.

---

## Bước 2: Bắt đầu Tạo Hồ sơ Mới từ Thủ tục

1. Tại góc trên bên phải màn hình, bấm nút **"+ Tạo mới"** (hoặc chọn mục **"Tạo bởi tôi"** trên thanh menu trái -> bấm **"Tạo yêu cầu mới"**).
2. Hệ thống sẽ hiển thị danh sách các **Thủ tục hành chính** đang có hiệu lực trong doanh nghiệp (ví dụ: *Đề nghị mua sắm thiết bị*, *Yêu cầu xét hàng tồn kho*, *Xin tạm ứng công tác*...).
3. Bấm chọn vào Thủ tục bạn cần thực hiện. Hệ thống sẽ mở ra giao diện làm việc **Tạo Hồ sơ 5 bước**.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 1: Chọn Thủ tục  ->  BƯỚC 2: Điền Biểu mẫu  ->  BƯỚC 3: Xem Luồng & Người duyệt  ->  GỬI   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Bước 3: Điền Thông tin vào Biểu mẫu Điện tử

Biểu mẫu của e-Office được thiết kế thông minh và tự động điều chỉnh theo những gì bạn nhập:
* **Các ô thông tin cơ bản:** Nhập tiêu đề, ngày tháng, lý do đề xuất, phòng ban.
* **Các trường có dấu sao đỏ (`*`):** Là thông tin bắt buộc, bạn cần điền đầy đủ mới có thể chuyển bước.
* **Bảng kê chi tiết (Bảng lặp con - Repeater):**
  - Nếu thủ tục yêu cầu kê khai nhiều danh mục (như danh sách vật tư mua sắm), bấm nút **"+ Thêm dòng"**.
  - Nhập tên mặt hàng, số lượng, đơn giá. Hệ thống sẽ **tự động tính Thành tiền và Tổng giá trị** mà bạn không cần phải dùng máy tính cầm tay bấm số.
* **Trường ẩn/hiện thông minh:** Khi bạn chọn một mục đặc biệt (ví dụ chọn *"Mua sắm ngoài định mức"*), biểu mẫu sẽ tự động mở thêm ô *"Giải trình kỹ thuật"* để bạn cung cấp thêm thông tin.
* **Đính kèm tài liệu:** Kéo thả các tệp chứng từ, báo giá (PDF, Word, Excel, hình ảnh) vào ô đính kèm tương ứng.

> [!TIP]
> Bạn có thể bấm nút **"Lưu nháp"** ở góc trên bất kỳ lúc nào để lưu lại thông tin đã nhập và quay lại làm tiếp vào ngày hôm sau mà không bị mất dữ liệu.

---

## Bước 4: Xem trước Luồng duyệt & Thay đổi Người duyệt khi cần

Sau khi bấm **"Tiếp tục"**, hệ thống sẽ chuyển bạn sang màn hình **Mô phỏng Luồng duyệt & Người ký thực tế**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SƠ ĐỒ TIẾN TRÌNH DỰ KIẾN (Bên trái)     │ DANH SÁCH NGƯỜI DUYỆT THỰC TẾ (Bên phải)               │
│                                         │                                                        │
│ (O) Người nộp đơn                       │ Bước 1: Xem xét cấp Quản lý                            │
│      │                                  │   👤 Nguyễn Văn Mua Sắm (Trưởng phòng Mua hàng)        │
│      ▼                                  │   ✨ Tự động phân giải: Trưởng phòng trực tiếp của bạn │
│ [Xem xét 1: Trưởng phòng]               │   [Thay đổi]                                           │
│      │                                  │                                                        │
│      ▼                                  │ Bước 2: Kế toán thẩm định                              │
│ < Nhánh giá trị: > 50 triệu >           │   👤 Thị Kế Toán Lê (Kế toán trưởng)                   │
│      │                                  │   ✨ Tự động phân giải: Kế toán trưởng                 │
│      ▼ (Đường viền xanh lá kích hoạt)   │   [Thay đổi]                                           │
│ [Xem xét 2: Ban Giám đốc duyệt]         │                                                        │
└─────────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

1. **Sơ đồ luồng rẽ nhánh tự động:**
   * Hệ thống tự động đọc giá trị bạn vừa nhập ở Bước 3. Nếu tổng tiền vượt hạn mức, hệ thống sẽ tự động bật nhánh màu xanh lá sang cấp duyệt cao hơn mà bạn không cần phải nhớ quy chế công ty.
2. **Hệ thống tự nhận diện người duyệt:**
   * Bạn không cần tự tìm xem Trưởng phòng hay Kế toán trưởng là ai. Hệ thống tự động đọc cơ cấu tổ chức và gán đúng người quản lý trực tiếp của bạn vào danh sách.
3. **Quyền thay đổi người duyệt (Ủy quyền / Thay thế):**
   * Nếu cấp trên của bạn đang đi công tác dài ngày hoặc nghỉ phép, và bước duyệt đó có nút **`[Thay đổi]`**:
   * Bạn bấm vào **`[Thay đổi]`** -> Một hộp tìm kiếm nhân sự sẽ hiện ra -> Chọn nhân sự được ủy quyền thay thế. Hồ sơ sẽ được chuyển tới người này để không bị ách tắc công việc.

---

## Bước 5: Ký số Điện tử & Nộp Hồ sơ

1. Nếu thủ tục yêu cầu người nộp đơn phải ký tên lên văn bản đề xuất:
   * Bấm vào mục **"Ký tài liệu"**.
   * Hệ thống sẽ hiển thị bản vẽ văn bản PDF và vị trí đóng dấu chữ ký của bạn.
   * Chọn Chữ ký mẫu của bạn (đã được lưu trong hồ sơ cá nhân) hoặc vẽ chữ ký trực tiếp bằng chuột/màn hình cảm ứng.
   * Bấm **"Xác nhận Ký"**.
2. Kiểm tra lại toàn bộ thông tin lần cuối tại màn hình **"Xem lại & Hoàn tất"**.
3. Bấm nút **"Nộp đơn (Submit)"**.
   * Hồ sơ sẽ ngay lập tức được gửi vào hòm thư chờ duyệt của người quản lý đầu tiên. Bạn sẽ nhận được thông báo nộp đơn thành công.

---

## Bước 6: Theo dõi và Quản lý Tiến độ Hồ sơ

Bạn có thể theo dõi tiến độ của tất cả các hồ sơ đã nộp tại menu **"Tạo bởi tôi"**:

* 🟢 **Đang xử lý (IN_PROGRESS):** Hồ sơ đang nằm ở bàn của người duyệt nào, hệ thống sẽ hiển thị tên và ảnh đại diện của người đó kèm thời gian chờ.
* 🔵 **Đã phê duyệt hoàn tất (APPROVED):** Hồ sơ đã được duyệt qua tất cả các cấp. Bạn có thể mở ra để tải về tệp PDF chính thức đã có đầy đủ chữ ký số của các sếp.
* 🟠 **Yêu cầu chỉnh sửa (REQUEST_CHANGES):** 
  - Cấp trên trả hồ sơ về kèm lời nhắn (ví dụ: *"Bổ sung thêm 2 bản báo giá cạnh tranh"*).
  - Bạn chỉ cần bấm vào nút **"Chỉnh sửa hồ sơ"**, cập nhật lại thông tin theo yêu cầu và bấm **"Gửi lại"**. Hồ sơ sẽ tiếp tục luồng duyệt mà không phải nộp mới từ đầu.
* ⚪ **Rút hồ sơ / Hủy yêu cầu (CANCELLED):** Nếu bạn không còn nhu cầu nộp đơn, bạn có thể bấm **"Hủy hồ sơ"** khi đơn chưa được duyệt xong.
* 📋 **Nhân bản từ hồ sơ cũ (CLONE):** Nếu bạn cần làm một đề xuất tương tự như tháng trước, chỉ cần mở hồ sơ cũ ra và bấm **"Nhân bản"**. Toàn bộ biểu mẫu sẽ được điền sẵn, bạn chỉ việc chỉnh sửa ngày tháng và số liệu mới rồi gửi đi.

