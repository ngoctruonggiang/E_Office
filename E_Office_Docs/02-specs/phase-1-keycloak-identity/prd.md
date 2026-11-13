# PRD — Phase 1: Keycloak IAM & Đồng bộ User / Phòng ban / Chức danh

**Trạng thái:** `APPROVED` (Phase 1)  
**Phụ trách:** AI Coordinator & Người dùng  
**Tài liệu liên quan:** [auth-keycloak-architecture.md](../../01-architecture/auth-keycloak-architecture.md), [04-traceability-matrix.md](../../00-overview/04-traceability-matrix.md), [docker-setup-spec.md](./docker-setup-spec.md).

---

## 1. Bối cảnh & Mục tiêu

Sau khi hoàn thành thử nghiệm vận hành quy trình và xử lý các lỗi tương tác giao diện ở Phase 3 & 4, hệ thống e-Office cần một cơ chế định danh tập trung chuẩn doanh nghiệp.
Mục tiêu cốt lõi của **Phase 1** là:
1. **Thiết lập Hạ tầng IAM Độc lập:** Dựng Keycloak Server phiên bản 26.x thông qua Docker Compose độc lập, tự động nạp cấu hình Realm `e-office`.
2. **Cung cấp Luồng Đăng nhập Đơn lẻ (SSO):** Cho phép người dùng đăng nhập bằng tài khoản Keycloak qua chuẩn OIDC / PKCE.
3. **Đồng bộ Thông tin Danh bạ Đầy đủ:** Mỗi người dùng khi đăng nhập sẽ được đồng bộ đầy đủ **Họ tên, Email, Phòng ban (Department) và Chức danh (Job Title)** vào cơ sở dữ liệu e-Office.
4. **Hỗ trợ Hiển thị Rõ nét khi Gán Tác nhân (Actor Assignment):** Tại màn hình cấu hình thủ tục và màn hình nộp đơn, tác nhân phê duyệt hiển thị rõ `Nguyễn Văn A (Trưởng phòng Mua hàng - Phòng Kế hoạch)` thay vì chỉ hiển thị email hoặc ID khó nhận biết.
5. **Duy trì Cơ chế Dual-Auth:** Hỗ trợ song song cả tài khoản Local và Keycloak SSO để các kịch bản test tự động và dev cục bộ không bị ảnh hưởng.

---

## 2. Phạm vi Nghiệp vụ & Ranh giới (Scope & Boundaries)

### 2.1 Trong phạm vi Phase 1
- File Docker Compose chạy Keycloak 26.x (`deploy/keycloak/docker-compose.keycloak.yml`) kết nối PostgreSQL container `gafood-postgres-dev` với database `keycloak_db` trên cổng `8081`.
- File cấu hình Realm mẫu (`deploy/keycloak/realm-export.json`) nạp sẵn:
  - Realm: `e-office`
  - Client: `eoffice-web` (Public client cho Next.js với PKCE) và `eoffice-api` (Bearer-only cho NestJS).
  - Các roles: `admin`, `user`.
  - Các thuộc tính tùy biến: `department`, `jobTitle`.
  - Danh sách tài khoản mẫu hoàn chỉnh (Admin, Giám đốc, Trưởng phòng Mua sắm, Chuyên viên Kế toán).
- Backend NestJS:
  - Triển khai `KeycloakOidcProvider` implements `AuthProvider`.
  - Endpoint xác thực token Keycloak và cấp session e-Office: `POST /auth/sso/session`.
  - Endpoint cấu hình SSO: `GET /auth/sso/config`.
  - Migration Prisma: thêm `keycloakSub` (unique), chuyển `passwordHash` sang optional.
  - Tự động upsert User & OrganizationMember khi đăng nhập SSO.
- Frontend Next.js:
  - Nút "Đăng nhập bằng Keycloak SSO" trên trang Login.
  - Xử lý chuyển hướng PKCE và trang tiếp nhận callback `/auth/sso/callback`.
  - Cập nhật hiển thị Chức danh và Phòng ban trong `ActorAssignmentTab` và danh bạ nhân sự.

