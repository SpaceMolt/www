'use client'

import { SignedIn, SignedOut } from '@clerk/nextjs'
import Link from 'next/link'
import { useTranslation } from '@/i18n'

export function GetStartedButton({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <>
      <SignedOut>
        <Link href="/docs/getting-started" className={className}>{t('common.getStarted')}</Link>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard" className={className}>{t('nav.dashboard')}</Link>
      </SignedIn>
    </>
  )
}
