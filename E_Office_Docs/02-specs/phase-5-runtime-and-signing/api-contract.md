# Hợp đồng Giao diện Lập trình (API Contract) — Module Vận hành Run-time & Ký số PDF

**Mã tài liệu:** `SPEC-RUN-API-01`  
**Thuộc Phase:** `Phase 5 — Vận hành Run-time (Request + Preview/Override Tác nhân + Ký PDF + Vòng đời Operaton)`  
**Trạng thái:** `PENDING_REVIEW`  
**Ngày lập:** 13/11/2026  
**Tác giả:** Google DeepMind / Antigravity Agent  
**Liên kết kiến trúc:**  
- [`architecture_operatioin_eoffice.md`](../../architecture_operatioin_eoffice.md)  
- [`02-specs/phase-5-runtime-and-signing/prd.md`](./prd.md)  
- [`02-specs/phase-5-runtime-and-signing/data-model.md`](./data-model.md)  

---

## 1. Chuẩn chung Giao diện API

- **Giao thức:** RESTful JSON over HTTPS.
- **Xác thực:** Bearer JWT Token (`Authorization: Bearer <token>`).
- **Xử lý Người dùng:** Lấy từ token đăng nhập qua `@CurrentUser('userId') userId: string`.
- **Mã lỗi quy chuẩn:**
  - `400 Bad Request`: Thiếu tham số hoặc dữ liệu sai định dạng.
  - `401 Unauthorized`: Chưa đăng nhập hoặc token hết hạn.
  - `403 Forbidden`: Không có quyền thao tác (ví dụ: không phải người tạo hoặc không phải người được giao task).
  - `404 Not Found`: Không tìm thấy tài nguyên.
  - `422 Unprocessable Entity`: Vi phạm ràng buộc nghiệp vụ (chưa ký số, thiếu người duyệt, vi phạm validation form).
  - `502 Bad Gateway`: Lỗi kết nối Operaton Engine.

---

## 2. Danh mục Chi tiết các Điểm cuối (Endpoints)

### 2.1. Khởi tạo Bản nháp từ Thủ tục
`POST /requests/from-procedure`

Khởi tạo một bản ghi `FormResponse` ở trạng thái `DRAFT` ghim cứng với phiên bản Thủ tục hiện hành (ADR-005).

**Request Body:**
```json
{
  "procedureId": "prc-uuid-1234",
  "procedureVersionId": "prcv-uuid-5678" // Tùy chọn. Nếu không truyền, hệ thống tự lấy bản PUBLISHED hiện tại
}
```

**Response (201 Created):**
```json
{
  "id": "req-uuid-9999",
  "status": "DRAFT",
  "procedure": {
    "id": "prc-uuid-1234",
    "code": "PRC-BUY-01",
    "name": "Quy trình Mua sắm Thiết bị & Dụng cụ",
    "icon": "shopping-cart"
  },
  "procedureVersion": {
    "id": "prcv-uuid-5678",
    "versionNumber": 1,
    "operatonDefinitionKey": "FLOW_1_PURCHASE"
  },
  "formVersion": {
    "id": "fv-uuid-1111",
    "version": 1,
    "layoutSchema": {
      "version": "1.0",
      "grid": { "columns": 12, "gap": 16 },
      "sections": [ ... ]
    }
  },
  "defaultActors": [
    {
      "taskDefinitionKey": "Activity_DeptHeadApprove",
      "taskName": "Trưởng phòng duyệt",
      "userId": "usr-uuid-depthead",
      "fullName": "Nguyễn Văn Trưởng",
      "department": "Phòng Kỹ thuật",
      "title": "Trưởng phòng",
      "allowOverride": true,
      "order": 1
    }
  ],
  "createdAt": "2026-11-13T08:00:00.000Z"
}
```

---

### 2.2. Mô phỏng Luồng & Rẽ nhánh BPMN
`POST /requests/:id/preview-flow`

Đánh giá dữ liệu form người dùng vừa nhập để xác định nhánh rẽ trên sơ đồ BPMN.

**Request Body:**
```json
{
  "values": {
    "purpose": "Mua màn hình Dell 27 inch",
    "total_amount": 75000000,
    "is_urgent": true
  }
}
```

