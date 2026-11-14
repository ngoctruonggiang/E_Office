# 03 — Cẩm nang Hướng dẫn Dành cho Người Phê Duyệt (Cấp Quản lý & Lãnh đạo)

**Dành cho:** Trưởng/Phó phòng ban, Kế toán trưởng, Giám đốc khối, Ban Giám đốc  
**Mục tiêu:** Hướng dẫn cách xử lý công việc nhanh chóng, thẩm định nội dung tờ trình, ký số điện tử trên PDF và ra quyết định phê duyệt chỉ trong vài cú nhấp chuột.

---

## 1. Hộp thư Xử lý: "Công việc của tôi" (My Duty List)

Mọi hồ sơ từ cấp dưới gửi lên hoặc từ các phòng ban chuyển sang cần bạn ký duyệt sẽ tự động hội tụ về menu **"Công việc của tôi"**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  📥 CÔNG VIỆC CỦA TÔI (3 hồ sơ đang chờ bạn duyệt)                       [🔍 Tìm kiếm]  [Lọc v]  │
├────┬─────────────────────────────┬───────────────────────────┬──────────────┬────────────┬───────┤
│STT │ TÊN HỒ SƠ / TỜ TRÌNH        │ NGƯỜI TRÌNH               │ BƯỚC DUYỆT   │ NGÀY GỬI   │THAO TÁC│
├────┼─────────────────────────────┼───────────────────────────┼──────────────┼────────────┼───────┤
│ 01 │ Đề nghị mua 05 màn hình Dell│ Trần Văn Nhân Viên (Hành c.)│ Xem xét 1    │ 10:15 Hôm nay│[Xử lý]│
│ 02 │ Xét duyệt giải quyết tồn kho│ Nguyễn Văn Mua Sắm (Kho)  │ Kế toán thẩm định│Hôm qua   │[Xử lý]│
│ 03 │ Tạm ứng công tác phí Cần Thơ│ Lê Thị Thu (Kinh doanh)   │ Duyệt cấp quản lý│12/11/2026 │[Xử lý]│
└────┴─────────────────────────────┴───────────────────────────┴──────────────┴────────────┴───────┘
```

* **Thông báo tức thời (Real-time Notifications):** Mỗi khi có một tờ trình mới được gửi tới bạn, biểu tượng quả chuông 🔔 ở góc trên màn hình sẽ sáng đèn kèm thông báo đẩy.
* **Bộ lọc thông minh:** Bạn có thể lọc nhanh danh sách theo Thủ tục, theo độ ưu tiên khẩn cấp hoặc theo khoảng thời gian gửi đơn.

---

## 2. Giao diện Thẩm định Hồ sơ Thông minh (Smart Split-Screen)

Khi bạn bấm nút **[Xử lý]** vào một hồ sơ cụ thể, hệ thống sẽ mở ra giao diện làm việc chia đôi màn hình tối ưu:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [<- Quay lại]  Hồ sơ: #REQ-2026-089 — Đề nghị mua 05 màn hình Dell              Trạng thái: CHỜ DUYỆT│
├──────────────────────────────────────┬───────────────────────────────────────────────────────────┤
│ CỘT TRÁI: TIẾN TRÌNH & TÁC NHÂN      │ CỘT PHẢI: DỮ LIỆU BIỂU MẪU & CHỨNG TỪ                    │
│                                      │                                                           │
│ 1. Sơ đồ Luồng duyệt trực quan:      │ 1. Thông tin chung:                                       │
│    [Trần Văn Nhân Viên] (Nộp đơn)    │    • Lý do: Bổ sung trang thiết bị làm việc cho team Dev │
│             │                        │    • Phòng ban: Phòng Công Nghệ Thông Tin                 │
│             ▼                        │                                                           │
│    [ĐANG CHỜ BẠN DUYỆT]              │ 2. Bảng kê chi tiết vật tư:                               │
│             │                        │    ┌───┬────────────────┬────┬──────────┬───────────┐    │
│             ▼                        │    │STT│ Tên mặt hàng   │ SL │ Đơn giá  │ Thành tiền│    │
│    [Kế toán thẩm định]               │    ├───┼────────────────┼────┼──────────┼───────────┤    │
│             │                        │    │ 1 │ Màn hình Dell  │ 05 │ 4.500.000│ 22.500.000│    │
│             ▼                        │    └───┴────────────────┴────┴──────────┴───────────┘    │
│    [Hoàn thành phê duyệt]            │    => TỔNG CỘNG: 22.500.000 VNĐ                           │
│                                      │                                                           │
│ 2. Lịch sử duyệt của các cấp trước:  │ 3. Chứng từ đính kèm (3 tệp PDF):                         │
│    • 09:30: Trần Văn Nhân Viên nộp   │    [📄 Bao_gia_1.pdf]  [📄 Bao_gia_2.pdf]                 │
└──────────────────────────────────────┴───────────────────────────────────────────────────────────┘
```

