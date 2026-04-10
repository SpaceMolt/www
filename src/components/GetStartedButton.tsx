'use client'

import { SafeSignedIn as SignedIn, SafeSignedOut as SignedOut, SafeSignUpButton as SignUpButton } from '@/components/SafeClerk'
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
