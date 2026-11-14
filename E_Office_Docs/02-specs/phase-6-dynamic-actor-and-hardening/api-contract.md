# Hợp đồng API (API Contract) — Phase 6: Phân giải Tác nhân Động

**Trạng thái:** `APPROVED` (Phase 6 Spec)  
**Tài liệu liên quan:** [dynamic-actor-rules.md](./dynamic-actor-rules.md), [data-model.md](./data-model.md).

---

## 1. Endpoints Hỗ trợ Cấu hình & Phân giải Tác nhân

---

### 1.1 Thử nghiệm Phân giải Tác nhân theo Thủ tục
- **Phương thức:** `POST`
- **Đường dẫn:** `/procedures/versions/:versionId/resolve-actors`
- **Mục đích:** Cho phép Quản trị viên tại màn hình cấu hình Thủ tục hoặc màn hình kiểm thử giả lập việc nộp đơn bởi một User bất kỳ để xem danh sách người duyệt được tự động suy luận ra sao.
- **Quyền truy cập:** Yêu cầu đăng nhập (`JwtAuthGuard`).

#### Yêu cầu (Request Body):
```json
{
  "requestorId": "02698102-2205-4649-9be3-d536335c62c8"
}
```
*(Nếu `requestorId` không truyền, hệ thống mặc định lấy User đang thực hiện request).*

#### Phản hồi Thành công (`200 OK`):
```json
{
  "procedureVersionId": "d918dab3-50ef-4953-aa08-c5677fdff8e1",
  "requestor": {
    "id": "02698102-2205-4649-9be3-d536335c62c8",
    "displayName": "Trần Văn Nhân Viên",
    "department": "Phòng Hành Chính Nhân Sự",
    "title": "Chuyên Viên Hành Chính"
  },
  "resolvedActors": [
    {
      "taskDefinitionKey": "step_review_1",
      "taskName": "Trưởng phòng xét duyệt",
      "order": 1,
      "assigneeType": "DYNAMIC_RULE",
      "ruleType": "DIRECT_MANAGER",
      "user": {
        "id": "c1a93812-3211-4fa2-9381-e83719481230",
        "displayName": "Lê Văn Trưởng Phòng",
        "email": "manager_hr@gafood.local",
        "department": "Phòng Hành Chính Nhân Sự",
        "title": "Trưởng Phòng Hành Chính"
      },
      "isFallback": false,
      "allowOverride": true,
      "required": true
    },
    {
      "taskDefinitionKey": "step_review_2",
      "taskName": "Kế toán thẩm định",
      "order": 2,
      "assigneeType": "DYNAMIC_RULE",
      "ruleType": "DEPARTMENT_TITLE",
      "user": {
        "id": "usr-accountant-003",
        "displayName": "Lê Thị Kế Toán",
        "email": "accountant@gafood.local",
        "department": "Phòng Tài Chính Kế Toán",
        "title": "Kế Toán Trưởng"
      },
      "isFallback": false,
      "allowOverride": false,
      "required": true
    }
  ]
}
```

---

### 1.2 Lấy Danh sách Phòng ban & Chức danh Phục vụ Cấu hình
- **Phương thức:** `GET`
- **Đường dẫn:** `/procedures/helpers/org-titles`
- **Mục đích:** Cung cấp danh mục các Phòng ban hiện có trên cây `Organization` và danh sách các Chức danh (`titles`) đang có trong CSDL để người cấu hình chọn nhanh từ dropdown thay vì phải tự gõ chuỗi text.
- **Quyền truy cập:** Yêu cầu đăng nhập.

#### Phản hồi Thành công (`200 OK`):
```json
{
  "departments": [
    { "id": "org-01", "name": "Ban Giám Đốc" },
    { "id": "org-02", "name": "Phòng Mua Hàng" },
    { "id": "org-03", "name": "Phòng Tài Chính Kế Toán" },
    { "id": "org-04", "name": "Phòng Hành Chính Nhân Sự" }
  ],
  "titles": [
    "Tổng Giám Đốc",
    "Giám Đốc Chuyển Đổi Số",
    "Trưởng Phòng Mua Hàng",
    "Kế Toán Trưởng",
    "Chuyên Viên Hành Chính",
    "Phó Trưởng Phòng"
  ]
}
```

---

### 1.3 Mở rộng Endpoint Xem trước Luồng & Tác nhân (`/requests/preview-flow`)
- **Phương thức:** `POST`
- **Đường dẫn:** `/requests/preview-flow`
- **Tích hợp mới:** Khi giải quyết danh sách `defaultActors` trả về cho Frontend, hệ thống tự động gọi qua `ActorResolverService` để thay thế các bước `assigneeType == 'DYNAMIC_RULE'` bằng User ID thực tế dựa theo `requestorId` của người đang tạo đơn.

