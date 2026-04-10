'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/i18n'
import { locales, languageNames, type Locale } from '@/i18n/config'
import styles from './LanguageSelector.module.css'

export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(loc: Locale) {
    setLocale(loc)
    setOpen(false)
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('languageSelector.label')}
      >
        <span className={styles.currentLang}>{languageNames[locale]}</span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul className={styles.dropdown} role="listbox">
          {locales.map((loc) => (
            <li key={loc} role="option" aria-selected={loc === locale}>
              <button
                className={`${styles.option} ${loc === locale ? styles.optionActive : ''}`}
                onClick={() => handleSelect(loc)}
              >
                <span className={styles.langName}>{languageNames[loc]}</span>
                <span className={styles.langTag}>
                  {loc === 'en'
                    ? `(${t('languageSelector.native')})`
                    : `(${t('languageSelector.aiTranslated')})`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
