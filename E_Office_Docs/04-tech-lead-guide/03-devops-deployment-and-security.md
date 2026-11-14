# 03 — Triển khai Vận hành & An ninh Hạ tầng (DevOps, Deployment & Security)

**Dành cho:** Trưởng phòng Dev, DevOps Engineer, SysAdmin, Security Lead  
**Tài liệu tham khảo liên quan:** [docker-setup-spec.md](../02-specs/phase-1-keycloak-identity/docker-setup-spec.md), [docker-setup-spec.md (Phase 3)](../02-specs/phase-3-operaton-adapter/docker-setup-spec.md).

---

## 1. Cấu trúc Hạ tầng Container & Docker Compose

Toàn bộ hạ tầng phụ trợ của hệ thống được đóng gói hoàn chỉnh trong thư mục [`deploy/`](file:///f:/Downloads/Projects/Gafood/E_Office/deploy/) với 3 stack độc lập:

```
deploy/
 ├── keycloak/                         # Trụ cột 1: Identity & Access Management
 │    ├── docker-compose.keycloak.yml  # Keycloak 26.1 + volume + realm import
 │    └── realm-export.json            # Cấu hình realm 'e-office', PKCE client, seed users
 │
 ├── operaton/                         # Trụ cột 2: Workflow Engine
 │    ├── docker-compose.operaton.yml  # Operaton BPMN 2.2 + CSDL operaton_db
 │    └── bpmn-templates/              # Các mẫu quy trình BPMN chuẩn khởi tạo
 │
 └── infra/                            # CSDL & Bộ nhớ đệm dùng chung
      └── docker-compose.infra.yml     # PostgreSQL 16 & Redis 7 Alpine
```

### 1.1 Khởi động Toàn bộ Hạ tầng trong 1 Lệnh (Single-command Startup)
Để khởi chạy toàn bộ các dịch vụ phụ trợ từ môi trường trắng:
```powershell
# 1. Khởi động PostgreSQL và Redis
docker compose -f deploy/infra/docker-compose.infra.yml up -d

# 2. Khởi động Keycloak IAM (tự động nạp Realm e-office và tài khoản mẫu)
docker compose -f deploy/keycloak/docker-compose.keycloak.yml up -d

# 3. Khởi động Operaton BPMN Engine (kết nối qua operaton_db)
docker compose -f deploy/operaton/docker-compose.operaton.yml up -d
```

### 1.2 Kiểm tra Trạng thái Container (Health Status)
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
Kết quả kỳ vọng:
* `gafood-postgres-dev`: `Up (healthy) - 0.0.0.0:5432->5432/tcp`
* `gafood-redis-dev`: `Up (healthy) - 0.0.0.0:6380->6379/tcp`
* `gafood-keycloak-dev`: `Up (healthy) - 0.0.0.0:8081->8080/tcp`
* `gafood-operaton-dev`: `Up (healthy) - 0.0.0.0:8080->8080/tcp`

---

## 2. Ma trận Biến Môi trường (Environment Variables Matrix)

### 2.1 Backend (`backend/.env`)
| Tên Biến | Giá trị Mặc định (Dev) | Mục đích & Ràng buộc |
|:---|:---|:---|
| `PORT` | `3001` | Cổng HTTP lắng nghe của NestJS API Server |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/gafood_eoffice` | Chuỗi kết nối CSDL PostgreSQL chính của e-Office |
| `REDIS_HOST` / `REDIS_PORT`| `localhost` / `6380` | Kết nối Redis phục vụ Rate Limiter và Token Revocation |
| `KEYCLOAK_URL` | `http://localhost:8081` | URL gốc của máy chủ Keycloak IAM |
| `KEYCLOAK_REALM` | `e-office` | Realm định danh dùng chung cho toàn bộ nhân sự |
| `KEYCLOAK_CLIENT_ID` | `eoffice-web` | Mã định danh OIDC Client (Public Client hỗ trợ PKCE) |
| `OPERATON_REST_URL` | `http://localhost:8080/engine-rest` | REST API endpoint để Backend điều khiển động cơ BPMN |
| `OPERATON_CATEGORY` | `e-Office` | Tenant/Category cách ly luồng văn phòng số khỏi hệ thống khác |
| `JWT_ACCESS_SECRET` | `secret-key-32-chars-minimum...` | Khóa bí mật ký phiên đăng nhập nội bộ e-Office |
| `CORS_ORIGINS` | `http://localhost:3000` | Danh sách domain Frontend được phép gọi API (phân cách bằng dấu phẩy) |

### 2.2 Frontend (`frontend/.env.local`)
| Tên Biến | Giá trị Mặc định (Dev) | Mục đích & Ràng buộc |
|:---|:---|:---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL gọi REST API Backend từ trình duyệt người dùng |
| `NEXT_PUBLIC_KEYCLOAK_URL` | `http://localhost:8081` | URL để trình duyệt chuyển hướng sang trang đăng nhập Keycloak SSO |
| `NEXT_PUBLIC_KEYCLOAK_REALM`| `e-office` | Tên Realm cấu hình trên Keycloak |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`| `eoffice-web` | Mã Client cho luồng PKCE phía Client-side |

---

## 3. Chiến lược Bảo mật Hạ tầng & Phòng thủ Chiều sâu (Defense-in-Depth)

```
                            CÁC LỚP BẢO MẬT ĐA TẦNG (SECURITY LAYERS)
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: MẠNG & CHỐNG LẠM DỤNG (Rate Limiting & Proxy Protection)                           │
│ • Redis Throttle Guard: Chặn brute-force (tối đa 5-15 requests/phút trên auth/create)      │
│ • app.set('trust proxy', 1): Nhận diện đúng IP thực tế phía sau Nginx/Cloudflare Load Balancer│
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: XÁC THỰC DANH TÍNH BẤT ĐỐI XỨNG (OIDC & PKCE)                                       │
│ • Proof Key for Code Exchange (PKCE): Chống tấn công chặn bắt Authorization Code            │
│ • RS256 Asymmetric Verification: Backend đọc public certs từ Keycloak JWKS endpoint          │
│ • Tuyệt đối không lưu trữ Client Secret nhạy cảm trên máy Client trình duyệt                │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: PHÂN QUYỀN TRÊN ENDPOINT & DỮ LIỆU (Role-Based Access Control)                      │
│ • NestJS RolesGuard: Kiểm tra nghiêm ngặt quyền ('admin', 'manager', 'user')                 │
│ • Data Ownership Verification: Người nộp đơn chỉ sửa được hồ sơ của chính mình              │
│ • Immutable Signed PDFs: Tệp PDF sau khi ký được băm SHA-256 và khóa quyền chỉnh sửa        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Kế hoạch Sao lưu & Khôi phục Thảm họa (Backup & Disaster Recovery)

### 4.1 Kịch bản Sao lưu Dữ liệu Định kỳ (Daily Backup Routine)
Do hệ thống phân chia 3 CSDL riêng biệt trong PostgreSQL, script sao lưu cần dump toàn bộ 3 database:
```bash
# Backup CSDL e-Office (Dữ liệu biểu mẫu, thủ tục, hồ sơ)
pg_dump -h localhost -p 5432 -U postgres -d gafood_eoffice -F c -b -v -f "/backup/eoffice_$(date +%Y%m%d).dump"

# Backup CSDL Operaton (Toàn bộ tiến trình BPMN và lịch sử task)
pg_dump -h localhost -p 5432 -U postgres -d operaton_db -F c -b -v -f "/backup/operaton_$(date +%Y%m%d).dump"

# Backup CSDL Keycloak (Tài khoản, quyền, phiên làm việc)
pg_dump -h localhost -p 5432 -U postgres -d keycloak_db -F c -b -v -f "/backup/keycloak_$(date +%Y%m%d).dump"
```

### 4.2 Kịch bản Khôi phục Thảm họa (Disaster Recovery)
Trong trường hợp toàn bộ máy chủ bị hỏng:
1. Kéo mã nguồn mới từ Git repo.
2. Chạy `docker compose up -d` để khởi động lại các container.
3. Chạy `pg_restore` để nạp lại dữ liệu từ 3 bản dump.
4. Mọi hồ sơ đang ở trạng thái `IN_PROGRESS` sẽ tiếp tục khớp với `ProcessInstanceId` trên Operaton mà không bị mất dấu hay mất bước duyệt.

