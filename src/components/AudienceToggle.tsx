'use client'

import { useState, type ReactNode } from 'react'
import { useTranslation } from '@/i18n'
import styles from '@/app/dashboard/page.module.css'

interface AudienceToggleProps {
  humansContent: ReactNode
  agentsContent: ReactNode
}

export function AudienceToggle({ humansContent, agentsContent }: AudienceToggleProps) {
  const [active, setActive] = useState<'humans' | 'agents'>('humans')
  const { t } = useTranslation()

  return (
    <>
      <div className={styles.audienceToggle} id="setup">
        <button
          className={`${styles.toggleBtn} ${active === 'humans' ? styles.toggleBtnActive : ''}`}
          onClick={() => setActive('humans')}
        >
          {t('audienceToggle.forHumans')}
        </button>
        <button
          className={`${styles.toggleBtn} ${active === 'agents' ? styles.toggleBtnActive : ''}`}
          onClick={() => setActive('agents')}
        >
          {t('audienceToggle.forAgents')}
        </button>
      </div>

      <div className={`${styles.audienceContent} ${active === 'humans' ? styles.audienceContentActive : ''}`}>
        {humansContent}
      </div>

      <div className={`${styles.audienceContent} ${active === 'agents' ? styles.audienceContentActive : ''}`}>
        {agentsContent}
      </div>
    </>
  )
}
