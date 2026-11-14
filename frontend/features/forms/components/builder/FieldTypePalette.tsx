"use client";

import {
  Calendar,
  FolderPlus,
  Hash,
  Heading,
  List,
  Minus,
  Paperclip,
  Plus,
  Table2,
  Type,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { FIELD_TYPES } from "../../types/builder";
import type { FieldType, LayoutSection } from "../../types/form";

const icons: Record<FieldType, React.ReactNode> = {
  TEXT: <Type size={15} />,
  NUMBER: <Hash size={15} />,
  DATE: <Calendar size={15} />,
  SELECT: <List size={15} />,
  TABLE: <Table2 size={15} />,
};

const fieldTypeDescriptions: Record<FieldType, string> = {
  TEXT: "Văn bản, họ tên, lý do, ghi chú",
  NUMBER: "Số tiền, số lượng, định mức",
  DATE: "Ngày tháng, hạn hoàn thành",
  SELECT: "Danh mục chọn 1 hoặc nhiều",
  TABLE: "Bảng chi tiết lặp dòng, tính tổng",
};

export type LayoutBlockKind = "heading" | "divider" | "attachmentSlot";

/** Left rail: field types, decorative/attachment layout blocks, and section outline. */
export function FieldTypePalette({
  sections,
  activeSectionId,
  onAddField,
  onAddBlock,
  onAddSection,
  onSelectSection,
}: {
  sections: LayoutSection[];
  activeSectionId: string | null;
  onAddField: (type: FieldType) => void;
  onAddBlock: (kind: LayoutBlockKind) => void;
  onAddSection: () => void;
  onSelectSection: (sectionId: string) => void;
}) {
  const t = useT();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("formBuilder.fieldTypes")}
        </p>
        <div className="space-y-1.5">
          {FIELD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onAddField(type)}
              className="group flex w-full items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-surface-secondary"
            >
              <span className="mt-0.5 text-muted-foreground group-hover:text-primary">
                {icons[type]}
              </span>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-xs text-foreground">{t(`fieldType.${type}`)}</p>
                <p className="text-[10px] text-muted-foreground truncate">{fieldTypeDescriptions[type]}</p>
              </div>
              <Plus size={14} className="mt-0.5 text-muted-foreground group-hover:text-primary" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("formBuilder.layoutBlocks")}
        </p>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onAddBlock("heading")}
            className="group flex w-full items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-surface-secondary"
          >
            <Heading size={15} className="mt-0.5 text-muted-foreground group-hover:text-primary" />
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-xs text-foreground">{t("formBuilder.headingBlock")}</p>
              <p className="text-[10px] text-muted-foreground">Tiêu đề phân cách nhóm nội dung</p>
            </div>
            <Plus size={14} className="mt-0.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onAddBlock("divider")}
            className="group flex w-full items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-surface-secondary"
          >
            <Minus size={15} className="mt-0.5 text-muted-foreground group-hover:text-primary" />
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-xs text-foreground">{t("formBuilder.dividerBlock")}</p>
              <p className="text-[10px] text-muted-foreground">Đường kẻ ngang phân vùng thông tin</p>
            </div>
            <Plus size={14} className="mt-0.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onAddBlock("attachmentSlot")}
            className="group flex w-full items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-surface-secondary"
          >
            <Paperclip size={15} className="mt-0.5 text-muted-foreground group-hover:text-primary" />
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-xs text-foreground">{t("formBuilder.attachmentSlotBlock")}</p>
              <p className="text-[10px] text-muted-foreground">Vị trí hướng dẫn đính kèm hồ sơ</p>
            </div>
            <Plus size={14} className="mt-0.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-border-subtle pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddSection}
        >
          <FolderPlus size={14} />
          {t("formBuilder.addSection")}
        </Button>

        {sections.length > 0 && (
          <ul className="space-y-1 pt-1">
            {sections.map((sec, idx) => (
              <li key={sec.id}>
                <button
                  type="button"
                  onClick={() => onSelectSection(sec.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors",
                    sec.id === activeSectionId
                      ? "bg-highlight-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
                  )}
                >
                  <span className="truncate">
                    {idx + 1}. {sec.title || t("formBuilder.untitled")}
                  </span>
                  <span className="ml-2 shrink-0 text-[11px] tabular-nums">
                    {sec.rows.reduce((sum, r) => sum + r.items.length, 0)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        {t("formBuilder.addFieldHint")}
      </p>
    </div>
  );
}
