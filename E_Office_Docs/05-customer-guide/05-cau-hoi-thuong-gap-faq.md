# 05 — Câu hỏi Thường gặp & Xử lý Tình huống (FAQ & Troubleshooting)

**Dành cho:** Toàn thể Người dùng Gafood E-Office  
**Mục tiêu:** Giải đáp nhanh các băn khoăn phổ biến nhất trong quá trình sử dụng và hướng dẫn cách xử lý sự cố thường gặp.

---

### Câu 1: Tôi quên mật khẩu đăng nhập thì phải làm thế nào?
* **Nếu bạn sử dụng tài khoản công ty SSO:** Bấm vào liên kết *"Quên mật khẩu"* tại cổng đăng nhập Keycloak để hệ thống gửi liên kết đặt lại mật khẩu về email công ty của bạn, hoặc liên hệ Bộ phận IT/Hành chính để được hỗ trợ cấp lại mật khẩu.
* **Nếu bạn sử dụng tài khoản nội bộ e-Office:** Liên hệ Quản trị viên hệ thống để được cấp lại mật khẩu mới trong menu *Quản lý Tài khoản*.

---

### Câu 2: Tại sao tôi đã điền biểu mẫu nhưng nút "Tiếp tục" hoặc "Nộp đơn" bị mờ, không bấm được?
Hiện tượng này thường do một trong các nguyên nhân sau:
1. **Chưa điền đủ các trường bắt buộc:** Hãy rà soát lại các ô có dấu sao đỏ (`*`). Nếu bạn bỏ trống, hệ thống sẽ đánh dấu viền đỏ cảnh báo.
2. **Tệp đính kèm đang trong quá trình tải lên:** Nếu bạn đính kèm tệp PDF hoặc ảnh có dung lượng lớn, hãy đợi thanh tiến trình tải tệp đạt 100% trước khi bấm tiếp tục.
3. **Chưa ký số tài liệu:** Nếu thủ tục yêu cầu bắt buộc người trình phải ký tên lên văn bản điện tử trước khi gửi, hãy mở mục *Ký tài liệu* và xác nhận chữ ký của mình.

---

### Câu 3: Tôi là Trưởng phòng, khi tôi tự nộp đơn xin mua sắm hoặc nghỉ phép thì tôi có tự duyệt cho mình được không?
**Không.** Hệ thống Gafood E-Office được trang bị tính năng **Chống tự phê duyệt (Self-Approval Prevention)**:
* Khi bạn là Trưởng phòng nộp đơn, hệ thống sẽ tự động nhận diện và **không cho phép bạn tự duyệt bước của chính mình**.
* Bước duyệt sẽ tự động được chuyển lên **Quản lý cấp trên** của bạn (ví dụ: Giám đốc khối hoặc Tổng Giám đốc) để đảm bảo tính minh bạch và tuân thủ quy chế kiểm soát nội bộ của doanh nghiệp.

---

### Câu 4: Nếu Trưởng phòng tôi đang đi công tác hoặc nghỉ phép dài ngày, làm thế nào để tờ trình không bị ách tắc?
Hệ thống cung cấp cơ chế **Ủy quyền / Thay đổi người duyệt linh hoạt (`allowOverride`)**:
* Tại **Bước 4 (Xem Luồng duyệt & Người ký)** trước khi gửi đơn, bạn sẽ thấy danh sách những người sẽ duyệt.
* Nếu bước duyệt đó cho phép thay đổi, bạn sẽ thấy nút **`[Thay đổi]`** màu tím bên cạnh tên Trưởng phòng.
* Bấm vào nút **`[Thay đổi]`** và chọn nhân sự được ủy quyền tạm thời (ví dụ: Phó phòng hoặc người phụ trách thay thế). Tờ trình sẽ được gửi trực tiếp tới người này để giải quyết kịp thời.

---

### Câu 5: Khi cấp trên bấm "Yêu cầu chỉnh sửa", tôi có phải làm lại tờ trình mới từ đầu không?
**Hoàn toàn không.** 
* Hồ sơ của bạn sẽ chuyển sang trạng thái màu cam **`Yêu cầu chỉnh sửa (REQUEST_CHANGES)`** và nằm trong mục *"Tạo bởi tôi"*.
* Bạn chỉ việc bấm vào hồ sơ -> Bấm nút **"Chỉnh sửa hồ sơ"**. Toàn bộ số liệu bạn đã điền trước đây vẫn còn nguyên vẹn.
* Bạn chỉ cần đọc ghi chú của cấp trên (ví dụ: *"Bổ sung thêm 1 báo giá"*), sửa lại ô thông tin tương ứng, tải thêm tài liệu và bấm **"Gửi lại"**. Hồ sơ sẽ tiếp tục quy trình duyệt bình thường.

---

### Câu 6: Tôi có thể tái sử dụng lại tờ trình của tháng trước mà không cần nhập lại từ đầu không?
**Có.** Hệ thống hỗ trợ tính năng **Nhân bản hồ sơ (CLONE)**:
* Vào menu **"Tạo bởi tôi"** -> Mở tờ trình cũ bạn muốn dùng lại.
* Bấm nút **"Nhân bản"** ở góc trên màn hình.
* Hệ thống sẽ tự động tạo một bản thảo mới với toàn bộ nội dung, bảng con chi tiết được điền sẵn giống hệt bản cũ. Bạn chỉ cần sửa lại số liệu mới, ngày tháng mới rồi bấm gửi đi.

---

### Câu 7: Văn bản và Chữ ký số trên hệ thống e-Office có giá trị pháp lý nội bộ ra sao?
* Chữ ký số trên hệ thống Gafood E-Office gắn liền với tài khoản định danh cá nhân của mỗi nhân sự, có ghi nhận địa chỉ mạng IP và mộc thời gian điện tử (Timestamp).
* Khi văn bản đã được hoàn tất ký duyệt bởi các cấp có thẩm quyền, tệp PDF chính thức sẽ được khóa toàn vẹn và có giá trị pháp lý thực thi tương đương với văn bản giấy đóng dấu tay truyền thống theo Quy chế Văn phòng điện tử của doanh nghiệp.

---

### Câu 8: Khi nộp đơn, hệ thống báo lỗi: "Không thể phân giải người duyệt phù hợp", tôi phải làm gì?
Lỗi này thường xảy ra khi:
1. Bạn là nhân viên mới và tài khoản của bạn chưa được Admin xếp vào phòng ban cụ thể nào.
2. Hoặc phòng ban của bạn hiện tại chưa được bổ nhiệm vị trí Trưởng phòng (`role = 'manager'`).

**Cách xử lý:** Bạn chỉ cần thông báo cho **Bộ phận Quản trị / Nhân sự (HR)** để cập nhật phòng ban và chức danh của bạn trên cây tổ chức. Sau đó bạn có thể nộp lại hồ sơ bình thường.

