# Phase 2 UI Spec — Form Builder, Form Renderer & Pinned Request View

**Trạng thái:** `APPROVED` (Phase 2 — đã duyệt để code Lượt B)  
**Requirement IDs:** `REQ-FRM-01`, `REQ-FRM-02`  
**Design System chuẩn:** GAFOOD × RAMP (`frontend/app/globals.css`, `frontend/components/ui/*`)

---

## 1. Quy ước Design System & Component tái sử dụng

- Toàn bộ UI Phase 2 **BẮT BUỘC** sử dụng primitive components từ `frontend/components/ui/`: `Button`, `Input`, `Select`, `Textarea`, `Field`, `Card`, `Badge`, `EmptyState`, `Skeleton`, `ConfirmDialog`, `Tabs` (hoặc segmented toggle chuẩn `bg-surface-secondary` / `bg-primary`).
- **Xóa bỏ hoàn toàn màu cứng** (`border-black/15`, `text-red-500`, `bg-gray-*`) trong `FormFieldRenderer.tsx` và các component form builder cũ, thay bằng CSS semantic tokens: `border-border`, `text-destructive`, `bg-surface`, `bg-surface-secondary`, `bg-highlight-muted`, `text-primary`.

---

## 2. Màn hình 1: `FormBuilderScreen` (Nâng cấp Trình thiết kế Biểu mẫu & Layout)

**Vị trí code:** `frontend/features/forms/components/builder/FormBuilderScreen.tsx` và các sub-components trong `builder/`.

### 2.1. Bố cục 3 cột + Chế độ Xem trước trực tiếp (Wireframe ASCII)

```text
+---------------------------------------------------------------------------------------------------+
| [< Quay lại]  [Input: Tên biểu mẫu (Đề nghị mua sắm...)]   [Design | Live Preview]   [Hủy] [Lưu] |
+--------------------+---------------------------------------------+--------------------------------+
| PALETTE & OUTLINE  | CANVAS (12-COL GRID hoặc LIVE PREVIEW)      | INSPECTOR                      |
| (w-64 / 260px)     | (minmax(0, 1fr))                            | (w-88 / 360px)                 |
|                    |                                             |                                |
| + Thêm Section     | +-----------------------------------------+ | [Section / Field / Layout]     |
|                    | | § 1. Thông tin chung    [Ẩn/hiện] [Up/Dn] | |                                |
| Khối dữ liệu:      | | +------------+ +------------+ +----------+| | Tab: [Dữ liệu] [Bố cục & ĐK] |
| [+ Văn bản (TEXT)] | | |Loại [4/12] | |Ngày [4/12] | |Bộ phận   || | - Nhãn (Label)                 |
| [+ Số (NUMBER)]    | | |            | |            | |[4/12]    || | - Mã biến (fieldKey)           |
| [+ Ngày (DATE)]    | | +------------+ +------------+ +----------+| | - Bắt buộc [x]                 |
| [+ Lựa chọn]       | | [+ Thêm hàng mới vào Section]             | | - Chiều rộng: [3][4][6][8][12] |
| [+ Bảng con TABLE] | +-----------------------------------------+ | - Cho phép chỉ đọc (readOnly)  |
|                    |                                             | - Điều kiện hiển thị (nếu có): |
| Khối trang trí:    | +-----------------------------------------+ |   Mode: (Tất cả / Bất kỳ)      |
| [+ Tiêu đề phụ]    | | § 2. Danh sách hạng mục                 | |   [fieldKey] [op] [value]      |
| [+ Đường kẻ]       | | +--------------------------------------+ | |   [+ Thêm điều kiện]           |
| [+ Nhắc đính kèm]  | | | [Bảng con: hang_muc_mua (12/12)]     | | |                                |
|                    | | | Cột: Tên hàng | SL | Thành tiền      | | | (Nếu type=TABLE: TableColumn   |
| Cấu trúc nhanh:    | | +--------------------------------------+ | |  Editor + min/maxRows + SUM)   |
| - Sec 1 (3 fields) | | [+ Tổng giá trị 6/12] [+ Đính kèm 6/12] | |                                |
| - Sec 2 (3 items)  | +-----------------------------------------+ |                                |
+--------------------+---------------------------------------------+--------------------------------+
```

