"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  dictionaries,
  translate,
  type Locale,
} from "@/lib/i18n";

type TFunction = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * App-wide language provider. Defaults to Vietnamese; the choice is persisted
 * to localStorage and restored on mount. Rendering starts with the default
 * locale so server and first client render agree (no hydration mismatch); the
 * stored preference is applied in an effect.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = window.localStorage.getItem(
      LOCALE_STORAGE_KEY,
    ) as Locale | null;
    if (stored && stored in dictionaries) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const t = useCallback<TFunction>(
    (key, vars) => translate(dictionaries[locale], key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an <I18nProvider>");
  return ctx;
}

/** Returns the `t(key, vars?)` translator bound to the current locale. */
export function useT(): TFunction {
  return useI18n().t;
}

/** Returns `[locale, setLocale]` for reading/switching the active language. */
export function useLocale(): [Locale, (locale: Locale) => void] {
  const { locale, setLocale } = useI18n();
  return [locale, setLocale];
}
