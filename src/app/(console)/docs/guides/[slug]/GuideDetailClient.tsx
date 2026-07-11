'use client'

import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'

export function GuideEyebrow({ label }: { label: string }) {
  const { t } = useTranslation()
  return (
    <div className={styles.eyebrow}>
      <FileText size={14} />
      {t('guides.eyebrowSuffix', { label })}
    </div>
  )
}

export function BackToAllGuides() {
  const { t } = useTranslation()
  return (
    <Link href="/docs/guides" className={styles.backLink}>
      <ArrowLeft size={16} />
      {t('guides.allGuides')}
    </Link>
  )
}

export function BackToAllGuidesFooter() {
  const { t } = useTranslation()
  return (
    <Link href="/docs/guides" className={styles.backLink}>
      <ArrowLeft size={16} />
      {t('guides.backToAllGuides')}
    </Link>
  )
}
