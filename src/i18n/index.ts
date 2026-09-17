import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import id from "./locales/id.json";

export const LANGUAGE_STORAGE_KEY = "kemi.language";
export const SUPPORTED_LANGUAGES = ["id", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      id: { translation: id },
      en: { translation: en },
    },
    lng: "id",
    fallbackLng: "id",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
