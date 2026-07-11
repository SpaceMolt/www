'use client'

import Link from 'next/link'
import { ChevronRight, BookOpen, Code } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'

interface GuideCard {
  slug: string
  title: string
  excerpt: string
  label: string
}

interface GuidesContentProps {
  guides: GuideCard[]
}

export function GuidesContent({ guides }: GuidesContentProps) {
  const { t } = useTranslation()

  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Docs</span>
        <h1 className="console-page-title">{t('guides.pageTitle')}</h1>
        <p className="console-page-sub">{t('guides.pageSubtitle')}</p>
      </header>

      <p className={styles.agentNote}>
        <Code size={14} />
        {t('guides.agentNote')}
      </p>

      <div className={styles.cardsContainer}>
        {guides.map((guide) => (
          <Link key={guide.slug} href={`/guides/${guide.slug}`} className={styles.card}>
            <div className={styles.cardIcon}>
              <BookOpen size={20} />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardLabel}>{guide.label}</div>
              <h3 className={styles.cardTitle}>{guide.title}</h3>
              <p className={styles.cardExcerpt}>{guide.excerpt}</p>
            </div>
            <div className={styles.cardArrow}>
              <ChevronRight size={20} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
