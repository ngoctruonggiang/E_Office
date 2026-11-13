# Checklist Kiểm tra Tuân thủ Tài liệu Sau khi Code (`Code-Compliance Gate`)

Áp dụng ở cuối **Lượt B (`[Phase X - Code & Verify]`)** trước khi đánh dấu hạng mục là `VERIFIED` và chuyển sang Phase tiếp theo.

## 1. Đối chiếu Code khớp 100% với Spec (`Zero-Drift`)
- [ ] Tên bảng/cột trong `backend/prisma/schema/*.prisma` khớp chính xác với `data-model.md`.
- [ ] Mọi endpoint, DTO validation, response shape và error code khớp chính xác với `api-contract.md`.
- [ ] Mọi biến BPMN (`var_*`, `actor_*`, `actorList_*`) và hành vi chuyển bước khớp chính xác với `operaton-engine-contract.md` / `bpmn-modeling-standards.md`.
- [ ] Giao diện mới tái sử dụng đúng `frontend/components/ui/*`, giữ nguyên i18n `vi.ts`/`en.ts` và tuân thủ `ui-spec.md`.
- [ ] Nếu có bất kỳ thay đổi nào phát sinh trong lúc code, tài liệu Spec & ADR trong `E_Office_Docs/` đã được cập nhật **trước** khi kết thúc code.

## 2. Kiểm thử & Chất lượng Build
- [ ] Đã viết và chạy đủ test cases trong `test-plan.md` của Phase (Unit + Integration / E2E), toàn bộ pass không skip/nới lỏng assertion.
- [ ] Backend build sạch (`npm --prefix backend run build`) và Prisma migrations áp dụng sạch (`prisma migrate deploy` / `status`).
- [ ] Frontend lint các file đã sửa/tạo mới sạch (`0` lỗi) và build production sạch (`npm --prefix frontend run build`).

## 3. Đồng bộ Tài liệu tham chiếu & Graphify
- [ ] Cập nhật tài liệu module tương ứng trong `backend/docs/` và `frontend/docs/` (xóa/sửa cả phần drift nếu chạm vào module cũ).
- [ ] Cập nhật trạng thái trong [`04-traceability-matrix.md`](../00-overview/04-traceability-matrix.md) sang `VERIFIED`.
- [ ] Chạy `graphify update .` để đồng bộ knowledge graph `graphify-out/`.

