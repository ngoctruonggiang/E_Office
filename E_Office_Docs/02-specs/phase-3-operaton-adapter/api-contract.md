# Hợp đồng API (API Contract) — Phase 3: Operaton Engine Adapter

**Trạng thái:** `APPROVED` (Phase 3)  
**Tài liệu liên quan:** [operaton-engine-contract.md](../../01-architecture/operaton-engine-contract.md), [bpmn-modeling-standards.md](./bpmn-modeling-standards.md).

---

## 1. Danh sách Endpoints Nội bộ Backend e-Office (`/operaton`)

Tất cả các endpoint này được triển khai trong module `OperatonModule` (`backend/src/modules/operaton/`), có tiền tố `/operaton` và được bảo vệ bởi `JwtAuthGuard` + `RolesGuard` (`ADMIN` hoặc `SUPER_ADMIN`).

```text
GET    /operaton/health                     # Kiểm tra kết nối & phiên bản Operaton Engine
GET    /operaton/definitions                # Lấy danh sách quy trình thuộc category="e-Office"
GET    /operaton/definitions/:id/xml        # Lấy BPMN XML nguyên bản của một quy trình
GET    /operaton/definitions/:id/structure  # Lấy cấu trúc đã parse (Node, Tasks, Variables, Gateways)
POST   /operaton/deploy                     # Deploy sơ đồ BPMN từ Web Modeler hoặc file tải lên
```

---

## 2. Chi tiết Từng Endpoint

### 2.1 `GET /operaton/health`
Kiểm tra tình trạng sẵn sàng của Operaton Engine và phiên bản đang chạy.
- **Quyền:** `ADMIN`, `SUPER_ADMIN`
- **Response 200 OK:**
  ```json
  {
    "status": "UP",
    "engineVersion": "1.0.0",
    "restEndpoint": "http://gafood-operaton-dev:8080/engine-rest",
    "databaseStatus": "CONNECTED"
  }
  ```
- **Lỗi 503 Service Unavailable:**
  ```json
  {
    "statusCode": 503,
    "message": "Operaton Engine is unreachable or unhealthy",
    "error": "Service Unavailable",
    "details": ["Connection refused at http://localhost:8080/engine-rest"]
  }
  ```

---

### 2.2 `GET /operaton/definitions`
Lấy danh sách các định nghĩa quy trình (Process Definitions) đang có trên Operaton thuộc nhóm `e-Office`.
- **Query Params:**
  - `category` (string, tùy chọn, mặc định `e-Office`)
  - `latestOnly` (boolean, tùy chọn, mặc định `true`)
- **Response 200 OK:**
  ```json
  [
    {
      "id": "eoffice_proc_purchase_flow_1:1:a1b2c3d4",
      "key": "eoffice_proc_purchase_flow_1",
      "category": "e-Office",
      "name": "Quy trình Nghiệp vụ: Yêu cầu Mua sắm (FLOW 1)",
      "version": 1,
      "deploymentId": "dep_123456",
      "suspended": false
    }
  ]
  ```

---

### 2.3 `GET /operaton/definitions/:id/structure`
Tải file BPMN XML từ Operaton và tự động phân tích cấu trúc thành JSON phục vụ màn hình cấu hình `Procedure` và xem trước luồng.
- **Response 200 OK:**
  ```json
  {
    "processDefinitionId": "eoffice_proc_purchase_flow_1:1:a1b2c3d4",
    "processKey": "eoffice_proc_purchase_flow_1",
    "processName": "Quy trình Nghiệp vụ: Yêu cầu Mua sắm (FLOW 1)",
    "tasks": [
      {
        "taskKey": "step_review_1",
        "name": "Xem xét 1 (Bộ phận Tài chính)",
        "assigneeVariable": "actor_step_review_1",
        "isMultiInstance": false,
        "defaultRole": "Kế toán trưởng",
        "allowOverride": true
      },
      {
        "taskKey": "step_review_2",
        "name": "Xem xét 2 (Bộ phận Mua sắm)",
        "assigneeVariable": "actor_step_review_2",
        "isMultiInstance": false,
        "defaultRole": "Chuyên viên mua sắm",
        "allowOverride": true
      },
      {
        "taskKey": "step_department_head",
        "name": "Trưởng phòng phê duyệt",
        "assigneeVariable": "actor_step_dept_head",
        "isMultiInstance": false,
        "allowOverride": false
      },
      {
        "taskKey": "step_final_approver",
        "name": "Người duyệt cuối",
        "assigneeVariable": "actor_step_final_approver",
        "isMultiInstance": false,
        "allowOverride": false
      }
    ],
    "gateways": [
      {
        "id": "gateway_value",
        "name": "Xét giá trị",
        "type": "ExclusiveGateway",
        "outgoings": [
          {
            "targetTaskKey": "step_review_1",
            "conditionExpression": "${var_amount >= 50000000}"
          },
          {
            "targetTaskKey": "step_review_2",
            "conditionExpression": "${var_amount < 50000000}"
          }
        ]
      }
    ],
    "requiredVariables": [
      { "name": "var_amount", "expectedType": "Long" }
    ]
  }
  ```

---

### 2.4 `POST /operaton/deploy`
Phát hành một quy trình mới từ Frontend Web Modeler sang Operaton Engine.
- **Request Body (JSON hoặc Multipart):**
  ```json
  {
    "deploymentName": "Yêu cầu Mua sắm v1.2",
    "category": "e-Office",
    "bpmnXml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<bpmn:definitions ...>...</bpmn:definitions>"
  }
  ```
- **Validation Rules:**
  - `deploymentName`: Bắt buộc, chuỗi không rỗng (3 - 100 ký tự).
  - `category`: Bắt buộc, chuỗi không rỗng.
  - `bpmnXml`: Bắt buộc, cú pháp XML hợp lệ, chứa ít nhất 1 `bpmn:startEvent` và 1 `bpmn:endEvent`.
- **Response 201 Created:**
  ```json
  {
    "deploymentId": "dep_987654",
    "deploymentTime": "2026-11-13T08:00:00.000Z",
    "deployedProcessDefinitions": [
      {
        "id": "eoffice_proc_purchase_flow_1:2:f5e4d3c2",
        "key": "eoffice_proc_purchase_flow_1",
        "version": 2,
        "name": "Quy trình Nghiệp vụ: Yêu cầu Mua sắm (FLOW 1)"
      }
    ]
  }
  ```
- **Lỗi 400 Bad Request:**
  ```json
  {
    "statusCode": 400,
    "message": "Invalid BPMN XML schema",
    "error": "Bad Request",
    "details": ["BPMN XML missing executable process element"]
  }
  ```