### 2.2 Ngoài phạm vi Phase 1 (Dành cho Phase 6)
- Chưa cấu hình Dynamic Role Resolution phức tạp (tự động tính toán "Trưởng phòng của người nộp đơn" theo cây Organization phân cấp) &rarr; Thuộc **Phase 6**.
- Chưa đồng bộ định kỳ 2 chiều bằng background cron job (chỉ đồng bộ theo cơ chế Just-In-Time khi người dùng đăng nhập SSO) &rarr; Thuộc **Phase 6**.

---

## 3. Chân dung Người dùng & User Stories

### US-IAM-01: Người dùng đăng nhập một chạm bằng Keycloak SSO
> **Là một** Nhân viên công ty,  
> **Tôi muốn** bấm vào nút "Đăng nhập bằng Keycloak SSO" để đăng nhập vào e-Office bằng tài khoản công ty,  
> **Để** tôi không phải ghi nhớ thêm mật khẩu riêng biệt cho hệ thống e-Office.

### US-IAM-02: Quản trị viên khởi chạy Keycloak bằng 1 câu lệnh Docker
> **Là một** Quản trị hệ thống (DevOps / Admin),  
> **Tôi muốn** khởi chạy Keycloak qua Docker Compose với cấu hình realm sẵn có,  
> **Để** môi trường phát triển và kiểm thử có thể dựng lên chỉ trong vài chục giây mà không cần cấu hình thủ công.

### US-IAM-03: Chuyên viên quy trình nhận diện rõ ràng người duyệt theo Phòng ban & Chức danh
> **Là một** Người thiết lập thủ tục (Procedure Designer),  
> **Tôi muốn** khi chọn người duyệt tại Tab "Người duyệt", danh sách hiển thị rõ ràng: Họ tên kèm Chức danh và Phòng ban (ví dụ: *Trần Thị B - Trưởng phòng Kế toán*),  
> **Để** tôi không gán nhầm người duyệt khi có nhiều người trùng họ tên.

### US-IAM-04: Lập trình viên kiểm thử linh hoạt với tài khoản nội bộ (Local Auth)
> **Là một** Lập trình viên / QA Tester,  
> **Tôi muốn** vẫn có thể đăng nhập bằng tài khoản email/mật khẩu `admin@gafood.local` khi cần test offline,  
> **Để** các kiểm thử hồi quy và integration test không phụ thuộc 100% vào việc container Keycloak đang mở.

---

## 4. Tiêu chí Chấp thuận (Acceptance Criteria)

- [ ] **AC-IAM-01:** Keycloak container khởi chạy thành công qua Docker Compose trên cổng `8081`, nạp sẵn Realm `e-office` và trả về `200 OK` khi truy cập endpoint OpenID Configuration: `http://localhost:8081/realms/e-office/.well-known/openid-configuration`.
- [ ] **AC-IAM-02:** Người dùng bấm "Đăng nhập Keycloak SSO" từ Frontend e-Office, hoàn tất đăng nhập trên màn hình Keycloak và được chuyển hướng về trang chủ e-Office với trạng thái đăng nhập thành công.
- [ ] **AC-IAM-03:** Backend xác thực chữ ký token từ Keycloak thông qua JWKS public certs và upsert thành công User vào CSDL e-Office kèm `keycloakSub`, `email`, `displayName`, `department`, `title`.
- [ ] **AC-IAM-04:** Tại màn hình quản lý Thủ tục (`ProcedureBuilder`), tab "Người duyệt" hiển thị chính xác tên, phòng ban và chức danh của các tài khoản đồng bộ từ Keycloak.
- [ ] **AC-IAM-05:** Chế độ Local Auth (`admin@gafood.local`) tiếp tục hoạt động bình thường mà không bị ảnh hưởng.
