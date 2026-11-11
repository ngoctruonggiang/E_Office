import { vi, type Dictionary } from "./locales/vi";
import { en } from "./locales/en";

export type Locale = "vi" | "en";

/** Default UI language for the whole app. */
export const DEFAULT_LOCALE: Locale = "vi";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export const dictionaries: Record<Locale, Dictionary> = { vi, en };

/** localStorage key persisting the user's language choice. */
export const LOCALE_STORAGE_KEY = "gafood.locale";

export type { Dictionary };

/**
 * Resolve a dot-path (`"requests.tabs.duty"`) against a dictionary. Returns the
 * key itself when missing so untranslated strings are visible but never crash.
 * Supports `{name}`-style interpolation via `vars`.
 */
export function translate(
  dict: Dictionary,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      dict,
    );

  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
