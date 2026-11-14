/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành mã định danh chuẩn snake_case.
 * Ví dụ:
 *  - "Tên hàng hóa / Dịch vụ" -> "ten_hang_hoa_dich_vu"
 *  - "Số lượng (cái)" -> "so_luong_cai"
 *  - "Đơn giá (VNĐ)" -> "don_gia_vnd"
 *  - "Thành tiền" -> "thanh_tien"
 */
export function slugifyVietnamese(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Xóa dấu tiếng Việt
    .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

