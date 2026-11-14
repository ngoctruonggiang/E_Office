# 01 — Bản vẽ Kiến trúc Tổng thể & Luồng Tích hợp Hệ thống (System Architecture Blueprint)

**Dành cho:** Trưởng phòng Dev, Solution Architect, Tech Lead  
**Tài liệu tham khảo liên quan:** [README.md](./README.md), [operaton-engine-contract.md](../01-architecture/operaton-engine-contract.md), [auth-keycloak-architecture.md](../01-architecture/auth-keycloak-architecture.md).

---

## 1. Bối cảnh & Lý do Lựa chọn Kiến trúc 3 Trụ cột Phân rã

Trước đây, các hệ thống e-Office truyền thống thường mắc phải một trong hai "căn bệnh" kiến trúc phổ biến:
1. **Kiến trúc Hard-coded (Cứng nhắc):** Tự viết toàn bộ logic luồng duyệt vào code ứng dụng bằng các bảng `approval_steps`, `step_order`. Khi doanh nghiệp thay đổi quy trình (thêm bước duyệt, rẽ nhánh hạn mức tiền, duyệt song song), lập trình viên phải sửa code và chạy migration CSDL.
2. **Kiến trúc Monolith nguyên khối phụ thuộc Vendor (Vendor Lock-in):** Nhúng trực tiếp toàn bộ Java BPMN Engine (như Camunda/Flowable) vào chung ứng dụng, biến toàn bộ hệ thống thành một khối nặng nề, khó scale, phụ thuộc sâu vào ngôn ngữ Java và khó kiểm soát giao diện người dùng.

Để giải quyết triệt để vấn đề này, Gafood E-Office 2.0 được thiết kế theo **Mô hình 3 Trụ cột Phân rã Hoàn toàn (Decoupled 3-Pillar Architecture)**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       NGƯỜI DÙNG DOANH NGHIỆP                                   │
└─────────────────────────────────┬──────────────────────────────────┬─────────────────────────────┘
                                  │                                  │
                                  ▼                                  ▼
                ┌──────────────────────────────────┐ ┌──────────────────────────────────┐
                │ TRỤ CỘT 1: ĐỊNH DANH TẬP TRUNG   │ │ TRỤ CỘT 2: ĐỘNG CƠ QUY TRÌNH     │
                │ Keycloak 26.1 IAM (Docker)       │ │ Operaton BPMN Engine 2.2 (Docker)│
                │                                  │ │                                  │
                │ • Đăng nhập SSO (PKCE OIDC)      │ │ • Chuẩn BPMN 2.0 Quốc tế         │
                │ • Quản lý tài khoản, phòng ban   │ │ • Quản lý State Machine & Tasks  │
                │ • Cấp JWT RS256 JWKS chuẩn       │ │ • Giao tiếp 100% qua REST API    │
                └─────────────────┬────────────────┘ └──────────────────┬───────────────┘
                                  │ Bearer JWT                          │ Engine REST
                                  ▼                                     ▼
                ┌───────────────────────────────────────────────────────────────────────┐
                │ TRỤ CỘT 3: ỨNG DỤNG E-OFFICE (Monorepo Node.js / TypeScript)          │
                │                                                                       │
                │ • Frontend: Next.js 16 (Turbopack, Tailwind CSS, Form & BPMN Modeler) │
                │ • Backend: NestJS (Prisma ORM, Redis Rate-limiting, Procedure Engine) │
                │ • CSDL chính: PostgreSQL (EAV Form Values + Procedures + Requests)    │
                │ • Ký số văn bản: In-App Digital Signature Canvas & PDF Embedding      │
                └───────────────────────────────────────────────────────────────────────┘
