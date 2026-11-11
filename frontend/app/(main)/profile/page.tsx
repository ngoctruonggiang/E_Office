"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { getMe, updateMe } from "@/features/auth/api/auth";
import { formatBytes } from "@/lib/utils/format";

// Stored as a base64 data URL in the user row (TEXT, ~2M char cap on the DTO).
// base64 inflates ~1.33x, so cap the raw image well under that.
const MAX_IMAGE_BYTES = Math.floor(1.4 * 1024 * 1024);

// Approximate the raw byte size of a base64 data URL (used to show the size of
// an already-saved signature image, where we no longer hold the File object).
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

  // Hydrate from a fresh GET /users/me so we always edit the latest server state.
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
    e.target.value = ""; // allow re-selecting the same file
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
        signatureImage: signatureImage ?? "", // "" clears the field server-side
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
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("profile.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("profile.subtitle")}
        </p>
      </header>

      {!loaded ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
      ) : (
        <>
          {/* Personal information */}
          <section className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">
              {t("profile.personalInfo")}
            </h2>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                {t("profile.displayName")}
              </span>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("profile.displayNamePlaceholder")}
                maxLength={120}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                {t("profile.email")}
              </span>
              <Input value={email} disabled readOnly />
            </label>
          </section>

          {/* Signature */}
          <section className="space-y-5 rounded-xl border border-border bg-card p-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("profile.signatureTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("profile.signatureDesc")}
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                {t("profile.signatureName")}
              </span>
              <Input
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
            </label>

            <div>
              <span className="mb-1 block text-sm font-medium text-foreground">
                {t("profile.signatureImage")}
              </span>
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-48 items-center justify-center rounded-md border border-dashed border-border bg-muted/40">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    {t("profile.uploadImage")}
                  </Button>
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
                  {signatureImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSignatureImage(null);
                        setImageBytes(null);
                      }}
                      className="block text-xs text-destructive hover:underline"
                    >
                      {t("profile.removeImage")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-xs font-medium ${
                  complete ? "text-green-600" : "text-amber-600"
                }`}
              >
                {complete ? t("profile.ready") : t("profile.incomplete")}
              </span>
              <Button onClick={handleSave} loading={saving} disabled={saving}>
                {saving ? t("profile.saving") : t("profile.save")}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
