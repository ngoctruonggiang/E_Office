# Hợp đồng Giao diện Lập trình (API Contract) — Module Thủ tục (Procedure)

**Mã tài liệu:** `SPEC-PRC-API-01`  
**Thuộc Phase:** `Phase 4 — Lớp Cầu nối Procedure`  
**Trạng thái:** `PENDING_REVIEW`  
**Ngày lập:** 13/11/2026  
**Tác giả:** Google DeepMind / Antigravity Agent  
**Base URL:** `/api/v1/procedures`  
**Xác thực & Phân quyền:** Bearer JWT (Roles: `ADMIN`, `SUPER_ADMIN` cho các API quản trị; `USER` chỉ đọc danh mục đã `PUBLISHED`).  

---

## 1. Danh sách Điểm cuối (Endpoints Overview)

| Phương thức | Đường dẫn URL | Quyền hạn | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/procedures` | `USER`, `ADMIN` | Lấy danh sách thủ tục (phân trang, tìm kiếm, lọc theo phòng ban) |
| `GET` | `/api/v1/procedures/:id` | `USER`, `ADMIN` | Lấy chi tiết thông tin thủ tục kèm phiên bản hiệu lực |
| `POST` | `/api/v1/procedures` | `ADMIN` | Tạo mới một thủ tục kèm phiên bản nháp (`Version 1 DRAFT`) |
| `PATCH` | `/api/v1/procedures/:id` | `ADMIN` | Cập nhật thông tin chung của thủ tục (tên, mô tả, icon, màu, phòng ban) |
| `DELETE`| `/api/v1/procedures/:id` | `ADMIN` | Xóa thủ tục (chỉ cho phép khi chưa có yêu cầu nào sử dụng) |
| `GET` | `/api/v1/procedures/:id/versions` | `ADMIN` | Lấy lịch sử tất cả các phiên bản của một thủ tục |
| `GET` | `/api/v1/procedures/versions/:versionId` | `USER`, `ADMIN` | Lấy chi tiết toàn bộ cấu hình của một phiên bản thủ tục |
| `POST` | `/api/v1/procedures/:id/draft` | `ADMIN` | Tạo phiên bản nháp mới (nhân bản từ phiên bản hiện tại) |
| `PUT` | `/api/v1/procedures/versions/:versionId` | `ADMIN` | Cập nhật cấu hình liên kết Form, Workflow, Actor & Variable Mappings |
| `POST` | `/api/v1/procedures/versions/:versionId/validate` | `ADMIN` | Chạy bộ thẩm định toàn vẹn trước khi phát hành |
| `POST` | `/api/v1/procedures/versions/:versionId/publish` | `ADMIN` | Phát hành chính thức phiên bản thủ tục (chuyển sang `PUBLISHED`) |
| `GET` | `/api/v1/procedures/helpers/directory` | `ADMIN` | Lấy danh bạ người dùng kèm Phòng ban & Chức danh để gán người duyệt |
| `GET` | `/api/v1/procedures/helpers/forms` | `ADMIN` | Lấy danh sách Biểu mẫu và các phiên bản khả dụng |
| `GET` | `/api/v1/procedures/helpers/workflows` | `ADMIN` | Lấy danh sách Quy trình Operaton thuộc nhóm `category="e-Office"` |

---

## 2. Chi tiết Đặc tả các Điểm cuối API

### 2.1. `GET /api/v1/procedures`
Lấy danh sách thủ tục. Người dùng thông thường chỉ thấy các thủ tục có `activeVersionId` hợp lệ (đã có bản `PUBLISHED`). Quản trị viên thấy toàn bộ.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string, optional): Tìm kiếm theo mã `code` hoặc tên `name`.
- `departmentId` (string, optional): Lọc theo phòng ban áp dụng.
- `status` (string, optional): Lọc theo trạng thái phiên bản (`DRAFT`, `PUBLISHED`, `ARCHIVED`).

**Response 200 OK:**
```json
{
  "items": [
    {
      "id": "c1f7a2d3-9824-4f4b-8e2a-18e80a0a3111",
      "code": "PROC_PURCHASE_01",
      "name": "Yêu cầu Mua sắm Hàng hóa & Dịch vụ",
      "description": "Thủ tục phê duyệt mua sắm trang thiết bị, vật tư văn phòng",
      "departmentId": "dept-it-001",
      "departmentName": "Khối Công nghệ Thông tin",
      "icon": "shopping-cart",
      "color": "#2563eb",
      "activeVersion": {
        "id": "v1-uuid-1234",
        "version": 1,
        "status": "PUBLISHED",
        "publishedAt": "2026-11-13T08:00:00.000Z",
        "formVersionId": "fv-uuid-5678",
        "formName": "Đề xuất mua sắm thiết bị",
        "operatonDefinitionKey": "Process_e_office_purchase_flow_1"
      },
      "latestDraftVersionId": null,
      "createdAt": "2026-11-13T07:30:00.000Z",
      "updatedAt": "2026-11-13T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 2.2. `POST /api/v1/procedures`
Tạo mới một Thủ tục. Hệ thống sẽ tự động tạo kèm `ProcedureVersion 1` ở trạng thái `DRAFT`.

**Request Body:**
```json
{
  "code": "PROC_PURCHASE_01",
  "name": "Yêu cầu Mua sắm Hàng hóa & Dịch vụ",
  "description": "Thủ tục phê duyệt mua sắm trang thiết bị",
  "departmentId": "dept-it-001",
  "icon": "shopping-cart",
  "color": "#2563eb"
}
```

**Response 201 Created:**
```json
{
  "id": "c1f7a2d3-9824-4f4b-8e2a-18e80a0a3111",
  "code": "PROC_PURCHASE_01",
  "name": "Yêu cầu Mua sắm Hàng hóa & Dịch vụ",
  "description": "Thủ tục phê duyệt mua sắm trang thiết bị",
  "departmentId": "dept-it-001",
  "icon": "shopping-cart",
  "color": "#2563eb",
  "activeVersionId": null,
  "draftVersion": {
    "id": "v1-uuid-1234",
    "version": 1,
    "status": "DRAFT",
    "formVersionId": null,
    "operatonDefinitionId": null
  },
  "createdAt": "2026-11-13T08:35:00.000Z"
}
```

**Mã lỗi thường gặp:**
- `400 Bad Request`: Thiếu tên hoặc mã thủ tục không đúng định dạng.
- `409 Conflict`: Mã thủ tục `code` đã tồn tại trong hệ thống.

---

### 2.3. `GET /api/v1/procedures/versions/:versionId`
Lấy chi tiết toàn bộ cấu hình của một phiên bản thủ tục (dùng cho màn hình cấu hình hoặc màn hình nộp đơn).

**Response 200 OK:**
```json
{
  "id": "v1-uuid-1234",
  "procedureId": "c1f7a2d3-9824-4f4b-8e2a-18e80a0a3111",
  "procedureCode": "PROC_PURCHASE_01",
  "procedureName": "Yêu cầu Mua sắm Hàng hóa & Dịch vụ",
  "version": 1,
  "status": "DRAFT",
  "formVersion": {
    "id": "fv-uuid-5678",
    "formId": "f-uuid-1111",
    "formName": "Đơn đề xuất mua sắm",
    "version": 2,
    "layoutSchema": {
      "version": "1.0",
      "grid": { "cols": 12 },
      "sections": []
    },
    "fields": [
      {
        "id": "fld-1",
        "key": "tong_tien_de_xuat",
        "label": "Tổng tiền đề xuất (VNĐ)",
        "type": "NUMBER",
        "required": true
      },
      {
        "id": "fld-2",
        "key": "ly_do_mua",
        "label": "Mục đích sử dụng",
        "type": "TEXT",
        "required": true
      }
    ]
  },
  "workflow": {
    "definitionId": "Process_e_office_purchase_flow_1:1:55d4d38c-bf87-11f0-9289-0242ac140003",
    "definitionKey": "Process_e_office_purchase_flow_1",
    "version": 1,
    "name": "FLOW 1 - Quy trình Phê duyệt Mua sắm",
    "category": "e-Office",
    "conditionVariables": ["var_amount"],
    "tasks": [
      { "id": "step_review_1", "name": "Bộ phận Mua hàng thẩm định (Giá trị cao)", "isMultiInstance": false },
      { "id": "step_review_2", "name": "Kế toán mua hàng duyệt (Giá trị thấp)", "isMultiInstance": false },
      { "id": "step_department_head", "name": "Trưởng phòng phụ trách duyệt", "isMultiInstance": false },
      { "id": "step_final_approver", "name": "Tổng Giám đốc phê duyệt", "isMultiInstance": false }
    ]
  },
  "actorMappings": [
    {
      "id": "am-1",
      "taskDefinitionKey": "step_review_1",
      "taskName": "Bộ phận Mua hàng thẩm định (Giá trị cao)",
      "order": 1,
      "assigneeType": "DIRECT_USER",
      "defaultUserId": "user-uuid-11",
      "defaultUser": {
        "id": "user-uuid-11",
        "displayName": "Nguyễn Thị Mai",
        "email": "mai.nt@gafood.vn",
        "department": "Phòng Mua hàng",
        "title": "Chuyên viên Mua hàng Senior"
      },
      "allowOverride": true,
      "required": true,
      "isMultiInstance": false,
      "collectionVariable": null
    },
    {
      "id": "am-2",
      "taskDefinitionKey": "step_final_approver",
      "taskName": "Tổng Giám đốc phê duyệt",
      "order": 4,
      "assigneeType": "DIRECT_USER",
      "defaultUserId": "user-uuid-99",
      "defaultUser": {
        "id": "user-uuid-99",
        "displayName": "Trần Văn An",
        "email": "an.tv@gafood.vn",
        "department": "Ban Giám đốc",
        "title": "Tổng Giám đốc"
      },
      "allowOverride": false,
      "required": true,
      "isMultiInstance": false,
      "collectionVariable": null
    }
  ],
  "variableMappings": [
    {
      "id": "vm-1",
      "operatonVarName": "var_amount",
      "formFieldKey": "tong_tien_de_xuat",
      "variableType": "NUMBER",
      "fallbackValue": "0"
    }
  ],
  "createdAt": "2026-11-13T08:35:00.000Z",
  "updatedAt": "2026-11-13T08:40:00.000Z"
}
```

---

### 2.4. `PUT /api/v1/procedures/versions/:versionId`
Lưu toàn bộ cấu hình ánh xạ của phiên bản nháp (`DRAFT`). Chỉ được phép gọi khi version đang ở trạng thái `DRAFT`.

**Request Body:**
```json
{
  "formVersionId": "fv-uuid-5678",
  "operatonDefinitionId": "Process_e_office_purchase_flow_1:1:55d4d38c-bf87-11f0-9289-0242ac140003",
  "actorMappings": [
    {
      "taskDefinitionKey": "step_review_1",
      "taskName": "Bộ phận Mua hàng thẩm định (Giá trị cao)",
      "order": 1,
      "assigneeType": "DIRECT_USER",
      "defaultUserId": "user-uuid-11",
      "allowOverride": true,
      "required": true,
      "isMultiInstance": false,
      "collectionVariable": null
    },
    {
      "taskDefinitionKey": "step_final_approver",
      "taskName": "Tổng Giám đốc phê duyệt",
      "order": 4,
      "assigneeType": "DIRECT_USER",
      "defaultUserId": "user-uuid-99",
      "allowOverride": false,
      "required": true,
      "isMultiInstance": false,
      "collectionVariable": null
    }
  ],
  "variableMappings": [
    {
      "operatonVarName": "var_amount",
      "formFieldKey": "tong_tien_de_xuat",
      "variableType": "NUMBER",
      "fallbackValue": "0"
    }
  ]
}
```

**Response 200 OK:** Trả về đối tượng `ProcedureVersion` đã cập nhật.

**Mã lỗi:**
- `400 Bad Request`: Dữ liệu không hợp lệ.
- `403 Forbidden`: Phiên bản này đã `PUBLISHED` hoặc `ARCHIVED`, không được phép sửa.

---

### 2.5. `POST /api/v1/procedures/versions/:versionId/validate`
Chạy bộ kiểm tra toàn vẹn mapping mà không thay đổi trạng thái của version. Giúp giao diện frontend hiển thị danh sách lỗi/cảnh báo trước khi Admin quyết định bấm Xuất bản.

**Response 200 OK:**
```json
{
  "isValid": false,
  "errors": [
    {
      "code": "VAL-PRC-06",
      "field": "actorMappings",
      "message": "Chưa cấu hình người duyệt cho bước: [step_review_2]."
    }
  ],
  "warnings": [
    {
      "code": "VAL-PRC-05",
      "field": "variableMappings",
      "message": "Trường [ghi_chu] có kiểu TEXT được map vào biến số học [var_amount]."
    }
  ]
}
```

---

### 2.6. `POST /api/v1/procedures/versions/:versionId/publish`
Phát hành phiên bản thủ tục. Tự động chạy validation. Nếu hợp lệ:
1. Đặt `status = 'PUBLISHED'`, ghi nhận `publishedAt = now()`.
2. Lưu bản sao BPMN XML vào `bpmnSnapshotXml`.
3. Cập nhật `Procedure.activeVersionId = versionId`.
4. Chuyển các phiên bản trước đó của Procedure này từ `PUBLISHED` sang `ARCHIVED`.

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Đã phát hành thành công phiên bản 1 của thủ tục.",
  "procedureVersion": {
    "id": "v1-uuid-1234",
    "version": 1,
    "status": "PUBLISHED",
    "publishedAt": "2026-11-13T08:45:00.000Z"
  }
}
```

**Mã lỗi:**
- `422 Unprocessable Entity`: Phát hiện lỗi validation mức `BLOCKER`. Payload trả về mảng `errors`.

---

### 2.7. `GET /api/v1/procedures/helpers/directory`
Lấy danh bạ người dùng kèm thông tin hiển thị Phòng ban & Chức danh phục vụ Autocomplete User Picker trên giao diện thiết kế thủ tục.

**Query Parameters:**
- `search` (string, optional): Tìm theo tên, email hoặc chức danh.
- `departmentId` (string, optional): Lọc theo phòng ban.

**Response 200 OK:**
```json
[
  {
    "id": "user-uuid-11",
    "displayName": "Nguyễn Thị Mai",
    "email": "mai.nt@gafood.vn",
    "department": "Phòng Mua hàng",
    "title": "Chuyên viên Mua hàng Senior",
    "role": "user",
    "isActive": true,
    "signatureImage": "data:image/png;base64,..."
  },
  {
    "id": "user-uuid-99",
    "displayName": "Trần Văn An",
    "email": "an.tv@gafood.vn",
    "department": "Ban Giám đốc",
    "title": "Tổng Giám đốc",
    "role": "admin",
    "isActive": true,
    "signatureImage": "data:image/png;base64,..."
  }
]
```