```

### Ưu thế Kỹ thuật của Kiến trúc:
* **Tính Độc lập Tuyệt đối (High Cohesion, Low Coupling):** Backend e-Office chỉ là một REST Client đối với Operaton và Keycloak. Nếu cần bảo trì hoặc nâng cấp BPMN Engine, ứng dụng e-Office không bị sập hay gián đoạn dữ liệu.
* **Tự do Công nghệ:** Frontend và Backend dùng thuần TypeScript / Node.js hiện đại, không cần duy trì stack Java runtime trong monorepo.
* **Bảo mật Cấp Doanh nghiệp:** Toàn bộ việc xác thực danh tính được ủy quyền cho Keycloak – giải pháp IAM mã nguồn mở chuẩn doanh nghiệp hàng đầu hiện nay.

---

## 2. Sơ đồ Mạng lưới & Cổng Dịch vụ (Component Topology & Ports)

Toàn bộ hạ tầng phát triển và triển khai cục bộ được điều phối thông qua Docker Compose:

```mermaid
flowchart TD
    Client["Client Browser\n(Google Chrome, Edge)"]

    subgraph Host ["Máy chủ Host / Môi trường Triển khai"]
        subgraph PortsFront ["Tầng Giao diện & Định danh"]
            FE["Frontend Next.js\nPort 3000"]
            KC["Keycloak IAM\nPort 8081\nContainer: gafood-keycloak-dev"]
        end

        subgraph PortsBack ["Tầng Ứng dụng & Quy trình"]
            BE["Backend NestJS\nPort 3001"]
            OP["Operaton BPMN Engine\nPort 8080\nContainer: gafood-operaton-dev"]
        end

        subgraph PortsData ["Tầng Dữ liệu & Caching"]
            PG["PostgreSQL Server\nPort 5432\nContainer: gafood-postgres-dev"]
            RD["Redis Server\nPort 6380\nContainer: gafood-redis-dev"]
        end

        subgraph PG_Databases ["Các CSDL Độc lập trong Postgres"]
            DB_EO["gafood_eoffice\n(CSDL e-Office chính)"]
            DB_OP["operaton_db\n(CSDL nội bộ của Operaton)"]
            DB_KC["keycloak_db\n(CSDL nội bộ của Keycloak)"]
        end
    end

    Client -->|"HTTP: 3000"| FE
    Client -->|"OIDC Redirect: 8081"| KC
    FE -->|"REST API: 3001"| BE
    BE -->|"REST Engine: 8080/engine-rest"| OP
    BE -->|"Prisma Client TCP: 5432"| DB_EO
    BE -->|"ioredis TCP: 6380"| RD
    OP -->|"JDBC TCP: 5432"| DB_OP
    KC -->|"JDBC TCP: 5432"| DB_KC
    PG --- DB_EO
    PG --- DB_OP
    PG --- DB_KC
```

### Danh mục Cổng Giao tiếp Mạng:
| Dịch vụ | Container Name | Cổng Expose | Giao thức & Công dụng |
|:---|:---|:---:|:---|
| **Frontend Web** | _(Dev server / Docker)_ | `3000` | HTTP/HTTPS giao diện người dùng Next.js App Router |
| **Backend API** | _(Dev server / Docker)_ | `3001` | REST API, Swagger docs (`/api/docs`), WebSocket |
| **Keycloak IAM** | `gafood-keycloak-dev` | `8081` | OpenID Connect, OAuth2, Admin Console (`/admin`) |
| **Operaton Engine** | `gafood-operaton-dev` | `8080` | REST API Engine (`/engine-rest`), Webapp (`/app`) |
| **PostgreSQL** | `gafood-postgres-dev` | `5432` | Chứa 3 CSDL tách biệt: `gafood_eoffice`, `operaton_db`, `keycloak_db` |
| **Redis Cache** | `gafood-redis-dev` | `6380` | Throttle Rate Limit (15 req/phút), Session Blacklist, Cache tạm |

---

## 3. Kiến trúc Bảo mật & Xác thực Danh tính (Security & IAM)

Hệ thống triển khai cơ chế **Dual-Authentication Strategy (Chiến lược Xác thực Kép)** hỗ trợ song song cả tài khoản nội bộ cũ và SSO Keycloak hiện đại.

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant FE as Frontend (Next.js)
    participant KC as Keycloak (Port 8081)
    participant BE as Backend (Port 3001)
    participant DB as PostgreSQL (e-Office DB)

    User->>FE: Bấm "Đăng nhập bằng Keycloak SSO"
    FE->>KC: Chuyển hướng OIDC kèm PKCE code_challenge
    User->>KC: Nhập Email/Password hoặc dùng Smartcard
    KC-->>FE: Chuyển hướng về /auth/sso/callback kèm code
    FE->>KC: Trao đổi authorization_code lấy OIDC Token Pair (RS256)
    KC-->>FE: Trả về accessToken & idToken
    FE->>BE: POST /auth/sso/session { accessToken }
    BE->>KC: Xác thực chữ ký RS256 qua JWKS endpoint certs
    BE->>DB: JIT Sync: Tự động cập nhật User, Title, Department
    BE-->>FE: Trả về e-Office JWT Session + Cookie
    FE-->>User: Đăng nhập thành công, chuyển hướng vào Dashboard
```