### 2.2. Quy tắc tương tác trên Form Builder
1. **Quản lý Section & Row:**
   - Cho phép thêm Section mới, đổi tên/mô tả Section, di chuyển Section lên/xuống, xóa Section (nếu Section còn field thì hỏi xác nhận hoặc chuyển field vào Section khác/unassigned).
   - Mỗi Row tối đa `12` cột. Khi bấm thêm item vào Row:
     - Nếu khoảng trống còn lại trên Row đang chọn `>= colSpan` mặc định -> chèn vào Row đó; nếu không đủ chỗ -> tự động tạo Row mới ngay bên dưới trong cùng Section!
   - Trên mỗi ô Item ở Canvas: hiển thị nút tăng/giảm nhanh độ rộng **`3 | 4 | 6 | 8 | 12`**, nút di chuyển lên/xuống giữa các Row/Section, icon khóa (nếu `readOnly`), badge **`Có ĐK`** (nếu có `visibleWhen`), và nút xóa.
2. **Inspector Tab 1 (`Dữ liệu & Validate`):**
   - Dùng cho `LayoutFieldItem`: cấu hình `label`, `key`, `required`, và thuộc tính theo `type`:
     - `TEXT`/`NUMBER`/`DATE`/`SELECT`: giữ đầy đủ cấu hình hiện có của `FieldConfigPanel.tsx`.
     - **`TABLE` (`TableConfigEditor`):**
       - Danh sách cột: thêm/xóa/sắp xếp cột (`key`, `label`, `type: TEXT|NUMBER|DATE|SELECT`, `required`, `min`/`max`/`maxLength`, `options` cho cột `SELECT`).
       - Ràng buộc dòng: `minRows`, `maxRows`, `addRowLabel`, checkbox `showRowNumber`.
       - Tổng hợp (`summary`): chọn cột `NUMBER` cần `SUM` hoặc `COUNT`, và optional chọn `targetFieldKey` (dropdown lọc chỉ các field `type === 'NUMBER'` khác trong form!).
   - Dùng cho `Heading` / `Divider` / `AttachmentSlot`: cấu hình `text`/`subtitle` hoặc `slotKey`, `label`, `description`, `targetSection` (`MAIN` / `SECONDARY`), `required`, `acceptMimeTypes`.
3. **Inspector Tab 2 (`Bố cục & Điều kiện`):**
   - Áp dụng cho cả Section lẫn Item:
     - Chọn `colSpan` (`3`, `4`, `6`, `8`, `12` — tự vô hiệu hóa các mức làm tổng Row > 12 hoặc gợi ý tách sang hàng mới).
     - `helpText` & `readOnly` (với Field).
     - **`VisibilityRuleEditor`**: chọn `mode` (`Tất cả điều kiện (AND)` / `Bất kỳ điều kiện (OR)`), thêm/xóa từng dòng `{ fieldKey, op, value }`. Danh sách `fieldKey` nguồn tự động lọc **loại bỏ chính field đang cấu hình và các field tạo chu trình** để tránh cycle ngay trên UI!
4. **Chế độ `Live Preview`:**
   - Render ngay `<FormRenderer />` với state nhập thử cục bộ (`previewValues`) để admin test điều kiện ẩn/hiện, cộng tổng `TABLE`, và responsive 12 cột ngay trong Builder mà chưa cần bấm Lưu.
5. **Cảnh báo Version Fork khi Lưu (nếu đang sửa Form cũ):**
   - Hiển thị banner thông tin nhẹ nếu sửa cấu trúc có thể tạo phiên bản mới cho các đơn tạo sau, không ảnh hưởng đơn cũ.

---

## 3. Màn hình 2: `FormRenderer` & `TableFieldRenderer` (Runtime Nhập liệu)

**Vị trí code:** `frontend/features/forms/components/FormRenderer.tsx`, `FormFieldRenderer.tsx`, `TableFieldRenderer.tsx` (mới).

### 3.1. Responsive Grid & Conditional Evaluation
- Tự động chuẩn hóa layout bằng `normalizeLayoutSchema(form.name, form.fields, form.layoutSchema)`.
- Tại mỗi render cycle, tính map `visibleMap` cho từng Section và từng Item bằng `evaluateVisibility(ruleGroup, values)`.
- Section bị ẩn (`!sectionVisible`): **không render** trên DOM (ẩn hoàn toàn cả Section).
- CSS Grid:
  - Mỗi `LayoutRow` render `<div className="grid grid-cols-1 gap-4 md:grid-cols-12">`.
  - Trên mobile (`< md`): mọi item chiếm 100% chiều rộng (`col-span-1`).
  - Trên `md+`: map tường minh static class lookup `COL_SPAN_CLASS[item.colSpan]` (`md:col-span-1` .. `md:col-span-12`) để Tailwind v4 JIT scan được 100% class names (KHÔNG dùng template string động `md:col-span-${n}`!).
