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
│   ├── 05-operaton-workflow-architecture-and-modeler.md # Phân tích chuyên sâu Operaton Engine vs Modeler & Tích hợp
│   └── adr/
│       ├── ADR-001-form-layout-json.md        # Tách Data Schema (EAV) & Layout JSON Schema
│       ├── ADR-002-operaton-variable-conventions.md  # Chuẩn biến BPMN & REST Server-to-Server
│       ├── ADR-003-requestor-actor-override.md       # Người trình xem trước & sửa tác nhân
│       ├── ADR-004-state-sync-and-revise-lifecycle.md # Đồng bộ trạng thái & Revise/Cancel trên BPMN
│       ├── ADR-005-version-pinning.md         # Ghim phiên bản FormVersion + Procedure + ProcessDef
│       └── ADR-006-operaton-deployment-and-modeler-strategy.md # Triển khai Docker-first & Công cụ vẽ workflow 2 lớp
├── 01-architecture/                           # Thiết kế chi tiết hệ thống & hợp đồng liên dịch vụ
│   └── operaton-engine-contract.md            # [APPROVED] Hợp đồng kết nối Server-to-Server e-Office <-> Operaton
├── 02-specs/                                  # Đặc tả chi tiết từng Phase (mở khóa từng phase theo thứ tự)
│   ├── phase-2-form-layout-engine/            # [VERIFIED] Phase 2: Flexible Form & Layout Engine
│   │   ├── prd.md                             # Mục tiêu, User Stories, Phạm vi & Ràng buộc
│   │   ├── data-model.md                      # Prisma FieldType.TABLE, layoutSchema, tableConfig & Version Fork Policy
│   │   ├── layout-schema-spec.md              # LayoutSchemaV1, visibleWhen AST, TABLE config & Fallback normalizer
│   │   ├── api-contract.md                    # Endpoints (/forms/versions/:versionId) & Request EAV Validator
│   │   ├── ui-wireframe-and-rules.md          # GAFOOD × RAMP FormBuilder 3 cột, Live Preview, FormRenderer & i18n
│   │   └── test-plan.md                       # Unit, E2E & UI verification cases (TC-FRM-*)
│   ├── phase-3-operaton-adapter/              # [VERIFIED] Phase 3: Operaton Adapter & BPMN Engine
│       ├── prd.md                             # Mục tiêu, Phạm vi & Acceptance Criteria
│       ├── docker-setup-spec.md               # Cấu hình Docker Compose, operaton_db & healthcheck
│       ├── bpmn-modeling-standards.md         # Quy chuẩn đặt tên biến, UserTask, Gateway & Multi-instance
│       ├── api-contract.md                    # API Endpoints (/operaton/*) & Operaton REST client
│       ├── web-modeler-spec.md                # Đặc tả Web BPMN Modeler (nhúng bpmn-js trên e-Office)
│       └── test-plan.md                       # Kế hoạch test container, parser, execution & error handling
│   ├── phase-4-procedure-mapping/             # [VERIFIED] Phase 4: Lớp Cầu nối Procedure
│   │   ├── prd.md                             # Mục tiêu, Phạm vi & Acceptance Criteria (REQ-PRC-01, REQ-PRC-02)
│   │   ├── data-model.md                      # Prisma schema (Procedure, ProcedureVersion, ActorMapping, VariableMapping)
│   │   ├── mapping-rules.md                   # Quy tắc trích xuất biến, gán tác nhân kèm phòng ban/chức danh, validation
│   │   ├── api-contract.md                    # REST Endpoints (/procedures/*), Directory Helper & Version Pinning
│   │   ├── ui-wireframe-and-rules.md          # Wireframe Danh mục & Trình thiết kế Thủ tục 4 bước chuẩn GAFOOD × RAMP
│   │   └── test-plan.md                       # Kế hoạch kiểm thử Unit, E2E & Validation Engine (TC-PRC-*)
│   ├── phase-5-runtime-and-signing/           # [VERIFIED] Phase 5: Vận hành Run-time & Ký số PDF
│   │   ├── prd.md                             # Mục tiêu, User Stories & Acceptance Criteria (REQ-RUN-01..04)
│   │   ├── data-model.md                      # FormResponse, RequestActualActor, TaskProjection & SignatureField
│   │   ├── flow-preview-and-override.md       # Thuật toán mô phỏng luồng BPMN, đánh giá rẽ nhánh & ADR-003 override
│   │   ├── pdf-signing-integration.md         # Quy tắc ràng buộc "Ký trước - Duyệt sau", tích hợp hoàn thành task Operaton
│   │   ├── revise-cancel-lifecycle.md         # Máy trạng thái vòng đời, đồng bộ Operaton & nhân bản (CLONE)
│   │   ├── api-contract.md                    # REST Endpoints (/requests/*, /duty), DTOs & Error payloads
│   │   ├── ui-wireframe-and-rules.md          # Wizard 5 bước tạo yêu cầu, Detail split-view & My Duties screen
│   │   └── test-plan.md                       # Kế hoạch kiểm thử Unit, Integration & Scenarios (TC-RUN-*)
│   └── phase-6-dynamic-actor-and-hardening/   # [VERIFIED] Phase 6: Gán Tác nhân Động & Hardening
│       ├── prd.md                             # Mục tiêu, User Stories & Acceptance Criteria (REQ-DYN-01)
│       ├── data-model.md                      # JSON Schema ruleConfig trong ProcedureActorMapping
│       ├── dynamic-actor-rules.md             # Thuật toán duyệt cây tổ chức, chống tự duyệt & fallback
│       ├── api-contract.md                    # Endpoints (/procedures/helpers/org-titles, resolve-actors)
│       ├── ui-wireframe-and-rules.md          # ActorMappingTab UI, badge màu & FlowPreview subtitle
│       └── test-plan.md                       # Test cases TC-DYN-01..07
├── 03-checklists/
│   ├── doc-review-checklist.md                # Cổng duyệt tài liệu trước khi code
│   └── code-compliance-checklist.md           # Cổng kiểm tra code khớp tài liệu trước khi đóng Phase
├── 04-tech-lead-guide/                        # DÀNH CHO TRƯỞNG PHÒNG DEV / TECH LEAD
│   ├── README.md                              # Tầm nhìn kiến trúc & Lộ trình đọc trong 30 phút
│   ├── 01-system-architecture-blueprint.md    # Bản vẽ tổng thể 3 trụ cột, mạng lưới, bảo mật & luồng tích hợp
│   ├── 02-core-engine-and-data-models.md      # Mô hình dữ liệu lai (EAV + Layout JSON), BPMN, Procedure & Dynamic Actor
│   ├── 03-devops-deployment-and-security.md   # Hạ tầng Docker Compose, biến môi trường, backup/restore
│   └── 04-engineering-handbook.md             # Chuẩn mực code, quy tắc Docs-First, checklist review PR
└── 05-customer-guide/                         # DÀNH CHO KHÁCH HÀNG & NGƯỜI DÙNG DOANH NGHIỆP
    ├── README.md                              # Hướng dẫn tra cứu theo vai trò sử dụng & từ điển nghiệp vụ
    ├── 01-tong-quan-he-thong.md               # 4 khái niệm cốt lõi (Biểu mẫu, Quy trình, Thủ tục, Hồ sơ) & Giao diện
    ├── 02-huong-dan-nguoi-nop-don.md          # Cẩm nang Nhân viên: Nộp đơn, xem luồng duyệt, đổi người duyệt, ký PDF
    ├── 03-huong-dan-nguoi-phe-duyet.md        # Cẩm nang Quản lý: Duyệt hồ sơ, ký số điện tử trên PDF, trả về yêu cầu sửa
    ├── 04-huong-dan-quan-tri-quy-trinh.md     # Cẩm nang Admin: Tạo phòng ban, dựng Form, vẽ BPMN, xuất bản Thủ tục
    └── 05-cau-hoi-thuong-gap-faq.md           # Giải đáp 8 tình huống thắc mắc phổ biến nhất trong thực tế
```