### Các nguyên tắc an ninh cốt lõi:
1. **Zero-Trust Token Verification (Xác thực không tin tưởng trước):**
   - Backend xác thực token Keycloak bằng thuật toán bất đối xứng **RS256** thông qua JWKS URI (`http://localhost:8081/realms/e-office/protocol/openid-connect/certs`). Backend không cần lưu trữ bất kỳ private key nhạy cảm nào.
2. **JIT Synchronization (Đồng bộ tức thời - Just In Time):**
   - Khi người dùng đăng nhập SSO lần đầu hoặc có thay đổi về Chức danh (`jobTitle`), Phòng ban (`department`), Backend tự động đồng bộ vào bảng `User` và cây `Organization` trong CSDL e-Office.
3. **Phân quyền Dựa trên Vai trò (Role-Based Access Control - RBAC):**
   - Hệ thống chia làm 3 tầng quyền chính:
     * `admin`: Toàn quyền cấu hình Biểu mẫu, Quy trình BPMN, Thủ tục và Quản trị Tổ chức.
     * `manager`: Quyền phê duyệt, ký số văn bản và theo dõi hồ sơ của phòng ban phụ trách.
     * `user`: Quyền khởi tạo hồ sơ từ Thủ tục, theo dõi tiến độ hồ sơ cá nhân và nhận trả hồ sơ khi có yêu cầu sửa đổi.
4. **Bảo vệ Chống Tấn công Từ chối Dịch vụ (Redis Throttle & Rate Limiting):**
   - Áp dụng bộ lọc `RedisThrottleGuard` trên toàn bộ các endpoint xác thực và nộp đơn (5-15 requests/phút theo IP thực thông qua `trust proxy = 1`).

---

## 4. Các Luồng Nghiệp vụ Trọng yếu (End-to-End Interaction Flows)

### 4.1 Luồng Khởi tạo Hồ sơ & Mô phỏng Quy trình Thực tế (Phase 5 & 6)

```mermaid
sequenceDiagram
    autonumber
    actor Requester as Người trình đơn
    participant Wizard as CreateRequestWizard (FE)
    participant ReqSvc as RequestService (BE)
    participant ActRes as ActorResolverService (BE)
    participant SimSvc as FlowSimulationService (BE)
    participant DB as Postgres

    Requester->>Wizard: Chọn Thủ tục (ví dụ: Mua sắm thiết bị)
    Wizard->>ReqSvc: POST /requests/from-procedure { procedureId }
    ReqSvc->>DB: Lấy phiên bản ghim (Pinned ProcedureVersion)
    ReqSvc->>ActRes: Phân giải tác nhân mặc định theo quy tắc động (Phase 6)
    ActRes->>DB: Duyệt cây Organization (Trưởng phòng, Kế toán trưởng...)
    ActRes-->>ReqSvc: Danh sách Người duyệt thực tế (Resolved Actors)
    ReqSvc->>DB: Tạo bản ghi FormResponse (DRAFT) & RequestActualActor
    ReqSvc-->>Wizard: Trả về Form Layout + Danh sách Người duyệt
    
    Requester->>Wizard: Nhập giá trị Form (ví dụ: Tổng giá trị = 120.000.000đ)
    Wizard->>ReqSvc: POST /requests/:id/preview-flow { values }
    ReqSvc->>SimSvc: Mô phỏng nhánh BPMN theo giá trị form
    SimSvc-->>Wizard: Kích hoạt nhánh "> 50 triệu", bỏ qua nhánh "<= 50 triệu"
    
    alt Người trình muốn đổi người duyệt (allowOverride = true)
        Requester->>Wizard: Bấm [Thay đổi] chọn người duyệt khác
        Wizard->>ReqSvc: POST /requests/:id/actual-actors { overrides }
        ReqSvc->>DB: Cập nhật RequestActualActor (isOverridden = true)
    end
    
    Requester->>Wizard: Đính kèm tài liệu PDF & Bấm Nộp đơn
    Wizard->>ReqSvc: POST /requests/:id/submit
    ReqSvc->>DB: Chuyển trạng thái FormResponse -> IN_PROGRESS
    ReqSvc->>Operaton: POST /process-definition/key/start (BPMN Process Instance)
```

