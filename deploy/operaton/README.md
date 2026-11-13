# Hướng dẫn Khởi chạy Môi trường Operaton BPMN Engine (Dev)

Thư mục này chứa cấu hình hạ tầng Docker Compose và các mẫu quy trình BPMN chuẩn cho hệ thống **GAFOOD E-Office**.

---

## 1. Yêu cầu Tiền đề
- Docker & Docker Compose đã được cài đặt và đang chạy.
- Cụm PostgreSQL dev (`gafood-postgres-dev`) trên network `backend_default` đã được khởi động và đã có database `operaton_db`.

---

## 2. Lệnh Khởi chạy Container Operaton

```bash
# Khởi chạy Operaton container ngầm
docker compose -f deploy/operaton/docker-compose.operaton.yml up -d

# Xem logs khởi động
docker logs -f gafood-operaton-dev

# Dừng container khi không sử dụng
docker compose -f deploy/operaton/docker-compose.operaton.yml down
```

---

## 3. Các Cổng Dịch vụ & Endpoints

- **Operaton REST API:** `http://localhost:8080/engine-rest`
  - Kiểm tra phiên bản: `GET http://localhost:8080/engine-rest/version`
- **Operaton Cockpit / Admin Webapp:** `http://localhost:8080/operaton/app/`
  - Đăng nhập: `demo` / `demo`

---

## 4. Danh mục Quy trình BPMN Mẫu
- `bpmn-templates/e-office-purchase-flow-1.bpmn`: Mẫu quy trình yêu cầu mua sắm chuẩn e-Office (rẽ nhánh hạn mức 50 triệu đồng và tuần tự phê duyệt qua Trưởng phòng và Ban Giám đốc).

