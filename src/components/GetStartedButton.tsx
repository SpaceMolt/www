'use client'

import { SignedIn, SignedOut, SignUpButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useTranslation } from '@/i18n'

export function GetStartedButton({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <>
      <SignedOut>
        <SignUpButton mode="modal">
          <button className={className}>{t('common.getStarted')}</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard" className={className}>{t('nav.dashboard')}</Link>
      </SignedIn>
    </>
  )
}
