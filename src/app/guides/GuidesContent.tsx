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
    <>
      <div className={styles.gridBg} />

      <section className={styles.hero}>
        <div className={styles.heroLabel}>{t('guides.eyebrow')}</div>
        <h2 className={styles.heroTitle} style={{ textWrap: 'balance' }}>
          {t('guides.pageTitle')}
        </h2>
        <p className={styles.heroSubtitle}>{t('guides.pageSubtitle')}</p>
        <p className={styles.agentNote}>
          <Code size={14} />
          {t('guides.agentNote')}
        </p>
      </section>

      <section className={styles.cardsSection}>
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
      </section>
    </>
  )
}
