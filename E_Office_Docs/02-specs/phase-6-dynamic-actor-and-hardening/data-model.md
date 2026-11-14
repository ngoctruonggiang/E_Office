# Mô hình Dữ liệu (Data Model) — Phase 6: Cấu trúc Quy tắc Tác nhân Động

**Trạng thái:** `APPROVED` (Phase 6 Spec)  
**Tài liệu liên quan:** [dynamic-actor-rules.md](./dynamic-actor-rules.md), [prd.md](./prd.md).

---

## 1. Cấu trúc Mô hình Thực thể `ProcedureActorMapping`

Vị trí tệp: `backend/prisma/schema/procedure.prisma`

```prisma
model ProcedureActorMapping {
  id                 String            @id @default(uuid())
  procedureVersionId String
  taskDefinitionKey  String
  taskName           String
  order              Int
  // Phân loại: DIRECT_USER (Cố định) | DYNAMIC_RULE (Quy tắc động)
  assigneeType       ActorAssigneeType @default(DIRECT_USER)
  // Dùng khi assigneeType == DIRECT_USER
  defaultUserId      String?
  // Cấu hình chi tiết khi assigneeType == DYNAMIC_RULE
  ruleConfig         Json?
  // Cờ cho phép người nộp đơn sửa/đổi người duyệt lúc nộp
  allowOverride      Boolean           @default(true)
  required           Boolean           @default(true)
  isMultiInstance    Boolean           @default(false)
  collectionVariable String?

  procedureVersion ProcedureVersion @relation(fields: [procedureVersionId], references: [id], onDelete: Cascade)
  defaultUser      User?            @relation("ProcedureActorUser", fields: [defaultUserId], references: [id], onDelete: SetNull)

  @@unique([procedureVersionId, taskDefinitionKey])
  @@map("procedure_actor_mappings")
}
```

---

## 2. Đặc tả JSON Schema cho `ruleConfig`

Khi `assigneeType === 'DYNAMIC_RULE'`, trường `ruleConfig` lưu đối tượng JSON với cấu trúc chuẩn sau:

```typescript
export type DynamicActorRuleType =
  | 'DIRECT_MANAGER'         // Trưởng phòng / Quản lý trực tiếp của người nộp đơn
  | 'DEPARTMENT_TITLE'       // Người giữ chức danh tại phòng ban chỉ định
  | 'REQUESTOR_DEPT_TITLE';  // Người giữ chức danh tại chính phòng ban của người nộp đơn

export type DynamicActorFallbackStrategy =
  | 'PARENT_MANAGER'         // Leo lên Manager của đơn vị cha (mặc định)
  | 'SPECIFIC_USER'          // Gán cho nhân sự dự phòng chỉ định
  | 'BLOCK_SUBMISSION';      // Chặn nộp hồ sơ kèm thông báo lỗi

export interface DynamicActorRuleConfig {
  /** Loại quy tắc động */
  ruleType: DynamicActorRuleType;

  /** Tên phòng ban áp dụng (dùng cho DEPARTMENT_TITLE) */
  departmentName?: string | null;

  /** ID phòng ban trên cây Organization nếu có */
  departmentId?: string | null;

  /** Tên chức danh cần tìm (ví dụ: 'Kế toán trưởng', 'Trưởng phòng') */
  targetJobTitle?: string | null;

  /** Chiến lược xử lý khi khuyết người hoặc không tìm thấy */
  fallbackStrategy: DynamicActorFallbackStrategy;

  /** ID User dự phòng khi fallbackStrategy === 'SPECIFIC_USER' */
  fallbackUserId?: string | null;

  /** Tên hiển thị của User dự phòng (phục vụ hiển thị UI) */
  fallbackUserName?: string | null;
}
```

### Ví dụ JSON thực tế:

#### Ví dụ 1: Quy tắc Trưởng phòng trực tiếp
```json
{
  "ruleType": "DIRECT_MANAGER",
  "fallbackStrategy": "PARENT_MANAGER"
}
```

#### Ví dụ 2: Quy tắc Kế toán trưởng tại Phòng Tài Chính Kế Toán
```json
{
  "ruleType": "DEPARTMENT_TITLE",
  "departmentName": "Phòng Tài Chính Kế Toán",
  "targetJobTitle": "Kế Toán Trưởng",
  "fallbackStrategy": "SPECIFIC_USER",
  "fallbackUserId": "062dc4f3-d223-4feb-82b5-5ce5f818cdb9",
  "fallbackUserName": "Quản Trị Viên Hệ Thống"
}
```

---

## 3. Liên kết CSDL với Cây Tổ chức (`Organization`)

Quá trình phân giải tác nhân động liên kết chặt chẽ với cấu trúc bảng đã có:
- **`organizations`:**
  - `id`: Khóa chính.
  - `name`: Tên phòng ban / công ty (khớp với `User.department`).
  - `parentId`: Trỏ tới đơn vị cấp trên (phục vụ chiến lược `PARENT_MANAGER`).
- **`organization_members`:**
  - `userId`: Trỏ tới `User.id`.
  - `organizationId`: Trỏ tới `Organization.id`.
  - `role`: `'manager'` (Cấp quản lý / Trưởng đơn vị) hoặc `'member'` (Nhân viên).
- **`users`:**
  - `department`: Tên phòng ban.
  - `title`: Tên chức danh nghiệp vụ.
