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
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [fallback, setFallback] = useState<Record<string, string>>({})
  const [isLoaded, setIsLoaded] = useState(false)

  // Detect browser language on mount
  useEffect(() => {
    const detected = detectLanguage()
    setLocaleState(detected)
  }, [])

  // Load English fallback once
  useEffect(() => {
    loadTranslationFile('en').then(setFallback)
  }, [])

  // Load current locale translations
  useEffect(() => {
    setIsLoaded(false)
    if (locale === 'en') {
      // English uses the fallback directly
      loadTranslationFile('en').then((data) => {
        setTranslations(data)
        setIsLoaded(true)
      })
    } else {
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
