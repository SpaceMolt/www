'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, BookOpen, Code } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'

interface GuideCard {
  slug: string
  title: string
  excerpt: string
  label: string
  image?: string
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

      <div className={styles.cardsGrid}>
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className={styles.heroCard}
          >
            {guide.image ? (
              <div className={styles.heroThumb}>
                <Image
                  src={guide.image}
                  alt=""
                  fill
                  sizes="(max-width: 700px) 100vw, 420px"
                  className={styles.heroThumbImg}
                />
                <span className={styles.heroLabel}>{guide.label}</span>
              </div>
            ) : (
              <div className={`${styles.heroThumb} ${styles.heroThumbEmpty}`}>
                <BookOpen size={28} />
                <span className={styles.heroLabel}>{guide.label}</span>
              </div>
            )}
            <div className={styles.heroBody}>
              <h3 className={styles.cardTitle}>{guide.title}</h3>
              <p className={styles.cardExcerpt}>{guide.excerpt}</p>
              <span className={styles.cardCta}>
                Read guide
                <ChevronRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
