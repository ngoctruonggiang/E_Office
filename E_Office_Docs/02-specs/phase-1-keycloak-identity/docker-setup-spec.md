# Đặc tả Hạ tầng Docker Compose & Cấu hình Realm cho Keycloak IAM

**Trạng thái:** `APPROVED` (Phase 1)  
**Tệp cấu hình mục tiêu:** `deploy/keycloak/docker-compose.keycloak.yml` & `deploy/keycloak/realm-export.json`  
**Tài liệu liên quan:** [auth-keycloak-architecture.md](../../01-architecture/auth-keycloak-architecture.md), [prd.md](./prd.md).

---

## 1. Mục tiêu & Nguyên tắc Thiết lập Hạ tầng

1. **Hoàn toàn độc lập:** Keycloak chạy dưới dạng Docker container, không nhúng code Java hay build Quarkus trong repo này.
2. **Không xung đột cổng:** 
   - Operaton Engine đang dùng cổng `8080`.
   - Backend NestJS đang dùng cổng `3001`.
   - Frontend Next.js đang dùng cổng `3000`.
   - PostgreSQL đang dùng cổng `5432`.
   - Redis đang dùng cổng `6379`/`6380`.
   - &rarr; **Keycloak được cấu hình cổng máy chủ: `8081:8080`**.
3. **Sử dụng chung PostgreSQL Server:** Keycloak kết nối vào container PostgreSQL hiện tại (`gafood-postgres-dev`), sử dụng database riêng là `keycloak_db`.
4. **Auto-Import Realm:** Khi container khởi động lần đầu, cờ `--import-realm` sẽ nạp file `realm-export.json` tự động, giúp khởi tạo đầy đủ Realm `e-office`, Client, Roles và Users mà không cần người dùng phải bấm tạo bằng tay trong Admin Console.

---

## 2. Kịch bản Khởi tạo Database `keycloak_db`

Trước khi Keycloak khởi động lần đầu, database `keycloak_db` cần được tạo trên PostgreSQL:

```bash
docker exec -i gafood-postgres-dev psql -U postgres -d postgres -c "CREATE DATABASE keycloak_db;"
```
*(Nếu database đã tồn tại, PostgreSQL sẽ thông báo đã có và bỏ qua an toàn).*

---

## 3. Cấu hình Docker Compose (`deploy/keycloak/docker-compose.keycloak.yml`)

```yaml
version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.1.0
    container_name: gafood-keycloak-dev
    restart: unless-stopped
    command:
      - start-dev
      - --import-realm
    environment:
      # Thông tin quản trị ban đầu
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
      # Kết nối CSDL PostgreSQL (chia sẻ từ container dev hiện tại)
      - KC_DB=postgres
      - KC_DB_URL=jdbc:postgresql://gafood-postgres-dev:5432/keycloak_db
      - KC_DB_USERNAME=postgres
      - KC_DB_PASSWORD=postgres
      # Tối ưu HTTP & Proxy cho môi trường dev
      - KC_HTTP_PORT=8080
      - KC_HEALTH_ENABLED=true
      - KC_METRICS_ENABLED=true
      # Tối ưu bộ nhớ JVM
      - JAVA_OPTS=-Xms256m -Xmx512m -XX:+UseG1GC
    ports:
      # Map cổng 8081 của host sang 8080 của container (tránh xung đột với Operaton 8080)
      - "8081:8080"
    volumes:
      # Mount file realm export để tự động nạp cấu hình khi khởi động
      - ./realm-export.json:/opt/keycloak/data/import/realm-export.json:ro
    networks:
      - backend_default

networks:
  backend_default:
    external: true
```

---

## 4. Đặc tả Cấu hình Realm (`deploy/keycloak/realm-export.json`)

File `realm-export.json` chứa các thành phần cốt lõi:

### 4.1 Thuộc tính Realm
- **Realm ID / Name:** `e-office`
- **Enabled:** `true`
- **Access Code Lifespan:** 300 giây (5 phút)
- **Access Token Lifespan:** 3600 giây (1 giờ)
- **Refresh Token Lifespan:** 86400 giây (1 ngày)

### 4.2 Cấu hình Client
1. **Client ID: `eoffice-web` (Frontend)**
   - **Protocol:** `openid-connect`
   - **Public Client:** `true` (Không cần Client Secret)
   - **Standard Flow:** `true` (Hỗ trợ Authorization Code Flow)
   - **Direct Access Grants:** `true`
   - **PKCE Code Challenge Method:** `S256`
   - **Valid Redirect URIs:** `["http://localhost:3000/*", "http://127.0.0.1:3000/*"]`
   - **Web Origins:** `["http://localhost:3000", "http://127.0.0.1:3000"]`

2. **Client ID: `eoffice-api` (Backend)**
   - **Protocol:** `openid-connect`
   - **Bearer-only:** `true`

### 4.3 Danh sách Vai trò (Realm Roles)
- `admin`: Toàn quyền quản trị hệ thống, biểu mẫu, quy trình, thủ tục.
- `user`: Người dùng thông thường, nộp đơn và tham gia phê duyệt theo phân công.

### 4.4 Danh sách Tài khoản Mẫu (Dev Seed Users)
Mọi tài khoản đều có sẵn mật khẩu mặc định (không bắt đổi mật khẩu lần đầu) và được gắn đầy đủ Phòng ban, Chức danh:

| Email / Username | Mật khẩu | Họ và Tên | Vai trò | Phòng ban (`department`) | Chức danh (`jobTitle`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `admin@gafood.local` | `admin123` | Quản Trị Viên Hệ Thống | `admin` | Ban Giám Đốc | Giám Đốc Chuyển Đổi Số |
| `buyer@gafood.local` | `user123` | Nguyễn Văn Mua Sắm | `user` | Phòng Mua Hàng | Trưởng Phòng Mua Hàng |
| `accountant@gafood.local` | `user123` | Lê Thị Kế Toán | `user` | Phòng Tài Chính Kế Toán | Kế Toán Trưởng |
| `staff@gafood.local` | `user123` | Trần Văn Nhân Viên | `user` | Phòng Hành Chính Nhân Sự | Chuyên Viên Hành Chính |

---

## 5. Hướng dẫn Vận hành Nhanh (Operational Runbook)

### Khởi động:
```bash
# 1. Tạo database nếu chưa có
docker exec -i gafood-postgres-dev psql -U postgres -d postgres -c "CREATE DATABASE keycloak_db;"

# 2. Khởi chạy container
docker compose -f deploy/keycloak/docker-compose.keycloak.yml up -d
```

### Kiểm tra sức khỏe:
```bash
# Kiểm tra log
docker logs -f gafood-keycloak-dev

# Kiểm tra OpenID Discovery endpoint
curl http://localhost:8081/realms/e-office/.well-known/openid-configuration
```

### Truy cập Giao diện Quản trị Keycloak Admin:
- **URL:** `http://localhost:8081/admin`
- **Tài khoản:** `admin` / `admin`
- **Realm quản trị nghiệp vụ:** Chọn Realm `e-office`