### 4.2 Luồng Phê duyệt Nghiệp vụ & Ký số Văn bản (Sign-First, Approve-Later)

Nhằm đảm bảo tính toàn vẹn pháp lý trong doanh nghiệp, hệ thống áp dụng cơ chế nghiêm ngặt: **Người duyệt bắt buộc phải Ký số thành công trước khi Hoàn tất nhiệm vụ BPMN**.

```mermaid
sequenceDiagram
    autonumber
    actor Approver as Cấp Quản lý / Người duyệt
    participant DutyUI as Màn hình "Công việc của tôi" (FE)
    participant SignModal as SignDocumentModal (FE)
    participant ReqSvc as RequestService (BE)
    participant OprClient as OperatonClient (BE)
    participant Operaton as Operaton Engine

    Approver->>DutyUI: Mở hồ sơ chờ duyệt
    DutyUI->>ReqSvc: Lấy thông tin hồ sơ & Tệp PDF đính kèm
    Approver->>DutyUI: Bấm [Phê duyệt & Ký số]
    DutyUI->>SignModal: Hiển thị bản vẽ PDF & Vùng ký điện tử (SignatureField)
    Approver->>SignModal: Chọn chữ ký hình ảnh cá nhân & Bấm [Xác nhận Ký]
    
    SignModal->>ReqSvc: POST /requests/:id/documents/:docId/sign
    ReqSvc->>ReqSvc: Nhúng hình ảnh chữ ký vào file PDF (PDF-LIB), ghi vết Audit Log
    ReqSvc-->>SignModal: Ký số PDF thành công
    
    DutyUI->>ReqSvc: POST /requests/:id/tasks/:taskId/complete { action: 'APPROVE' }
    ReqSvc->>OprClient: Complete UserTask trên Operaton REST API
    OprClient->>Operaton: POST /task/:id/complete
    Operaton->>Operaton: Động cơ BPMN chuyển tiếp Token sang bước tiếp theo
    ReqSvc->>ReqSvc: Cập nhật TaskProjection (Đánh dấu đã hoàn thành)
```

---

## 5. Đánh giá Khả năng Mở rộng & Dự phòng Rủi ro (Scalability & Fault Tolerance)

1. **Hiệu năng Truy vấn Danh sách Công việc (Task Projection Engine):**
   - Khi có hàng chục ngàn Process Instance đang chạy, việc query trực tiếp vào bảng runtime của Operaton sẽ làm nghẽn REST API.
   - e-Office giải quyết bằng bảng **`TaskProjection`** trong PostgreSQL: Mỗi khi có UserTask được tạo ra hoặc hoàn thành, Backend tự động đồng bộ một bản chiếu nhẹ (Projection). Màn hình *"Công việc của tôi"* truy vấn 100% trên `TaskProjection` với index tối ưu, đạt tốc độ phản hồi `< 50ms`.
2. **Khả năng Phục hồi khi Operaton hoặc Keycloak gặp sự cố:**
   - CSDL `gafood_eoffice` và `operaton_db` được phân tách hoàn toàn. Nếu Operaton bị restart, trạng thái hồ sơ trong e-Office vẫn an toàn.
   - Khi Operaton phục hồi, cơ chế `OperatonSyncService` có thể quét và tái đồng bộ các task bị trễ.
3. **Mở rộng Đa chi nhánh / Đa cụm (Multi-Tenant & Clustering):**
   - Mọi quy trình thuộc e-Office đều được gắn cờ `category="e-Office"`, cho phép dùng chung một cụm Operaton Engine với các phòng ban khác (như CRM, HRM, Kho vận) mà không lo bị trùng lặp hoặc nhìn thấy quy trình của nhau.

