'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, Mail } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { postNewsletter, newsletterErrorKey } from '@/components/NewsletterSignup'
import styles from '@/components/NewsletterSignup.module.css'

/**
 * The confirm email links to /newsletter/confirm#t=<token>. The fragment never
 * reaches a server; the token goes to the gameserver only when the reader
 * clicks Confirm, so link scanners that fetch the page subscribe no one.
 */
export function ConfirmContent() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<number | null>(null)

  const confirm = async () => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t') ?? ''
    setBusy(true)
    setStatus(token ? await postNewsletter('confirm', { token }) : 400)
    setBusy(false)
  }

  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">{t('newsletter.footerLabel')}</span>
        <h1 className="console-page-title">{t('newsletter.confirmTitle')}</h1>
      </header>
      <div className="console-panel">
        <div className="console-panel-body">
          {status === 200 ? (
            <p className={styles.sent} role="status">
              <Check size={14} />
              {t('newsletter.confirmed')}
            </p>
          ) : (
            <>
              <p>{t('newsletter.confirmPrompt')}</p>
              <button className={styles.button} type="button" onClick={confirm} disabled={busy}>
                {busy ? <Loader2 size={14} className={styles.spin} /> : <Mail size={14} />}
                {t('newsletter.confirmButton')}
              </button>
              {status === 400 && (
                <p className={styles.error} role="alert">
                  {t('newsletter.errorLink')} <Link href="/newsletter">{t('newsletter.signUpAgain')}</Link>
                </p>
              )}
              {status !== null && status !== 400 && (
                <p className={styles.error} role="alert">{t(newsletterErrorKey(status))}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
