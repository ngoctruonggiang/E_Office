# Đặc tả Hạ tầng Docker Compose cho Operaton BPMN Engine

**Trạng thái:** `APPROVED` (Phase 3)  
**Tệp cấu hình mục tiêu:** `deploy/operaton/docker-compose.operaton.yml`  
**Tài liệu liên quan:** [operaton-engine-contract.md](../../01-architecture/operaton-engine-contract.md), [ADR-006](../../00-overview/adr/ADR-006-operaton-deployment-and-modeler-strategy.md).

---

## 1. Mục tiêu & Nguyên tắc Triển khai

1. **Cô lập Môi trường:** Operaton Engine chạy dưới dạng container Docker độc lập, không yêu cầu cài đặt máy ảo Java (JDK) hay Maven trên máy tính của lập trình viên.
2. **Tận dụng Cụm CSDL PostgreSQL Sẵn có:** Operaton kết nối vào cùng server PostgreSQL đang chạy (`gafood-postgres-dev` trên cổng 5432), nhưng sử dụng một database hoàn toàn riêng biệt là `operaton_db` để tránh xung đột bảng với `devdb` của e-Office.
3. **Cơ chế Tự khởi tạo & Đợi CSDL (Wait-for-DB):** Sử dụng cờ `WAIT_FOR=postgres:5432` để đảm bảo Operaton chỉ khởi động sau khi PostgreSQL đã sẵn sàng nhận kết nối JDBC.

---

## 2. Kịch bản Khởi tạo Database `operaton_db`

Trước khi Operaton khởi động lần đầu, database `operaton_db` cần được tạo trên PostgreSQL:

```sql
-- Chạy trên cụm PostgreSQL hiện tại (gafood-postgres-dev)
SELECT 'CREATE DATABASE operaton_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'operaton_db')\gexec
```

Lệnh thực thi nhanh bằng Docker CLI từ terminal:
```bash
docker exec -i gafood-postgres-dev psql -U postgres -d postgres -c "CREATE DATABASE operaton_db;"
```
*(Nếu database đã tồn tại, lệnh bỏ qua an toàn).*

---

## 3. Nội dung Cấu hình `docker-compose.operaton.yml`

Vị trí tệp: `deploy/operaton/docker-compose.operaton.yml` (hoặc có thể dùng cờ `-f` gộp với compose dev).

```yaml
version: '3.8'

services:
  operaton:
    image: operaton/operaton:latest
    container_name: gafood-operaton-dev
    restart: unless-stopped
    ports:
      # Cổng REST API và Webapps (Cockpit/Admin)
      - "8080:8080"
    environment:
      # Cấu hình JDBC Driver cho PostgreSQL
      - DB_DRIVER=org.postgresql.Driver
      - DB_URL=jdbc:postgresql://gafood-postgres-dev:5432/operaton_db
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      # Đợi Postgres container sẵn sàng
      - WAIT_FOR=gafood-postgres-dev:5432
      # Cấu hình bộ nhớ JVM tối ưu cho môi trường Dev
      - JAVA_OPTS=-Xms256m -Xmx768m -XX:+UseG1GC
    networks:
      - gafood-dev-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/engine-rest/version || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

networks:
  gafood-dev-network:
    external: true
    name: backend_default # Kết nối chung network với backend dev compose
```

> [!NOTE]
> Trong môi trường dev local, nếu backend chạy trực tiếp ngoài máy host (Node.js `:3333`), Backend sẽ kết nối tới Operaton qua `http://localhost:8080/engine-rest`.  
> Còn container Operaton kết nối tới PostgreSQL container thông qua Docker network (`gafood-postgres-dev:5432`).

---

## 4. Hướng dẫn Vận hành & Kiểm tra Sức khỏe (Health Check)

### 4.1 Khởi động và Dừng dịch vụ
```bash
# Khởi động Operaton ngầm
docker compose -f deploy/operaton/docker-compose.operaton.yml up -d

# Xem log khởi động
docker logs -f gafood-operaton-dev

# Dừng dịch vụ
docker compose -f deploy/operaton/docker-compose.operaton.yml down
```

### 4.2 Kiểm tra Trạng thái Sẵn sàng qua REST API
Mở trình duyệt hoặc dùng `curl` kiểm tra endpoint:
```bash
curl http://localhost:8080/engine-rest/version
```
**Kết quả mong đợi:**
```json
{"version":"1.0.0-..."}
```

### 4.3 Truy cập Web Dashboard Giám sát (Cockpit / Admin)
- Đường dẫn: `http://localhost:8080/operaton/app/`
- Tài khoản mặc định:
  - **Username:** `demo`
  - **Password:** `demo`
*(Chỉ dùng cho mục đích quản trị và kiểm tra trực quan, người dùng cuối e-Office không truy cập màn hình này).*

