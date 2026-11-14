"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, LayoutGrid, Save, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { LoadingState } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils/cn";
import { ApiError } from "@/lib/api/client";
import { createForm, getForm, updateForm } from "../../api/forms";
import { normalizeLayoutSchema } from "../../lib/layout";
import {
  appendItemToSection,
  buildLayoutPayload,
  draftFromView,
  newAttachmentSlotItem,
  newDividerItem,
  newField,
  newFieldLayoutItem,
  newHeadingItem,
  newSection,
  toFieldInput,
  uid,
  type BuilderSelection,
  type FieldDraft,
} from "../../types/builder";
import type {
  FieldType,
  LayoutItem,
  LayoutSection,
  VisibilityRuleGroup,
} from "../../types/form";
import { FieldTypePalette, type LayoutBlockKind } from "./FieldTypePalette";
import { LayoutCanvas } from "./LayoutCanvas";
import { LayoutInspectorPanel } from "./LayoutInspectorPanel";

export function FormBuilderScreen({ formId }: { formId?: string }) {
  const t = useT();
  const router = useRouter();
  const { notify } = useNotifications();
  const isEdit = Boolean(formId);

  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [sections, setSections] = useState<LayoutSection[]>(() => [
    newSection("Thông tin chung"),
  ]);
  const [selection, setSelection] = useState<BuilderSelection>(null);
  const [canvasMode, setCanvasMode] = useState<"design" | "preview">("design");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const draftStorageKey = `eoffice_builder_draft_${formId || "new"}`;
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Restore draft on mount for newly created forms
  useEffect(() => {
    if (formId) return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          (parsed.name ||
            (Array.isArray(parsed.fields) && parsed.fields.length > 0))
        ) {
          if (parsed.name) setName(parsed.name);
          if (parsed.fields && Array.isArray(parsed.fields))
            setFields(parsed.fields);
          if (parsed.sections && Array.isArray(parsed.sections))
            setSections(parsed.sections);
          setDraftRestored(true);
          if (parsed.savedAt) {
            setLastSavedTime(
              new Date(parsed.savedAt).toLocaleTimeString("vi-VN"),
            );
          }
        }
      }
    } catch (e) {
      console.warn("Could not load local draft:", e);
    }
  }, [formId, draftStorageKey]);

  // Continuous auto-save draft to localStorage (debounce 400ms)
  useEffect(() => {
    if (!name.trim() && fields.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const snapshot = {
          name,
          fields,
          sections,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
        setLastSavedTime(new Date().toLocaleTimeString("vi-VN"));
      } catch (e) {
        console.warn("Could not save local draft:", e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [name, fields, sections, draftStorageKey]);

  // Warn before browser unload/refresh if there is unsaved content
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (name.trim() || fields.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [name, fields]);

  const clearDraft = () => {
    if (confirm("Bạn có chắc chắn muốn xóa bản nháp và bắt đầu lại từ đầu?")) {
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {}
      setName("");
      setFields([]);
      setSections([newSection("Thông tin chung")]);
      setSelection(null);
      setDraftRestored(false);
      setLastSavedTime(null);
      notify({ title: "Đã làm mới biểu mẫu", kind: "info" });
    }
  };

  const handleCancel = () => {
    if (name.trim() || fields.length > 0) {
      if (
        !confirm(
          "Bản nháp của bạn đã được tự động lưu trên máy này. Bạn có chắc muốn rời đi không?",
        )
      ) {
        return;
      }
    }
    router.push("/forms");
  };

  useEffect(() => {
    if (!formId) return;
    let active = true;
    getForm(formId)
      .then((form) => {
        if (!active) return;
        setName(form.name);
        const drafts = form.fields.map(draftFromView);
        const normalized = normalizeLayoutSchema(
          form.name,
          form.fields,
          form.layoutSchema,
        );
        setFields(drafts);
        setSections(normalized.sections);
        const firstSec = normalized.sections[0];
        const firstItem = firstSec?.rows[0]?.items[0];
        if (firstSec && firstItem) {
          setSelection({
            kind: "item",
            sectionId: firstSec.id,
            rowId: firstSec.rows[0].id,
            itemId: firstItem.id,
          });
        } else if (firstSec) {
          setSelection({ kind: "section", sectionId: firstSec.id });
        }
      })
      .catch(() => notify({ title: t("common.error"), kind: "error" }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [formId, notify, t]);

  const activeSectionId =
    selection?.kind === "section" || selection?.kind === "item"
      ? selection.sectionId
      : (sections[sections.length - 1]?.id ?? null);

  const genKey = (prefix = "field") => {
    const existing = new Set(fields.map((f) => f.key));
    let n = fields.length + 1;
    let key = `${prefix}_${n}`;
    while (existing.has(key)) key = `${prefix}_${++n}`;
    return key;
  };

  const addField = (type: FieldType) => {
    const key = genKey(type === "TABLE" ? "table" : "field");
    const field = newField(type, key);
    const defaultSpan = type === "TABLE" ? 12 : 6;
    const item = newFieldLayoutItem(field.key, defaultSpan);

    const { sections: nextSecs, sectionId, rowId } = appendItemToSection(
      sections,
      activeSectionId,
      item,
    );
    setFields((fs) => [...fs, field]);
    setSections(nextSecs);
    setSelection({ kind: "item", sectionId, rowId, itemId: item.id });
  };

  const addBlock = (kind: LayoutBlockKind) => {
    const item =
      kind === "heading"
        ? newHeadingItem()
        : kind === "divider"
          ? newDividerItem()
          : newAttachmentSlotItem(`slot_${Date.now().toString(36)}`);
    const { sections: nextSecs, sectionId, rowId } = appendItemToSection(
      sections,
      activeSectionId,
      item,
    );
    setSections(nextSecs);
    setSelection({ kind: "item", sectionId, rowId, itemId: item.id });
  };

  const addSection = () => {
    const sec = newSection(`Nhóm ${sections.length + 1}`);
    setSections((ss) => [...ss, sec]);
    setSelection({ kind: "section", sectionId: sec.id });
  };

  const updateSection = (sectionId: string, patch: Partial<LayoutSection>) =>
    setSections((ss) =>
      ss.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    );

  const moveSection = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= sections.length) return;
    setSections((ss) => {
      const next = [...ss];
      const [moved] = next.splice(idx, 1);
      next.splice(nextIdx, 0, moved);
      return next;
    });
  };

  const deleteSection = (sectionId: string) => {
    const target = sections.find((s) => s.id === sectionId);
    if (!target || sections.length <= 1) return;
    const removedKeys = new Set<string>();
    for (const r of target.rows) {
      for (const it of r.items) {
        if (it.kind === "field") removedKeys.add(it.fieldKey);
      }
    }
    setFields((fs) => fs.filter((f) => !removedKeys.has(f.key)));
    setSections((ss) => ss.filter((s) => s.id !== sectionId));
    setSelection((cur) =>
      cur && cur.sectionId === sectionId ? null : cur,
    );
  };

  const addRow = (sectionId: string) =>
    setSections((ss) =>
      ss.map((s) =>
        s.id === sectionId
          ? { ...s, rows: [...s.rows, { id: uid("row"), items: [] }] }
          : s,
      ),
    );

  const updateItem = (
    sectionId: string,
    rowId: string,
    itemId: string,
    patch: Partial<LayoutItem>,
  ) =>
    setSections((ss) =>
      ss.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              rows: s.rows.map((r) =>
                r.id !== rowId
                  ? r
                  : {
                      ...r,
                      items: r.items.map((it) =>
                        it.id === itemId ? ({ ...it, ...patch } as LayoutItem) : it,
                      ),
                    },
              ),
            },
      ),
    );

  const moveItem = (
    sectionId: string,
    rowId: string,
    itemId: string,
    dir: "left" | "right" | "up" | "down",
  ) => {
    setSections((ss) =>
      ss.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const rows = sec.rows.map((r) => ({ ...r, items: [...r.items] }));
        const rIdx = rows.findIndex((r) => r.id === rowId);
        if (rIdx < 0) return sec;
        const iIdx = rows[rIdx].items.findIndex((it) => it.id === itemId);
        if (iIdx < 0) return sec;

        if (dir === "left" && iIdx > 0) {
          const [moved] = rows[rIdx].items.splice(iIdx, 1);
          rows[rIdx].items.splice(iIdx - 1, 0, moved);
        } else if (dir === "right" && iIdx < rows[rIdx].items.length - 1) {
          const [moved] = rows[rIdx].items.splice(iIdx, 1);
          rows[rIdx].items.splice(iIdx + 1, 0, moved);
        } else if (dir === "up" || dir === "down") {
          const targetRowIdx = dir === "up" ? rIdx - 1 : rIdx + 1;
          if (targetRowIdx < 0 || targetRowIdx >= rows.length) return sec;
          const moving = rows[rIdx].items[iIdx];
          const targetUsed = rows[targetRowIdx].items.reduce(
            (sum, x) => sum + x.colSpan,
            0,
          );
          if (targetUsed + moving.colSpan > 12) return sec;
          rows[rIdx].items.splice(iIdx, 1);
          rows[targetRowIdx].items.push(moving);
          setSelection({
            kind: "item",
            sectionId,
            rowId: rows[targetRowIdx].id,
            itemId,
          });
        }

        return { ...sec, rows: rows.filter((r) => r.items.length > 0) };
      }),
    );
  };

  const deleteItem = (sectionId: string, rowId: string, itemId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    const row = sec?.rows.find((r) => r.id === rowId);
    const target = row?.items.find((it) => it.id === itemId);

    if (target?.kind === "field") {
      setFields((fs) => fs.filter((f) => f.key !== target.fieldKey));
    }

    setSections((ss) =>
      ss.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              rows: s.rows
                .map((r) =>
                  r.id !== rowId
                    ? r
                    : { ...r, items: r.items.filter((i) => i.id !== itemId) },
                )
                .filter((r) => r.items.length > 0),
            },
      ),
    );
    setSelection((cur) =>
      cur?.kind === "item" && cur.itemId === itemId ? null : cur,
    );
  };

  const updateField = (fieldUid: string, patch: Partial<FieldDraft>) =>
    setFields((fs) =>
      fs.map((f) => (f.uid === fieldUid ? { ...f, ...patch } : f)),
    );

  const renameFieldKey = (
    fieldUid: string,
    oldKey: string,
    newKey: string,
  ) => {
    setFields((fs) =>
      fs.map((f) => {
        if (f.uid === fieldUid) return { ...f, key: newKey };
        if (f.type === "TABLE" && f.tableConfig?.summary?.aggregates) {
          return {
            ...f,
            tableConfig: {
              ...f.tableConfig,
              summary: {
                ...f.tableConfig.summary,
                aggregates: f.tableConfig.summary.aggregates.map((agg) =>
                  agg.targetFieldKey === oldKey
                    ? { ...agg, targetFieldKey: newKey }
                    : agg,
                ),
              },
            },
          };
        }
        return f;
      }),
    );

    const renameVis = (
      group: VisibilityRuleGroup | undefined,
    ): VisibilityRuleGroup | undefined =>
      group
        ? {
            ...group,
            rules: group.rules.map((r) =>
              r.fieldKey === oldKey ? { ...r, fieldKey: newKey } : r,
            ),
          }
        : undefined;

    setSections((ss) =>
      ss.map((sec) => ({
        ...sec,
        visibleWhen: renameVis(sec.visibleWhen),
        rows: sec.rows.map((r) => ({
          ...r,
          items: r.items.map((it) => ({
            ...it,
            ...(it.kind === "field" && it.fieldKey === oldKey
              ? { fieldKey: newKey }
              : {}),
            visibleWhen: renameVis(it.visibleWhen),
          })),
        })),
      })),
    );
  };

  const validate = (): { error: string; fieldKey?: string } | null => {
    if (!name.trim()) return { error: t("formBuilder.errors.nameRequired") };
    if (fields.length === 0)
      return { error: t("formBuilder.errors.fieldsRequired") };
    const keys = new Set<string>();
    for (const f of fields) {
      if (!f.key.trim())
        return { error: t("formBuilder.errors.keyRequired"), fieldKey: f.key };
      if (!f.label.trim())
        return {
          error: `Trường "${f.key}" chưa có nhãn hiển thị. Vui lòng đặt nhãn trước khi lưu.`,
          fieldKey: f.key,
        };
      if (keys.has(f.key))
        return {
          error: `Mã trường "${f.key}" bị trùng nhau. Vui lòng đổi mã khác.`,
          fieldKey: f.key,
        };
      keys.add(f.key);
      if (
        f.type === "SELECT" &&
        f.options.filter((o) => o.value.trim()).length === 0
      ) {
        return {
          error: `Trường lựa chọn "${f.label || f.key}" cần ít nhất một tùy chọn.`,
          fieldKey: f.key,
        };
      }
      if (
        f.type === "TABLE" &&
        (!f.tableConfig || f.tableConfig.columns.length === 0)
      ) {
        return {
          error: `Bảng dữ liệu "${f.label || f.key}" cần ít nhất một cột dữ liệu.`,
          fieldKey: f.key,
        };
      }
    }
    return null;
  };

  const save = async () => {
    const valResult = validate();
    if (valResult) {
      notify({ title: valResult.error, kind: "error" });
      if (valResult.fieldKey) {
        for (const sec of sections) {
          for (const r of sec.rows) {
            for (const it of r.items) {
              if (it.kind === "field" && it.fieldKey === valResult.fieldKey) {
                setSelection({
                  kind: "item",
                  sectionId: sec.id,
                  rowId: r.id,
                  itemId: it.id,
                });
                setCanvasMode("design");
                return;
              }
            }
          }
        }
      }
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        fields: fields.map(toFieldInput),
        layoutSchema: buildLayoutPayload(sections),
      };
      if (isEdit && formId) await updateForm(formId, payload);
      else await createForm(payload);
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {}
      notify({ title: t("forms.saved"), kind: "success" });
      router.push("/forms");
    } catch (err) {
      notify({
        title: t("forms.saveFailed"),
        message:
          err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        onBack={handleCancel}
        backLabel={t("common.back")}
        title={isEdit ? t("forms.editForm") : t("forms.newForm")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lastSavedTime && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-secondary/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Đã lưu nháp ({lastSavedTime})
              </span>
            )}

            <div className="inline-flex rounded-md border border-border bg-surface-secondary p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCanvasMode("design")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors",
                  canvasMode === "design"
                    ? "bg-surface text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid size={13} />
                {t("formBuilder.designTab")}
              </button>
              <button
                type="button"
                onClick={() => setCanvasMode("preview")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors",
                  canvasMode === "preview"
                    ? "bg-surface text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Eye size={13} />
                {t("formBuilder.previewTab")}
              </button>
            </div>

            <Button variant="outline" onClick={handleCancel}>
              <X size={15} />
              {t("common.cancel")}
            </Button>
            <Button variant="accent" loading={saving} onClick={save}>
              <Save size={15} />
              {t("common.save")}
            </Button>
          </div>
        }
      />

      {/* Banner thông báo khôi phục bản nháp tự động */}
      {draftRestored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-xs text-foreground shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary" />
            <span>
              <strong>Đã tự động khôi phục bản nháp biểu mẫu</strong> mà bạn đang nhập dở{" "}
              {lastSavedTime ? `(lưu lúc ${lastSavedTime})` : ""}.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDraftRestored(false)}
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Tiếp tục chỉnh sửa
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={clearDraft}
              className="text-muted-foreground hover:text-danger hover:underline cursor-pointer"
            >
              Xóa bản nháp làm lại từ đầu
            </button>
          </div>
        </div>
      )}

      {isEdit && (
        <div className="rounded-md border border-border-subtle bg-surface-secondary/50 px-3.5 py-2 text-xs text-muted-foreground">
          {t("formBuilder.versionForkNotice")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px] lg:items-start">
        <FieldTypePalette
          sections={sections}
          activeSectionId={activeSectionId}
          onAddField={addField}
          onAddBlock={addBlock}
          onAddSection={addSection}
          onSelectSection={(sectionId) =>
            setSelection({ kind: "section", sectionId })
          }
        />

        <div className="space-y-4">
          <Field label={t("forms.namePlaceholder")} htmlFor="form-name" required>
            <Input
              id="form-name"
              value={name}
              placeholder={t("forms.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <LayoutCanvas
            mode={canvasMode}
            formName={name}
            fields={fields}
            sections={sections}
            selection={selection}
            onSelect={setSelection}
            onMoveSection={moveSection}
            onDeleteSection={deleteSection}
            onAddRow={addRow}
            onMoveItem={moveItem}
            onSetItemColSpan={(sectionId, rowId, itemId, colSpan) =>
              updateItem(sectionId, rowId, itemId, { colSpan })
            }
            onDeleteItem={deleteItem}
          />
        </div>

        <Card>
          <CardBody>
            <LayoutInspectorPanel
              selection={selection}
              sections={sections}
              fields={fields}
              onUpdateSection={updateSection}
              onUpdateItem={updateItem}
              onUpdateField={updateField}
              onRenameFieldKey={renameFieldKey}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