**Response (200 OK):**
```json
{
  "variables": {
    "var_total_amount": 75000000,
    "var_urgent": true
  },
  "activeTaskKeys": [
    "Activity_DeptHeadApprove",
    "Activity_DirectorApprove"
  ],
  "bypassedTaskKeys": [
    "Activity_AccountantApprove"
  ],
  "activeFlowIds": [
    "Flow_StartToDept",
    "Flow_DeptToGateway",
    "Flow_GatewayToDirector",
    "Flow_DirectorToEnd"
  ],
  "bypassedFlowIds": [
    "Flow_GatewayToAccountant"
  ],
  "stages": [
    {
      "taskDefinitionKey": "Activity_DeptHeadApprove",
      "taskName": "Trưởng phòng duyệt",
      "order": 1,
      "isMultiInstance": false,
      "allowOverride": true,
      "defaultActor": {
        "userId": "usr-uuid-depthead",
        "fullName": "Nguyễn Văn Trưởng",
        "department": "Phòng Kỹ thuật",
        "title": "Trưởng phòng"
      }
    },
    {
      "taskDefinitionKey": "Activity_DirectorApprove",
      "taskName": "Ban Giám đốc phê duyệt",
      "order": 2,
      "isMultiInstance": false,
      "allowOverride": false,
      "defaultActor": {
        "userId": "usr-uuid-director",
        "fullName": "Trần Ban Giám Đốc",
        "department": "Ban Giám đốc",
        "title": "Tổng Giám đốc"
      }
    }
  ]
}
```

---

### 2.3. Cập nhật Danh sách Người duyệt Thực tế (Override)
`PUT /requests/:id/actual-actors`

Cho phép người trình ghi đè người duyệt tại các bước có `allowOverride = true` (ADR-003).

**Request Body:**
```json
{
  "actors": [
    {
      "taskDefinitionKey": "Activity_DeptHeadApprove",
      "userId": "usr-uuid-phophong",
      "order": 1
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "actualActors": [
    {
      "id": "act-uuid-1",
      "taskDefinitionKey": "Activity_DeptHeadApprove",
      "taskName": "Trưởng phòng duyệt",
      "userId": "usr-uuid-phophong",
      "fullName": "Lê Văn Phó",
      "department": "Phòng Kỹ thuật",
      "title": "Phó phòng (Ủy quyền)",
      "isOverridden": true,
      "order": 1
    }
  ]
}
```

