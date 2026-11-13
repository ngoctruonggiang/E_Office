# Kế hoạch Kiểm thử (Test Plan) — Phase 1: Keycloak IAM & Đồng bộ

**Trạng thái:** `APPROVED` (Phase 1)  
**Tài liệu liên quan:** [auth-keycloak-architecture.md](../../01-architecture/auth-keycloak-architecture.md), [prd.md](./prd.md), [api-contract.md](./api-contract.md).

---

## 1. Mục tiêu Kiểm thử
Xác minh 100% tính năng định danh và đồng bộ:
1. Container Keycloak khởi động thành công và tự động nhập Realm `e-office`.
2. Đăng nhập SSO Keycloak phát hành Token hợp lệ.
3. Backend e-Office xác thực chữ ký số RS256 qua JWKS Certs.
4. Thông tin người dùng (`keycloakSub`, `email`, `displayName`, `department`, `title`) được đồng bộ đầy đủ vào cơ sở dữ liệu.
5. Danh bạ và màn hình cấu hình thủ tục hiển thị đúng phòng ban và chức danh.
6. Hệ thống chạy song song ổn định, không làm hỏng cơ chế đăng nhập nội bộ (Local Auth).

---

## 2. Ma trận Kịch bản Kiểm thử (Test Cases)

| Mã TC | Phân loại | Mục tiêu kiểm thử | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **`TC-IAM-01`** | Infrastructure | Khởi chạy Keycloak Docker & Tự nạp Realm | 1. Chạy `docker compose up -d`.<br>2. Gọi `GET http://localhost:8081/realms/e-office/.well-known/openid-configuration`. | HTTP 200, trả về cấu hình JSON chứa `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`. |
| **`TC-IAM-02`** | Security / JWKS | Truy vấn Public Keys JWKS | Gọi `GET http://localhost:8081/realms/e-office/protocol/openid-connect/certs`. | HTTP 200, trả về mảng `keys` với thuật toán `RS256` và `kty: "RSA"`. |
| **`TC-IAM-03`** | Authentication | Đăng nhập tài khoản Keycloak mẫu | Gửi yêu cầu lấy token bằng tài khoản `buyer@gafood.local` / `user123`. | Nhận được `access_token` hợp lệ chứa các claims `sub`, `email`, `department: "Phòng Mua Hàng"`, `jobTitle: "Trưởng Phòng Mua Hàng"`. |
| **`TC-IAM-04`** | Backend Integration | Đổi Token Keycloak lấy Phiên e-Office | Gửi `POST /auth/sso/session` kèm `accessToken` nhận được từ Keycloak. | HTTP 200, Backend verify JWKS thành công, tạo/cập nhật User trong DB và trả về e-Office `accessToken`. |
| **`TC-IAM-05`** | Data Sync & UI | Hiển thị Phòng ban & Chức danh trong Thủ tục | 1. Đăng nhập e-Office.<br>2. Mở màn hình cấu hình Thủ tục Tab "Người duyệt".<br>3. Kiểm tra thông tin người dùng được gán. | Người dùng hiển thị đầy đủ: `Nguyễn Văn Mua Sắm`, kèm nhãn `Phòng Mua Hàng` và chức danh `Trưởng Phòng Mua Hàng`. |
| **`TC-IAM-06`** | Regression / Dual-Auth | Kiểm tra hồi quy Đăng nhập Nội bộ | Gửi `POST /auth/login` bằng tài khoản `admin@gafood.local` / `admin@P@ssw0rd123`. | Đăng nhập thành công bình thường, không bị ảnh hưởng bởi Keycloak. |

---

## 3. Tiêu chí Hoàn thành Phase 1 (Exit Criteria)
1. Tất cả 6 Test Cases trên đều `PASS`.
2. Không phát sinh lỗi compile trên cả Backend NestJS (`npm run build`) và Frontend Next.js (`npm run build`).
3. Cập nhật ma trận truy vết [04-traceability-matrix.md](../../00-overview/04-traceability-matrix.md) từ `DRAFT` sang `VERIFIED`.
