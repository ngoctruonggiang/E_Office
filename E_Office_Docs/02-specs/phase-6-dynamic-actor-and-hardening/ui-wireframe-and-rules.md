# Đặc tả Giao diện & Quy tắc Tương tác (UI Wireframe & Rules) — Phase 6

**Trạng thái:** `APPROVED` (Phase 6 Spec)  
**Tài liệu liên quan:** [prd.md](./prd.md), [dynamic-actor-rules.md](./dynamic-actor-rules.md).

---

## 1. Màn hình Cấu hình Tác nhân Thủ tục (`ActorMappingTab.tsx`)

Vị trí: Tab thứ 4 "Người duyệt (Actors)" trên màn hình [ProcedureBuilder](file:///f:/Downloads/Projects/Gafood/E_Office/frontend/features/procedure/components/ProcedureBuilder/index.tsx).

### 1.1 Wireframe Hàng Cấu hình Bước Duyệt

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STT: 1  | Bước duyệt: Xem xét 1 (BPMN Key: step_review_1)                                         │
│                                                                                                  │
│ [X] Chỉ định đích danh User         (•) Quy tắc gán động theo Tổ chức / Chức danh                │
│ ──────────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                                  │
│  Loại quy tắc động:                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ [v] Trưởng phòng / Quản lý trực tiếp của người nộp đơn (DIRECT_MANAGER)                      │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
│  Chiến lược khi khuyết người (Fallback):                                                         │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ [v] Tự động chuyển lên Quản lý cấp trên (PARENT_MANAGER)                                    │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
│  [x] Cho phép người trình sửa người duyệt (allowOverride)    [x] Bước bắt buộc (required)        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Khi chọn "Chức danh theo phòng ban xác định" (`DEPARTMENT_TITLE`):
```
  Loại quy tắc động: [ Chức danh theo phòng ban xác định ]
  
  Phòng ban phụ trách:                        Chức danh nghiệp vụ:
  ┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
  │ [v] Phòng Tài Chính Kế Toán         │     │ [v] Kế Toán Trưởng                  │
  └─────────────────────────────────────┘     └─────────────────────────────────────┘
```

---

### 1.2 Nhãn Trực quan & Huy hiệu Trạng thái (Badges)

Tại bảng danh sách bước duyệt, mỗi hàng hiển thị huy hiệu màu sắc tương ứng:
- **Xanh lá (`bg-emerald-50 text-emerald-700`):** `[Đích danh: Nguyễn Văn Mua Sắm]`
- **Tím (`bg-purple-50 text-purple-700`):** `[Động: Trưởng phòng trực tiếp]`
- **Xanh dương (`bg-blue-50 text-blue-700`):** `[Động: Kế Toán Trưởng • Phòng Tài Chính Kế Toán]`

---

## 2. Màn hình Xem trước & Nộp đơn (`FlowPreviewAndActorStep.tsx`)

Khi người dùng nộp đơn tại [CreateRequestWizard](file:///f:/Downloads/Projects/Gafood/E_Office/frontend/features/requests/components/CreateRequestWizard.tsx):

### 2.1 Hiển thị Bước duyệt được Phân giải Tự động
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Bước 1: Xem xét 1                                                                                │
│                                                                                                  │
│  (Avatar)  Nguyễn Văn Mua Sắm                                            [Đổi người duyệt]       │
│            Phòng Mua Hàng • Trưởng Phòng Mua Hàng                                                │
│            ✨ Tự động phân giải: Trưởng phòng trực tiếp của bạn                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```
1. Người nộp đơn nhìn thấy rõ:
   - Tên của Trưởng phòng mình kèm Chức danh và Phòng ban.
   - Dòng chú thích màu tím có biểu tượng ngôi sao: `✨ Tự động phân giải: Trưởng phòng trực tiếp của bạn`.
2. Nếu bước duyệt cho phép `allowOverride: true`, người nộp đơn có thể bấm `[Đổi người duyệt]` để chọn nhân sự khác thay thế (ví dụ khi Trưởng phòng đang đi công tác dài ngày).

