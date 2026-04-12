'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n'
import styles from './GrammarBanner.module.css'

const STORAGE_KEY = 'spacemolt-grammar-banner-dismissed'

export function GrammarBanner() {
  const { locale, t } = useTranslation()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    // Only show for non-English locales
    if (locale === 'en') {
      setDismissed(true)
      return
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    setDismissed(stored === 'true')
  }, [locale])

  if (dismissed || locale === 'en') {
    return null
  }

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.message}>
          {t('grammarBanner.message')}{' '}
          <a
            href="https://discord.gg/Jm4UdQPuNB"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            {t('grammarBanner.reportLink')}
          </a>
        </span>
        <button
          className={styles.dismiss}
          onClick={handleDismiss}
          aria-label={t('grammarBanner.dismiss')}
        >
          &times;
        </button>
      </div>
    </div>
  )
}
