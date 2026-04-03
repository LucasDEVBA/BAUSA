"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";

import { pt } from "./translations/pt";
import { en } from "./translations/en";
import { es } from "./translations/es";
import type { Translations } from "./translations/pt";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type Lang = "pt" | "en" | "es";

const translations: Record<Lang, Translations> = { pt, en, es };

// ─── Utilitário — resolve chave dot-notation na árvore de traduções ───────────
function resolve(dict: Translations, path: string): string {
  const keys = path.split(".");
  let current: unknown = dict;

  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : path;
}

// ─── Interface do contexto ────────────────────────────────────────────────────
interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  translateError: (ptMsg: string) => string;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useLocale() as Lang;
  const router = useRouter();
  const pathname = usePathname();

  const setLang = useCallback(
    (newLang: Lang) => {
      router.replace(pathname, { locale: newLang });
    },
    [router, pathname],
  );

  const t = useCallback(
    (key: string): string => {
      const result = resolve(translations[locale], key);
      if (result === key && locale !== "pt") {
        return resolve(translations.pt, key);
      }
      return result;
    },
    [locale],
  );

  const translateError = useCallback(
    (ptMsg: string): string => {
      if (locale === "pt") return ptMsg;
      const errorMap = translations[locale].form.errors as Record<string, string>;
      return errorMap[ptMsg] ?? ptMsg;
    },
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ lang: locale, setLang, t, translateError }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage deve ser usado dentro de <LanguageProvider>");
  }
  return ctx;
}
