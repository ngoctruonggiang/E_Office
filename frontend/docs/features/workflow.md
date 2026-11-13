# Workflow Feature (Operaton & BPMN Modeler)

**Tệp mã nguồn:** `frontend/features/workflow/`  
**Các tuyến đường UI:**
- `/workflows`: Danh sách các quy trình BPMN đã phát hành thuộc nhóm `e-Office`, trạng thái sức khỏe của Operaton Engine.
- `/workflows/designer`: Trình thiết kế quy trình đồ họa Web BPMN Modeler (dựa trên `bpmn-js`).

---

## 1. Cấu trúc Thành phần

```text
frontend/features/workflow/
├── api/
│   └── operaton.ts               # Các hàm fetch API gọi sang /operaton/* (health, definitions, xml, structure, deploy)
├── components/
│   └── WebBpmnModeler.tsx        # Trình thiết kế BPMN kéo-thả trực quan trên canvas Next.js
├── types/
│   └── workflow.ts               # Khai báo TypeScript types cho Process Definition, Tasks, Gateways, Deploy Result
└── index.ts                      # Điểm xuất khẩu chung của feature
```

---

## 2. Tính năng Web BPMN Modeler (`WebBpmnModeler.tsx`)

1. **Khởi tạo Canvas:**
   - Nhúng `bpmn-js/lib/Modeler` client-side, gắn kết phím tắt và hỗ trợ thao tác kéo-thả tiêu chuẩn.
   - Nạp sơ đồ mặc định hoặc file XML có sẵn và tự động căn chỉnh (`zoom('fit-viewport')`).
2. **Palette Tinh gọn:**
   - Tập trung vào các phần tử cốt lõi của quy trình phê duyệt: Bắt đầu (`StartEvent`), Bước duyệt (`UserTask`), Rẽ nhánh điều kiện (`ExclusiveGateway`), Duyệt song song (`ParallelGateway`) và Kết thúc (`EndEvent`).
3. **Bảng Cấu hình Node (Inspector Panel):**
   - Tự động lắng nghe sự kiện `selection.changed`.
   - Cho phép sửa mã bước `id`, tên bước `name`, biến gán `camunda:assignee`, cờ `allowOverride` (cho phép người trình sửa người duyệt) và biểu thức điều kiện `${var_* >= ...}` trên các nhánh rẽ.
4. **Phát hành sang Operaton (Deploy):**
   - Kiểm tra ràng buộc trước khi nộp: bắt buộc có StartEvent, UserTask và EndEvent.
   - Gửi yêu cầu `POST /operaton/deploy` với category `e-Office`.
   - Hiển thị phản hồi Toast thông báo thành công kèm Deployment ID.