**Error (403 Forbidden):**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Bước duyệt 'Ban Giám đốc phê duyệt' không cho phép người trình thay đổi người duyệt.",
  "code": "ERR_ACTOR_OVERRIDE_DENIED"
}
```

---

### 2.4. Nộp Yêu cầu & Khởi chạy Quy trình trên Operaton
`POST /requests/:id/submit`

Xác thực tính toàn vẹn, khởi chạy Process Instance trên Operaton, chuyển `status = PENDING`.

**Request Body:**
```json
{
  "values": {
    "purpose": "Mua màn hình Dell 27 inch",
    "total_amount": 75000000
  }
}
```

**Response (200 OK):**
```json
{
  "id": "req-uuid-9999",
  "status": "PENDING",
  "operatonProcessInstanceId": "8a3b5c12-3211-4def-9910-abcdef012345",
  "businessKey": "req-uuid-9999",
  "activeTasks": [
    {
      "taskId": "Task_991823",
      "taskDefinitionKey": "Activity_DeptHeadApprove",
      "taskName": "Trưởng phòng duyệt",
      "assigneeId": "usr-uuid-phophong"
    }
  ]
}
```

---

### 2.5. Trạng thái Thực thi Trực quan & Sơ đồ BPMN
`GET /requests/:id/flow-status`

Lấy trạng thái thực tế phục vụ màn hình theo dõi tiến độ và tô màu sơ đồ BPMN.

**Response (200 OK):**
```json
{
  "processInstanceId": "8a3b5c12-3211-4def-9910-abcdef012345",
  "status": "PENDING",
  "bpmn20Xml": "<bpmn:definitions ...> ... </bpmn:definitions>",
  "activeTaskKeys": ["Activity_DeptHeadApprove"],
  "completedTaskKeys": [],
  "actualActors": [
    {
      "taskDefinitionKey": "Activity_DeptHeadApprove",
      "taskName": "Trưởng phòng duyệt",
      "assignee": {
        "id": "usr-uuid-phophong",
        "name": "Lê Văn Phó",
        "department": "Phòng Kỹ thuật"
      },
      "status": "WAITING"
    }
  ],
  "history": [
    {
      "action": "SUBMIT",
      "actorName": "Nguyễn Văn Nhân Viên",
      "timestamp": "2026-11-13T08:15:00.000Z",
      "comment": "Kính trình duyệt mua thiết bị phục vụ dự án mới"
    }
  ]
}
```

---

### 2.6. Danh sách "Công việc của tôi" (My Duties)
`GET /requests/duty`

Truy vấn nhanh các task người dùng hiện tại cần xử lý (từ bảng `TaskProjection`).

**Query Parameters:**
- `tab`: `pending` (mặc định) | `completed`
- `page`: Số trang (mặc định 1)
- `limit`: Số bản ghi mỗi trang (mặc định 10, tối đa 50)
- `search`: Từ khóa tìm kiếm (theo tên thủ tục hoặc người gửi)
- `procedureId`: Lọc theo thủ tục

**Response (200 OK):**
```json
{
  "items": [
    {
      "taskId": "Task_991823",
      "taskDefinitionKey": "Activity_DeptHeadApprove",
      "taskName": "Trưởng phòng duyệt",
      "createdAt": "2026-11-13T08:15:00.000Z",
      "dueDate": null,
      "requiresSignature": true,
      "request": {
        "id": "req-uuid-9999",
        "procedureName": "Quy trình Mua sắm Thiết bị & Dụng cụ",
        "requester": {
          "id": "usr-uuid-nv",
          "name": "Nguyễn Văn Nhân Viên",
          "department": "Phòng Kỹ thuật"
        },
        "createdAt": "2026-11-13T08:15:00.000Z"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### 2.7. Phê duyệt Task Thông thường
`POST /requests/:id/tasks/:taskId/approve`

Duyệt bước nếu không có ràng buộc ký số PDF chưa hoàn tất.

**Request Body:**
```json
{
  "comment": "Đồng ý phê duyệt đề xuất"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": "PENDING",
  "message": "Phê duyệt thành công"
}
```

**Error (422 Unprocessable Entity - Yêu cầu ký số):**
```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Bạn chưa ký số vào tài liệu đính kèm của bước duyệt này. Vui lòng thực hiện ký số trước khi duyệt.",
  "code": "ERR_SIGNATURE_REQUIRED",
  "details": {
    "pendingSignatureFieldIds": ["sig-uuid-1"]
  }
}
```

---

### 2.8. Ký số & Phê duyệt Liên hoàn
`POST /requests/:id/tasks/:taskId/sign-and-approve`

Ký số vào ô chữ ký chỉ định trên PDF và đồng thời gửi lệnh hoàn thành task sang Operaton.

**Request Body:**
```json
{
  "signatureFieldIds": ["sig-uuid-1"],
  "signatureImage": "data:image/png;base64,iVBORw0KGgo...",
  "signatureName": "Lê Văn Phó",
  "comment": "Đã ký số và phê duyệt đề xuất"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "signedFieldIds": ["sig-uuid-1"],
  "status": "PENDING",
  "message": "Ký số và phê duyệt thành công"
}
```

---

### 2.9. Yêu cầu Chỉnh sửa Hồ sơ
`POST /requests/:id/tasks/:taskId/request-changes`

**Request Body:**
```json
{
  "comment": "Vui lòng đính kèm thêm 3 bảng báo giá cạnh tranh trước khi duyệt."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": "REQUEST_CHANGES",
  "message": "Đã gửi yêu cầu chỉnh sửa đến người trình"
}
```

---

### 2.10. Từ chối Hồ sơ
`POST /requests/:id/tasks/:taskId/reject`

**Request Body:**
```json
{
  "comment": "Hiện tại ngân sách quý 4 đã hết, không duyệt đề xuất này."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": "REJECTED",
  "message": "Đã từ chối hồ sơ"
}
```

---

### 2.11. Hủy Hồ sơ
`POST /requests/:id/cancel`

**Request Body:**
```json
{
  "reason": "Không còn nhu cầu mua thiết bị này nữa"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": "CANCELLED",
  "message": "Hồ sơ đã được hủy bỏ thành công"
}
```

---

### 2.12. Sao chép Hồ sơ (Clone)
`POST /requests/:id/clone`

**Request Body:**
```json
{
  "mode": "reset" // hoặc "reserve"
}
```

**Response (201 Created):**
```json
{
  "newRequestId": "req-uuid-clone-8888",
  "status": "DRAFT",
  "procedureVersionId": "prcv-uuid-5678",
  "message": "Sao chép hồ sơ thành công"
}
```