- **Cập nhật tự động `TABLE` -> `targetFieldKey`:**
  - Khi user sửa/thêm/xóa dòng trong field `TABLE`, nếu có `summary.aggregates` gắn `targetFieldKey`, `FormRenderer` tính ngay tổng mới và cập nhật đồng thời cả giá trị bảng lẫn giá trị `targetFieldKey` trong cùng state update (tránh chênh lệch 1 render frame).
  - Input của `targetFieldKey` tự động ở trạng thái `readOnly` kèm chú thích `"Tự động tổng hợp"`.

### 3.2. `TableFieldRenderer` (Giao diện Bảng con)
- Bảng chuẩn GAFOOD × RAMP: header nền `bg-surface-secondary`, viền `border-border`, cuộn ngang `overflow-x-auto` trên màn hình nhỏ (`min-w-[640px]` khi nhiều cột).
- Cột `STT` (nếu `showRowNumber`), các cột dữ liệu dùng `Input` / `Select` nhỏ gọn (`size="sm"`), cột thao tác xóa dòng ở cuối.
- Nếu dòng/cột có lỗi validation: highlight viền đỏ `border-destructive` và hiện thông báo lỗi ngay dưới ô hoặc dưới bảng.
- Dòng Footer (nếu có `summary.aggregates`): hiển thị nhãn tổng và giá trị format số theo locale (`1.250.000`).
- Nút **`+ {addRowLabel || "Thêm dòng"}`**: disable kèm tooltip khi `rows.length >= maxRows`; nút xóa từng dòng disable khi `rows.length <= minRows`.

### 3.3. `LayoutAttachmentSlotItem` trong Runtime
- Hiển thị thẻ nhắc nhẹ nhàng (`border-dashed border-border bg-surface-secondary/50`) với:
  - Badge phân loại mục đính kèm (`Tài liệu chính` cho `MAIN` hoặc `Tài liệu phụ` cho `SECONDARY`).
  - Nhãn `label`, mô tả `description`, và badge `Bắt buộc` nếu `required: true`.
  - Mục đích: hướng dẫn người trình tải đúng file ở bước **Đính kèm tài liệu** trong `CreateRequestWizard` (nếu Wizard truyền `attachedSummary` xuống `FormRenderer`, hiển thị thêm trạng thái `Đã có X tài liệu ở mục này` / `Chưa có tài liệu`).

---

## 4. Màn hình 3: `RequestFormData` (Xem chi tiết & Sửa DRAFT theo Pinned Version)

**Vị trí code:** `frontend/features/requests/components/RequestFormData.tsx`

1. **Version Pinning (`REQ-FRM-01`, `ADR-005`):**
   - Đổi props / hook sang sử dụng **`formVersionId`**: gọi `useFormVersion(formVersionId)` (`GET /forms/versions/:versionId`) thay vì `useFormDefinition(formId)`.
   - Nếu caller cũ chưa truyền `formVersionId` (fallback phòng thủ), mới fallback sang `useFormDefinition(formId)`.
2. **Chế độ Read-Only (xem chi tiết đơn ở `RequestDetailScreen`):**
   - Áp dụng `normalizeLayoutSchema` + `evaluateVisibility(..., valueMap)`: **chỉ hiển thị những Section & Field đang ở trạng thái hiển thị** đối với giá trị đã lưu (không làm rối người duyệt bằng các câu hỏi điều kiện không áp dụng!).
   - Hiển thị theo đúng Grid 12 cột (`md:col-span-*`) dưới dạng cặp `label` + giá trị sắc nét, phân nhóm rõ theo Section.
   - Với trường `TABLE`: render bảng read-only đầy đủ cột + dòng tổng `summary` ở footer (nếu bảng rỗng hiển thị `"Không có dòng dữ liệu"`).
   - Hiển thị nhãn nhỏ `Phiên bản biểu mẫu v{form.version}` ở tiêu đề card để minh bạch kiểm toán.
