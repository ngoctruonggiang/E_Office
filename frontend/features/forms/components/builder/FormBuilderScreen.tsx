"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { LoadingState } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/api/client";
import { createForm, getForm, updateForm } from "../../api/forms";
import {
  draftFromView,
  newField,
  toFieldInput,
  type FieldDraft,
} from "../../types/builder";
import type { FieldType } from "../../types/form";
import { FieldTypePalette } from "./FieldTypePalette";
import { FieldList } from "./FieldList";
import { FieldConfigPanel } from "./FieldConfigPanel";

export function FormBuilderScreen({ formId }: { formId?: string }) {
  const t = useT();
  const router = useRouter();
  const { notify } = useNotifications();
  const isEdit = Boolean(formId);

  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!formId) return;
    let active = true;
    getForm(formId)
      .then((form) => {
        if (!active) return;
        setName(form.name);
        const drafts = form.fields.map(draftFromView);
        setFields(drafts);
        setSelectedUid(drafts[0]?.uid ?? null);
      })
      .catch(() =>
        notify({ title: t("common.error"), kind: "error" }),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [formId, notify, t]);

  const genKey = () => {
    const existing = new Set(fields.map((f) => f.key));
    let n = fields.length + 1;
    let key = `field_${n}`;
    while (existing.has(key)) key = `field_${++n}`;
    return key;
  };

  const addField = (type: FieldType) => {
    const field = newField(type, genKey());
    setFields((fs) => [...fs, field]);
    setSelectedUid(field.uid);
  };

  const updateField = (uid: string, patch: Partial<FieldDraft>) =>
    setFields((fs) => fs.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));

  const deleteField = (uid: string) => {
    setFields((fs) => fs.filter((f) => f.uid !== uid));
    setSelectedUid((cur) => (cur === uid ? null : cur));
  };

  const reorder = (from: number, to: number) =>
    setFields((fs) => {
      const next = [...fs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const validate = (): string | null => {
    if (!name.trim()) return t("formBuilder.errors.nameRequired");
    if (fields.length === 0) return t("formBuilder.errors.fieldsRequired");
    const keys = new Set<string>();
    for (const f of fields) {
      if (!f.key.trim()) return t("formBuilder.errors.keyRequired");
      if (!f.label.trim()) return t("formBuilder.errors.labelRequired");
      if (keys.has(f.key)) return t("formBuilder.errors.duplicateKey");
      keys.add(f.key);
      if (
        f.type === "SELECT" &&
        f.options.filter((o) => o.value.trim()).length === 0
      ) {
        return t("formBuilder.errors.optionsRequired");
      }
    }
    return null;
  };

  const save = async () => {
    const error = validate();
    if (error) {
      notify({ title: error, kind: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), fields: fields.map(toFieldInput) };
      if (isEdit && formId) await updateForm(formId, payload);
      else await createForm(payload);
      notify({ title: t("forms.saved"), kind: "success" });
      router.push("/forms");
    } catch (err) {
      notify({
        title: t("forms.saveFailed"),
        message: err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const selected = fields.find((f) => f.uid === selectedUid) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          {isEdit ? t("forms.editForm") : t("forms.newForm")}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/forms")}>
            <X size={16} />
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={save}>
            <Save size={16} />
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[12rem_1fr_20rem]">
        {/* Left: palette */}
        <FieldTypePalette onAdd={addField} />

        {/* Middle: name + structure */}
        <div className="space-y-4">
          <Field label={t("forms.namePlaceholder")} htmlFor="form-name" required>
            <Input
              id="form-name"
              value={name}
              placeholder={t("forms.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("formBuilder.structure")}
            </p>
            <FieldList
              fields={fields}
              selectedUid={selectedUid}
              onSelect={setSelectedUid}
              onReorder={reorder}
              onDelete={deleteField}
            />
          </div>
        </div>

        {/* Right: field config */}
        <Card>
          <CardBody>
            <FieldConfigPanel field={selected} onChange={updateField} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
