'use client'

import { useContext } from 'react'
import { I18nContext, type I18nContextValue } from './I18nProvider'

/**
 * Hook to access translation functions and locale state.
 *
 * - `t(key, params?)` — look up a translation key, with optional {placeholder} interpolation
 * - `locale` — current locale code (e.g. 'en', 'de')
 * - `setLocale(locale)` — switch language and persist to localStorage
 * - `isLoaded` — whether translations have finished loading
 */
export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}
