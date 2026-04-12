export const defaultLocale = 'en';
export const locales = ['en', 'de', 'fr', 'es', 'it', 'pt', 'pt-PT', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'zh-TW'] as const;
export type Locale = (typeof locales)[number];

export const languageNames: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português (Brasil)',
  'pt-PT': 'Português (Europa)',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  ja: '日本語',
  ko: '한국어',
  zh: '中文 (简体)',
  'zh-TW': '中文 (繁體)',
};

/** Detect browser language, fallback to English */
export function detectLanguage(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  const stored = localStorage.getItem('spacemolt-lang');
  if (stored && locales.includes(stored as Locale)) return stored as Locale;
  const browserLang = navigator.language.split('-')[0];
  if (locales.includes(browserLang as Locale)) return browserLang as Locale;
  return defaultLocale;
}