1. **Cột bên trái:** Cho bạn biết tờ trình này đang nằm ở bước nào, ai đã duyệt trước đó, và bước tiếp theo sẽ chuyển cho ai.
2. **Cột bên phải:** Thể hiện toàn bộ nội dung biểu mẫu, số liệu tính toán tự động và các tệp tài liệu đính kèm. Bạn có thể bấm trực tiếp vào tệp PDF để xem trước ngay trên trình duyệt mà không cần tải về máy tính.

---

## 3. Ba Quyết định Phê duyệt Nghiệp vụ

Ở góc dưới màn hình, bạn luôn có 3 nút bấm tác vụ rõ ràng:

```
                                [❌ TỪ CHỐI]   [⚠️ YÊU CẦU CHỈNH SỬA]   [✅ PHÊ DUYỆT & KÝ SỐ]
```

### Lựa chọn 1: ✅ Phê duyệt & Ký số Điện tử (Approve & Sign)
Áp dụng khi hồ sơ đầy đủ căn cứ và bạn đồng ý thông qua đề xuất:
1. Bấm nút **"Phê duyệt & Ký số"**.
2. Một cửa sổ **Ký số Văn bản Điện tử** sẽ hiện ra:
   * Hệ thống hiển thị bản xem trước của tài liệu PDF chính thức kèm vị trí ô ký tên của bạn.
   * Chọn Chữ ký mẫu của bạn (đã lưu sẵn) hoặc vẽ trực tiếp chữ ký vào khung.
   * Bấm **"Xác nhận Ký"**.
3. **Quy trình tự động hóa:**
   * Hình ảnh chữ ký của bạn sẽ được nhúng cố định vào tệp PDF có gắn kèm dấu thời gian điện tử (Timestamp).
   * Hệ thống tự động chuyển tiếp hồ sơ sang cấp duyệt tiếp theo trong quy trình BPMN mà bạn không cần phải làm thêm bất kỳ thao tác nào khác.

---

### Lựa chọn 2: ⚠️ Yêu cầu Chỉnh sửa (Request Changes)
Áp dụng khi bạn thấy hồ sơ có tiềm năng được duyệt nhưng số liệu chưa chuẩn, thiếu báo giá cạnh tranh hoặc cần bổ sung tài liệu giải trình:
1. Bấm nút **"Yêu cầu chỉnh sửa"**.
2. Một hộp thoại ghi chú sẽ xuất hiện:
   * Nhập hướng dẫn cụ thể của bạn (Ví dụ: *"Vui lòng đính kèm thêm biên bản khảo sát hiện trạng và cập nhật lại đơn giá sau thuế"*).
3. Bấm **"Gửi yêu cầu"**:
   * Hồ sơ sẽ ngay lập tức được trả về hộp thư của Người nộp đơn.
   * Người nộp đơn sẽ nhận được thông báo kèm nguyên văn lời dặn dò của bạn để vào sửa đổi và nộp lại.

---

### Lựa chọn 3: ❌ Từ chối Hồ sơ (Reject)
Áp dụng khi đề xuất không phù hợp với chủ trương của công ty, vượt quá ngân sách hoặc không được chấp thuận:
1. Bấm nút **"Từ chối"**.
2. Nhập lý do từ chối rõ ràng để nhân viên nắm được nguyên nhân (Ví dụ: *"Kế hoạch chi tiêu quý này đã hết hạn mức"*).
3. Bấm **"Xác nhận Từ chối"**:
   * Tiến trình phê duyệt sẽ kết thúc ngay lập tức. Hồ sơ được lưu trữ ở trạng thái `REJECTED` để làm căn cứ tra cứu lịch sử sau này.

---

## 4. Giá trị Pháp lý & Tính Bảo mật của Chữ ký Số

* **Chống chối bỏ (Non-repudiation):** Mỗi chữ ký số điện tử trên hệ thống Gafood E-Office đều gắn liền với tài khoản đăng nhập định danh duy nhất của cá nhân người duyệt, địa chỉ mạng IP và dấu vết thời gian chuẩn xác đến từng giây.
* **Bảo vệ toàn vẹn văn bản:** Tệp PDF sau khi được các cấp ký duyệt hoàn tất sẽ được khóa chỉnh sửa, đảm bảo không một ai có thể sửa đổi nội dung văn bản sau khi các sếp đã đặt bút ký.

