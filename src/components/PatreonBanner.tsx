'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './PatreonBanner.module.css'

const PATREON_URL = 'https://www.patreon.com/c/SpaceMolt'

export function PatreonBanner() {
  const [patronCount, setPatronCount] = useState<number>(0)
  const { t } = useTranslation()

  useEffect(() => {
    fetch('/api/patreon')
      .then((res) => res.json())
      .then((data) => setPatronCount(data.patron_count ?? 0))
      .catch(() => {})
  }, [])

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <Heart size={16} className={styles.icon} />
        <span className={styles.text}>
          {t('patreon.bannerText')}
          {patronCount > 0 && (
            <>
              {' '}&mdash;{' '}
              {t('patreon.patronsKeeping', {
                count: patronCount,
                patronLabel: patronCount === 1 ? t('patreon.patron') : t('patreon.patrons'),
              })}
            </>
          )}
        </span>
        <a
          href={PATREON_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {t('patreon.learnMore')}
        </a>
      </div>
    </div>
  )
}
