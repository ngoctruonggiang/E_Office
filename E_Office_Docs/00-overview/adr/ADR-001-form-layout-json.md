# ADR-001: Tách Data Schema (EAV) và Layout Schema (JSON) cho Biểu mẫu Linh hoạt

- **Trạng thái:** `APPROVED` (Phase 0)
- **Liên quan:** Phase 2 (`REQ-FRM-01`, `REQ-FRM-02`)
- **Tham chiếu code hiện tại:** [`backend/prisma/schema/form.prisma`](file:///f:/Downloads/Projects/Gafood/E_Office/backend/prisma/schema/form.prisma)

## 1. Bối cảnh
Hiện tại `FormVersion` chỉ lưu danh sách phẳng `fields: FormField[]`, nên giao diện `FormRenderer` và `RequestFormData` chỉ hiển thị 1 cột từ trên xuống dưới. Nhu cầu mới yêu cầu đổi bố cục linh hoạt (nhiều cột, nhóm section, ẩn/hiện có điều kiện, bảng con nhiều dòng, vị trí slot đính kèm) mà **không làm hỏng dữ liệu `FormResponseValue` cũ** và **không ảnh hưởng tới Operaton**.

## 2. Quyết định kiến trúc
1. **Giữ nguyên mô hình lưu dữ liệu EAV (`FormField` + `FormResponseValue`)** cho tầng validation backend và trích xuất tham số gửi sang Operaton (`fieldKey -> value`).
2. **Bổ sung `layoutSchema Json?` trực tiếp trên `FormVersion`**:
   - Chứa cây bố cục JSON gồm: `sections` (tiêu đề, mô tả, collapsible), `rows` / `grid` (`columns: 1..12`, `colSpan` cho từng `fieldKey`), `visibilityRules` (ẩn/hiện trường dựa trên giá trị trường khác), và `documentSlots` (nhãn gợi ý tệp đính kèm).
   - Khi `layoutSchema` là `null` (các form tạo trước Phase 2), frontend tự động fallback về render danh sách dọc 1 cột như cũ -> **tương thích ngược 100%**.
3. **Hỗ trợ Repeater / Bảng con (Phase 2 Spec chốt chi tiết):** Lưu giá trị mảng dòng dưới dạng JSON trong `FormResponseValue.value` (`Json` type đã có sẵn trong PostgreSQL) gắn với `FieldType` mở rộng (vd `TABLE`/`REPEATER`).
4. **Quy tắc tạo `FormVersion` mới:** Thêm `layoutSchema` vào tiêu chí phát hành version khi form đã có `FormResponse` sử dụng, hoặc cho phép sửa layout an toàn nếu các `fieldKey` dữ liệu không đổi (chốt cụ thể trong `Phase 2 Spec`).

## 3. Phương án thay thế đã cân nhắc
- *Nhúng toàn bộ form vào Camunda/Operaton Forms (`form-js`):* Loại bỏ vì vi phạm nguyên tắc tách biệt 2 module — form bên e-Office gắn chặt với chữ ký PDF, EAV search/filter và UI Design System riêng.

## 4. Hệ quả
- Module Form bên `e-Office` hoàn toàn độc lập với `Operaton`; Admin sửa giao diện/sắp cột không đụng tới BPMN.
- `VariableMapping` bên `Procedure` luôn trỏ vào `FormField.key` ổn định, không phụ thuộc vị trí hiển thị trên layout.

