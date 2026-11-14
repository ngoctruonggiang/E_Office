# Hợp đồng API (API Contract) — Phase 1: Keycloak SSO & Xác thực

**Trạng thái:** `APPROVED` (Phase 1)  
**Tài liệu liên quan:** [auth-keycloak-architecture.md](../../01-architecture/auth-keycloak-architecture.md), [prd.md](./prd.md).

---

## 1. Danh sách Endpoints Xác thực SSO

Các endpoint này bổ sung vào module `AuthModule` (`backend/src/modules/auth/`) mà không làm thay đổi các endpoint đăng nhập nội bộ (`/auth/login`, `/auth/refresh`, `/auth/logout`).

---

### 1.1 Lấy Cấu hình SSO
- **Phương thức:** `GET`
- **Đường dẫn:** `/auth/sso/config`
- **Mục đích:** Cung cấp thông tin cấu hình Keycloak cho Frontend để thực hiện chuyển hướng PKCE.
- **Quyền truy cập:** Công khai (`Public`).

#### Phản hồi Thành công (`200 OK`):
```json
{
  "enabled": true,
  "provider": "keycloak",
  "issuer": "http://localhost:8081/realms/e-office",
  "clientId": "eoffice-web",
  "authUrl": "http://localhost:8081/realms/e-office/protocol/openid-connect/auth",
  "tokenUrl": "http://localhost:8081/realms/e-office/protocol/openid-connect/token",
  "logoutUrl": "http://localhost:8081/realms/e-office/protocol/openid-connect/logout"
}
```

---

### 1.2 Tạo Phiên làm việc e-Office từ Token Keycloak
- **Phương thức:** `POST`
- **Đường dẫn:** `/auth/sso/session`
- **Mục đích:** Tiếp nhận Access Token được cấp bởi Keycloak sau khi Frontend hoàn thành luồng PKCE. Backend kiểm tra chữ ký RS256 qua JWKS, đồng bộ thông tin User/Phòng ban/Chức danh, và trả về bộ Token phiên làm việc chuẩn của e-Office.
- **Quyền truy cập:** Công khai (`Public`).

#### Yêu cầu (Request Body):
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEyMyJ9...",
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEyMyJ9..."
}
```

#### Phản hồi Thành công (`200 OK`):
```json
{
  "user": {
    "userId": "d7a46e10-9b36-4c28-98e3-b924cefd8920",
    "email": "buyer@gafood.local",
    "role": "user",
    "displayName": "Nguyễn Văn Mua Sắm",
    "department": "Phòng Mua Hàng",
    "title": "Trưởng Phòng Mua Hàng"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600
  }
}
```

#### Các mã lỗi thường gặp:
- `400 Bad Request`: `accessToken` bị thiếu hoặc không đúng định dạng JWT.
- `401 Unauthorized`: Chữ ký JWT không hợp lệ (sai key hoặc Keycloak chưa phát hành), token đã hết hạn, hoặc `issuer` không khớp với Realm `e-office`.

---

### 1.3 Lấy Thông tin Tài khoản Hiện tại (`/auth/me`)
- **Phương thức:** `GET`
- **Đường dẫn:** `/auth/me`
- **Mục đích:** Trả về thông tin đầy đủ của User đang đăng nhập (bao gồm cả `keycloakSub`, `department`, `title`).
- **Quyền truy cập:** Yêu cầu Bearer Token (`JwtAuthGuard`).

#### Phản hồi Thành công (`200 OK`):
```json
{
  "id": "d7a46e10-9b36-4c28-98e3-b924cefd8920",
  "email": "buyer@gafood.local",
  "displayName": "Nguyễn Văn Mua Sắm",
  "role": "user",
  "department": "Phòng Mua Hàng",
  "title": "Trưởng Phòng Mua Hàng",
  "keycloakSub": "7c1264c1-6925-4c07-ba71-fa5eb28c89c7",
  "isActive": true
}
```

---

## 2. Quy trình Xác thực Token Backend (JWKS Verification)

Khi nhận `accessToken` tại endpoint `/auth/sso/session`:
1. Trích xuất header của JWT để lấy trường `kid` (Key ID) và thuật toán `alg` (bắt buộc `RS256`).
2. Sử dụng thư viện `jwks-rsa` để tìm public certificate tương ứng từ cache hoặc gọi tới:
   `http://localhost:8081/realms/e-office/protocol/openid-connect/certs`.
3. Kiểm tra chữ ký số bằng Public Key trích xuất từ JWKS.
4. Kiểm tra các trường ràng buộc:
   - `iss == "http://localhost:8081/realms/e-office"` (hoặc biến môi trường `KEYCLOAK_ISSUER_URL`).
   - `exp > current_timestamp`.
5. Đọc Payload & Claims để phục vụ đồng bộ dữ liệu.

