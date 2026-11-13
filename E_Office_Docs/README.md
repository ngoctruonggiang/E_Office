# E_Office_Docs — Trung tâm Tài liệu Kiến trúc & Đặc tả (Docs-First, Zero-Drift)

Thư mục này là **Single Source of Intent & Specification** cho lộ trình nâng cấp hệ thống **GAFOOD E-Office** sang kiến trúc 3 trụ cột độc lập nhưng tương thích chặt chẽ: **Keycloak (IAM)** — **Operaton (BPMN Workflow Engine)** — **e-Office (Biểu mẫu linh hoạt, Procedure & Ký số PDF)**.

Tài liệu tham khảo trực quan ban đầu của team: [`architecture_operatioin_eoffice.md`](./architecture_operatioin_eoffice.md).

---

## 1. Quy tắc làm việc bắt buộc ("Tài liệu trước — Code sau")

1. **Mỗi Phase gồm 2 lượt tách biệt (`Lượt A: Spec` -> `Lượt B: Code & Verify`):**
   - **Lượt A (`[Phase X - Spec]`):** Viết đầy đủ đặc tả vào `01-architecture/` và `02-specs/phase-X-*/`, kiểm tra bằng [`doc-review-checklist.md`](./03-checklists/doc-review-checklist.md), và dừng lại chờ duyệt (`Status: APPROVED`).
   - **Lượt B (`[Phase X - Code]`):** Chỉ bắt đầu sửa `backend/` hoặc `frontend/` sau khi Spec của Phase X đã chuyển sang `APPROVED`.
2. **Code phải khớp 100% với Tài liệu:**
   - Tên model/cột Prisma, tên biến BPMN (`var_*`, `actor_*`, `actorList_*`), HTTP endpoints, DTOs, mã lỗi, quy tắc quyền và i18n keys trong code phải trùng khớp tuyệt đối với Spec.
   - Nếu khi code phát hiện điểm bất khả thi hoặc cần đổi thiết kế: **dừng code**, cập nhật Spec + ghi nhận trong `00-overview/adr/`, báo duyệt lại trước khi sửa tiếp.
3. **Phân vai giữa `E_Office_Docs/` và docs nội bộ code:**
   - `E_Office_Docs/`: Tài liệu thiết kế, hợp đồng tích hợp, PRD, Data Model, UI Spec và Kế hoạch Phase (viết **TRƯỚC** khi code).
   - `backend/docs/` & `frontend/docs/`: Tài liệu tham chiếu kỹ thuật đi sát từng file/module code (cập nhật đồng bộ **SAU** khi hoàn thành code Phase đó).

---

## 2. Vòng đời trạng thái của tài liệu & yêu cầu

| Trạng thái | Ý nghĩa | Cho phép code? |
|---|---|---|
| `DRAFT` | Đang soạn thảo đặc tả | Không |
| `REVIEW` | Đã hoàn thiện, chờ người phụ trách duyệt | Không |
| `APPROVED` | Đã chốt thiết kế, mở khóa cho Lượt B | **Có** |
| `IMPLEMENTED` | Code đã viết xong theo đúng đặc tả | — |
| `VERIFIED` | Đã pass lint/build/test, audit lệch tài liệu = 0, đã đồng bộ `backend/docs` & `frontend/docs` | Đóng hạng mục |

---

## 3. Bản đồ thư mục `E_Office_Docs/`

```text
E_Office_Docs/
├── README.md                                  # Tài liệu này (quy tắc Docs-First & mục lục)
├── architecture_operatioin_eoffice.md         # Tài liệu tổng quan kiến trúc 3 trụ cột (tham khảo nền)
├── 00-overview/
│   ├── 01-vision-and-3-pillars.md             # Bức tranh tổng thể & đối chiếu codebase hiện tại
│   ├── 02-glossary.md                         # Từ điển thuật ngữ thống nhất
│   ├── 03-roadmap-phases.md                   # Lộ trình Phase 0 -> Phase 6 (Entry/Exit/Risks)
│   ├── 04-traceability-matrix.md              # Ma trận truy vết Req <-> Spec <-> Code <-> Test
│   └── adr/
│       ├── ADR-001-form-layout-json.md        # Tách Data Schema (EAV) & Layout JSON Schema
│       ├── ADR-002-operaton-variable-conventions.md  # Chuẩn biến BPMN & REST Server-to-Server
│       ├── ADR-003-requestor-actor-override.md       # Người trình xem trước & sửa tác nhân
│       ├── ADR-004-state-sync-and-revise-lifecycle.md # Đồng bộ trạng thái & Revise/Cancel trên BPMN
│       └── ADR-005-version-pinning.md         # Ghim phiên bản FormVersion + Procedure + ProcessDef
├── 01-architecture/                           # Bổ sung ở Phase 1 & 3 (chi tiết network, Keycloak, Operaton)
├── 02-specs/                                  # Đặc tả chi tiết từng Phase (mở khóa từng phase theo thứ tự)
│   └── phase-2-form-layout-engine/            # [VERIFIED] Phase 2: Flexible Form & Layout Engine
│       ├── prd.md                             # Mục tiêu, User Stories, Phạm vi & Ràng buộc
│       ├── data-model.md                      # Prisma FieldType.TABLE, layoutSchema, tableConfig & Version Fork Policy
│       ├── layout-schema-spec.md              # LayoutSchemaV1, visibleWhen AST, TABLE config & Fallback normalizer
│       ├── api-contract.md                    # Endpoints (/forms/versions/:versionId) & Request EAV Validator
│       ├── ui-wireframe-and-rules.md          # GAFOOD × RAMP FormBuilder 3 cột, Live Preview, FormRenderer & i18n
│       └── test-plan.md                       # Unit, E2E & UI verification cases (TC-FRM-*)
└── 03-checklists/
    ├── doc-review-checklist.md                # Cổng duyệt tài liệu trước khi code
    └── code-compliance-checklist.md           # Cổng kiểm tra code khớp tài liệu trước khi đóng Phase
```

