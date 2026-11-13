# Checklist Duyệt Tài liệu Đặc tả Trước khi Code (`Doc-Review Gate`)

Áp dụng ở cuối **Lượt A (`[Phase X - Spec]`)** cho mọi Phase trước khi chuyển sang trạng thái `APPROVED` và mở khóa code.

## 1. Tính đầy đủ của bộ tài liệu Phase
- [ ] Đã có đủ các tài liệu đặc tả theo danh sách trong `03-roadmap-phases.md` (`prd.md`, `data-model.md`, `api-contract.md`, `ui-spec.md`, `test-plan.md`, và file tích hợp nếu có).
- [ ] Mọi thuật ngữ đều khớp 100% với [`02-glossary.md`](../00-overview/02-glossary.md).
- [ ] Nếu có thay đổi kiến trúc mới, đã lập hoặc cập nhật `ADR-*` trong `00-overview/adr/`.

## 2. Tính rõ ràng & Không mơ hồ (Dev đọc là code được ngay)
- [ ] **Schema / Prisma:** Ghi rõ tên model, tên field, kiểu dữ liệu, nullable/default, unique/index và cách migrate dữ liệu đang có.
- [ ] **API Contract:** Ghi rõ HTTP method, URL path, guard/role được phép gọi, Request DTO + validation rules, Response JSON mẫu, và mọi mã lỗi HTTP có thể trả về.
- [ ] **BPMN / Operaton Contract:** Ghi rõ `taskDefinitionKey`, biến `var_*`, biến `actor_*` / `actorList_*`, điều kiện Gateway và xử lý các luồng lỗi / từ chối / hủy.
- [ ] **UI Spec:** Khớp GAFOOD × RAMP Design System (`frontend/components/ui/*`), chỉ rõ trạng thái Loading, Empty, Error, Disabled, Permission gating và i18n keys (`vi` + `en`).

## 3. Kiểm tra mâu thuẫn & Truy vết
- [ ] Đối chiếu ngược với code hiện có: không làm gãy các module khác (`SignatureModule`, `DocumentModule`, `CommentModule`, `Organization`).
- [ ] Tất cả Requirement IDs của Phase đã được điền vào [`04-traceability-matrix.md`](../00-overview/04-traceability-matrix.md) và chuyển trạng thái `REVIEW` -> `APPROVED` bởi người phụ trách.

