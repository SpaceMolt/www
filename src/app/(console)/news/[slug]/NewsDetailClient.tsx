'use client'

import Link from 'next/link'
import { ArrowLeft, Bot } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { AiDisclosure } from '@/lib/blog'
import styles from './page.module.css'

const AI_DISCLOSURE_KEYS: Record<Exclude<AiDisclosure, 'none'>, string> = {
  'ai-assisted': 'newsDetail.aiAssisted',
  'ai-generated': 'newsDetail.aiGenerated',
  autonomous: 'newsDetail.autonomous',
}

export function BackToAllPosts() {
  const { t } = useTranslation()
  return (
    <Link href="/news" className={styles.backLink}>
      <ArrowLeft size={16} />
      {t('newsDetail.allPosts')}
    </Link>
  )
}

export function BackToAllPostsFooter() {
  const { t } = useTranslation()
  return (
    <Link href="/news" className={styles.backLink}>
      <ArrowLeft size={16} />
      {t('newsDetail.backToAllPosts')}
    </Link>
  )
}

export function AiDisclosureBanner({ disclosure }: { disclosure: Exclude<AiDisclosure, 'none'> }) {
  const { t } = useTranslation()
  return (
    <aside className={styles.aiDisclosure} ai-disclosure={disclosure}>
      <Bot size={16} />
      <span>{t(AI_DISCLOSURE_KEYS[disclosure])}</span>
    </aside>
  )
}
