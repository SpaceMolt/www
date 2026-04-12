'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n'
import Link from 'next/link'
import styles from './CookieBanner.module.css'

const STORAGE_KEY = 'spacemolt-cookie-consent'

export function CookieBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY)
    if (!accepted) {
      setVisible(true)
    }
  }, [])

  if (!visible) {
    return null
  }

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.message}>
          {t('cookieBanner.message')}
        </span>
        <div className={styles.actions}>
          <Link href="/cookies" className={styles.link}>
            {t('cookieBanner.learnMore')}
          </Link>
          <button className={styles.accept} onClick={handleAccept}>
            {t('cookieBanner.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
