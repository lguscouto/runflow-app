"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { getUserProfile, saveUserProfile } from "@/lib/profile";
import { createSerializedAsyncQueue } from "@/lib/serialized-async-queue";
import { isSupportedLanguage, type Language } from "./types";

export type { Language } from "./types";

type TranslationDictionary = Record<string, string>;
type TranslationCatalog = Record<Language, TranslationDictionary>;

const FALLBACK_TRANSLATIONS: TranslationDictionary = {
  "common.loading": "Carregando...",
  "theme.switch_to_light": "Ativar modo claro",
  "theme.switch_to_dark": "Ativar modo escuro",
};

const dictionaryCache = new Map<Language, TranslationDictionary>();
let catalogPromise: Promise<TranslationCatalog> | null = null;

function loadTranslationCatalog(): Promise<TranslationCatalog> {
  catalogPromise ??= import("./i18n-dictionaries").then(
    ({ translations }) => translations as TranslationCatalog,
  );
  return catalogPromise;
}

async function loadDictionary(language: Language): Promise<TranslationDictionary> {
  const cached = dictionaryCache.get(language);
  if (cached) return cached;

  const catalog = await loadTranslationCatalog();
  const dictionary = catalog[language] ?? catalog.pt;
  dictionaryCache.set(language, dictionary);
  return dictionary;
}

import { getNativeAppLocale, setNativeAppLocale } from "@/lib/app-locale";

interface I18nContextProps {
  language: Language;
  t: (key: string, variables?: Record<string, string | number>) => string;
  changeLanguage: (lang: Language) => Promise<void>;
  loading: boolean;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("pt");
  const [dictionary, setDictionary] = useState<TranslationDictionary>(FALLBACK_TRANSLATIONS);
  const [loading, setLoading] = useState(true);
  const languageIntentGenerationRef = useRef(0);
  const languagePersistenceQueueRef = useRef(
    createSerializedAsyncQueue(async (nextLang: Language) => {
      try {
        await setNativeAppLocale(nextLang === "en" ? "en" : "pt-BR");
        const current = await getUserProfile();
        if (current) {
          const { updatedAt, ...rest } = current;
          await saveUserProfile({
            ...rest,
            language: nextLang,
          });
        } else {
          await saveUserProfile({
            language: nextLang,
          });
        }
      } catch (err) {
        console.error("Failed to persist language preference:", err);
      }
    }),
  );

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "pt-BR";
  }, [language]);

  useEffect(() => {
    let active = true;
    const initialGeneration = languageIntentGenerationRef.current;
    const mayApplyInitialPreference = () =>
      active && languageIntentGenerationRef.current === initialGeneration;

    async function loadPreferredLanguage() {
      let preferredLanguage: Language = "pt";
      try {
        const nativeLocale = await getNativeAppLocale();
        if (nativeLocale) {
          const normalized = nativeLocale.toLowerCase().slice(0, 2);
          if (normalized === "en" || normalized === "pt") {
            preferredLanguage = normalized as Language;
          } else {
            const profile = await getUserProfile();
            if (isSupportedLanguage(profile?.language)) {
              preferredLanguage = profile.language;
            }
          }
        } else {
          const profile = await getUserProfile();
          if (isSupportedLanguage(profile?.language)) {
            preferredLanguage = profile.language;
          } else {
            // Detect system browser language, fallback to Portuguese
            const browserLang = navigator.language.slice(0, 2);
            if (browserLang === "en" || browserLang === "pt") {
              preferredLanguage = browserLang;
            }
          }
        }
      } catch (err) {
        console.error("Failed to load preferred language:", err);
      } finally {
        if (active) {
          try {
            const nextDictionary = await loadDictionary(preferredLanguage);
            if (mayApplyInitialPreference()) {
              setLanguage(preferredLanguage);
              setDictionary(nextDictionary);
            }
          } catch (err) {
            console.error("Failed to load translation catalog:", err);
          }
          setLoading(false);
        }
      }
    }
    loadPreferredLanguage();
    return () => {
      active = false;
    };
  }, []);

  const changeLanguage = async (nextLang: Language) => {
    if (!isSupportedLanguage(nextLang)) return;
    const generation = ++languageIntentGenerationRef.current;
    setLanguage(nextLang);
    setLoading(false);
    void loadDictionary(nextLang)
      .then((nextDictionary) => {
        if (languageIntentGenerationRef.current === generation) {
          setDictionary(nextDictionary);
        }
      })
      .catch((err) => {
        console.error("Failed to load translation catalog:", err);
      });
    await languagePersistenceQueueRef.current(nextLang);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    let text = dictionary[key] || FALLBACK_TRANSLATIONS[key] || key;

    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ language, t, changeLanguage, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