3. **Chế độ Edit (`DRAFT`):**
   - Render `<FormRenderer form={form} ... />` với chính `form` lấy từ `useFormVersion(formVersionId)`, đảm bảo sửa đơn nháp luôn khớp version lúc tạo đơn.

---

## 5. Trạng thái Bắt buộc (UI State Checklist)

| Trạng thái | Form Builder | FormRenderer / RequestFormData |
|---|---|---|
| **Loading** | Skeleton 3 cột (Palette + Canvas + Inspector) | Skeleton card + lưới 2 hàng giả lập |
| **Empty** | `EmptyState` trên Canvas: "Kéo hoặc chọn khối bên trái để bắt đầu thiết kế" | Nếu form không có field nào visible: `EmptyState` mô tả rõ; bảng `TABLE` 0 dòng hiện nút "+ Thêm dòng" |
| **Error** | Banner lỗi validation ngay trên đầu Canvas (cuộn tới mục lỗi) + highlight Inspector | Inline error theo từng `fieldKey` hoặc `[fieldKey][rowIndex][columnKey]`; lỗi tải form hiện banner + nút "Thử lại" |
| **Disabled / ReadOnly** | Khóa nút Lưu khi đang submit; disable option chọn cycle trong Visibility Editor | `readOnly` cho trường `targetFieldKey` hoặc item đánh dấu `readOnly`; khóa nút thêm/xóa dòng khi chạm `minRows`/`maxRows` |
| **Responsive** | `< lg`: Palette & Inspector xếp tab hoặc drawer gọn; `lg+`: 3 cột cố định | `< md`: tất cả item tự gộp 1 cột (`col-span-1`); `TABLE` hỗ trợ `overflow-x-auto` |

---

## 6. Bộ khóa i18n mới (`frontend/lib/i18n/locales/vi.ts` & `en.ts`)

| Key | Tiếng Việt (`vi`) | Tiếng Anh (`en`) |
|---|---|---|
| `fieldType.TABLE` | Bảng dữ liệu (Lặp dòng) | Table (Repeater) |
| `formBuilder.designTab` | Thiết kế bố cục | Layout Design |
| `formBuilder.previewTab` | Xem trước trực tiếp | Live Preview |
| `formBuilder.addSection` | Thêm nhóm thông tin | Add Section |
| `formBuilder.sectionTitle` | Tiêu đề nhóm | Section Title |
| `formBuilder.addRow` | Thêm hàng mới | Add Row |
| `formBuilder.colSpan` | Độ rộng cột (hệ 12) | Column Width (12-grid) |
| `formBuilder.headingBlock` | Tiêu đề phụ | Subheading |
| `formBuilder.dividerBlock` | Đường kẻ phân cách | Divider |
| `formBuilder.attachmentSlotBlock` | Vị trí nhắc đính kèm | Attachment Slot |
| `formBuilder.tabData` | Dữ liệu & Kiểm tra | Data & Validation |
| `formBuilder.tabLayout` | Bố cục & Điều kiện | Layout & Conditions |
| `formBuilder.visibilityTitle` | Điều kiện hiển thị | Conditional Visibility |
| `formBuilder.visibilityAll` | Thỏa mãn TẤT CẢ điều kiện | Match ALL rules |
| `formBuilder.visibilityAny` | Thỏa mãn BẤT KỲ điều kiện nào | Match ANY rule |
| `formBuilder.addCondition` | Thêm điều kiện | Add Condition |
| `formBuilder.tableColumns` | Danh sách cột bảng | Table Columns |
| `formBuilder.addColumn` | Thêm cột | Add Column |
| `formBuilder.minRows` | Số dòng tối thiểu | Min Rows |
| `formBuilder.maxRows` | Số dòng tối đa | Max Rows |
| `formBuilder.summaryRollup` | Tự động cộng tổng vào trường | Auto-aggregate into field |
| `formBuilder.slotSection` | Nhóm tài liệu đích | Target Document Section |
| `formBuilder.slotMain` | Tài liệu chính | Main Document |
| `formBuilder.slotSecondary` | Tài liệu phụ | Supporting Document |
| `formRenderer.addTableRow` | Thêm dòng | Add row |
| `formRenderer.autoComputed` | Tự động tính | Auto-computed |
| `formRenderer.attachmentHint` | Gợi ý đính kèm tài liệu | Attachment guidance |
| `requestDetail.formVersionBadge` | Biểu mẫu v{version} | Form v{version} |

