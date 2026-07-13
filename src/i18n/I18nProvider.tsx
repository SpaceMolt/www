'use client'

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { defaultLocale, detectLanguage, type Locale } from './config'
import enTranslations from './translations/en.json'

type Translations = Record<string, string | Record<string, unknown>>

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  isLoaded: boolean
}

export const I18nContext = createContext<I18nContextValue | null>(null)

/** Flatten nested JSON into dot-separated keys */
function flattenTranslations(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      result[fullKey] = value
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(
        result,
        flattenTranslations(value as Record<string, unknown>, fullKey),
      )
    }
  }
  return result
}

/**
 * English is imported statically, not fetched in an effect, so it is already in
 * place on the very first render. Loading it asynchronously meant the server
 * rendered raw keys ("market.pageTitle") into the HTML and the client swapped in
 * real text on mount — which crawlers, and the Pagefind search index built from
 * that HTML, saw as the page's actual heading.
 */
const EN = flattenTranslations(enTranslations as Record<string, unknown>)

/** Dynamically import a translation JSON file */
async function loadTranslationFile(locale: string): Promise<Record<string, string>> {
  try {
    const mod = await import(`./translations/${locale}.json`)
    return flattenTranslations(mod.default || mod)
  } catch {
    return {}
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] = useState<Record<string, string>>(EN)
  const fallback = EN
  const [isLoaded, setIsLoaded] = useState(true)

  // Detect browser language on mount
  useEffect(() => {
    const detected = detectLanguage()
    setLocaleState(detected)
  }, [])

  // Load current locale translations. English is already seeded, so only a
  // non-English locale has anything to fetch.
  useEffect(() => {
    if (locale === 'en') {
      setTranslations(EN)
      setIsLoaded(true)
    } else {
      setIsLoaded(false)
      loadTranslationFile(locale).then((data) => {
        setTranslations(data)
        setIsLoaded(true)
      })
    }
  }, [locale])

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem('spacemolt-lang', newLocale)
    setLocaleState(newLocale)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = translations[key] || fallback[key] || key
      if (params) {
        for (const [param, replacement] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${param}\\}`, 'g'), String(replacement))
        }
      }
      return value
    },
    [translations, fallback],
  )

  const contextValue = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, isLoaded }),
    [locale, setLocale, t, isLoaded],
  )

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  )
}
