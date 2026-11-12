"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { LoadingState } from "@/components/ui/Spinner";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { getMe, updateMe } from "@/features/auth/api/auth";
import { formatBytes } from "@/lib/utils/format";

const MAX_IMAGE_BYTES = Math.floor(1.4 * 1024 * 1024);

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export default function ProfilePage() {
  const t = useT();
  const { notify } = useNotifications();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [imageBytes, setImageBytes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getMe()
      .then((me) => {
        if (!active) return;
        setEmail(me.email);
        setDisplayName(me.displayName ?? "");
        setSignatureName(me.signatureName ?? "");
        setSignatureImage(me.signatureImage);
        setImageBytes(
          me.signatureImage ? dataUrlBytes(me.signatureImage) : null,
        );
      })
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(t("profile.errorImageType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("profile.errorImageSize", { max: formatBytes(MAX_IMAGE_BYTES) }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureImage(reader.result as string);
      setImageBytes(file.size);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMe({
        displayName: displayName.trim(),
        signatureName: signatureName.trim(),
        signatureImage: signatureImage ?? "",
      });
      notify({ title: t("profile.updated"), kind: "success" });
    } catch {
      notify({ title: t("profile.updateFailed"), kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  const complete = Boolean(signatureImage && signatureName.trim());

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title={t("profile.title")} description={t("profile.subtitle")} />

      {!loaded ? (
        <LoadingState />
      ) : (
        <div className="divide-y divide-border-subtle rounded-lg border border-border bg-surface">
          {/* Personal information */}
          <section className="space-y-4 p-5">
            <h2 className="text-sm font-semibold text-foreground">
              {t("profile.personalInfo")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("profile.displayName")} htmlFor="profile-name">
                <Input
                  id="profile-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("profile.displayNamePlaceholder")}
                  maxLength={120}
                />
              </Field>
              <Field label={t("profile.email")} htmlFor="profile-email">
                <Input id="profile-email" value={email} disabled readOnly />
              </Field>
            </div>
          </section>

          {/* Signature */}
          <section className="space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("profile.signatureTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("profile.signatureDesc")}
              </p>
            </div>

            <Field
              label={t("profile.signatureName")}
              htmlFor="profile-signature-name"
            >
              <Input
                id="profile-signature-name"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder={t("profile.signatureNamePlaceholder")}
                maxLength={80}
              />
              {signatureName.trim() && (
                <span
                  className="mt-2 block text-2xl text-foreground"
                  style={{ fontFamily: "cursive" }}
                >
                  {signatureName}
                </span>
              )}
            </Field>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-foreground">
                {t("profile.signatureImage")}
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-24 w-48 items-center justify-center rounded-md border border-dashed border-border bg-surface-secondary/70 p-2">
                  {signatureImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signatureImage}
                      alt={t("profile.signatureImage")}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("profile.noImage")}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImage}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      {t("profile.uploadImage")}
                    </Button>
                    {signatureImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSignatureImage(null);
                          setImageBytes(null);
                        }}
                        className="text-danger hover:bg-danger-subtle hover:text-danger"
                      >
                        {t("profile.removeImage")}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("profile.imageHint", {
                      max: formatBytes(MAX_IMAGE_BYTES),
                    })}
                  </p>
                  {signatureImage && imageBytes != null && (
                    <p className="text-xs font-medium text-foreground">
                      {t("profile.imageSelected", {
                        size: formatBytes(imageBytes),
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error && <InlineNotice kind="danger" title={error} />}

            <InlineNotice
              kind={complete ? "success" : "warning"}
              title={complete ? t("profile.ready") : t("profile.incomplete")}
            />

            <div className="flex justify-end pt-1">
              <Button
                variant="accent"
                onClick={handleSave}
                loading={saving}
                disabled={saving}
              >
                {saving ? t("profile.saving") : t("profile.save")}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
