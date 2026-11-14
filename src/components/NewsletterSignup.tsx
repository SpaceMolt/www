'use client'

import { useState, type FormEvent } from 'react'
import { Mail, Loader2, Check } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './NewsletterSignup.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

type Variant = 'compact' | 'section'

/** POSTs JSON to /api/newsletter/{path} on the gameserver. Returns the HTTP status, or 0 on a network error. */
export async function postNewsletter(path: 'signup' | 'confirm', body: object): Promise<number> {
  try {
    const res = await fetch(`${GAME_SERVER}/api/newsletter/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.status
  } catch {
    return 0
  }
}

/** Translation key for a status that both newsletter endpoints share. */
export function newsletterErrorKey(status: number): string {
  if (status === 403) return 'newsletter.errorOrigin'
  if (status === 429) return 'newsletter.errorRateLimit'
  if (status === 503) return 'newsletter.errorUnavailable'
  return 'newsletter.errorGeneric'
}

/**
 * Public, anonymous newsletter signup. The gameserver mails a confirm link to
 * /newsletter/confirm; it gives the same answer for known and unknown addresses.
 * `website` is a honeypot: people never see it, so they leave it empty.
 */
export function NewsletterSignup({ variant = 'section' }: { variant?: Variant }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    const status = await postNewsletter('signup', {
      email: String(data.get('email') ?? '').trim(),
      website: String(data.get('nl_hp') ?? ''),
    })
    setBusy(false)
    if (status === 200) setSent(true)
    else setError(t(status === 400 ? 'newsletter.errorEmail' : newsletterErrorKey(status)))
  }

  const form = sent ? (
    <p className={styles.sent} role="status">
      <Check size={14} />
      {t('newsletter.checkInbox')}
    </p>
  ) : (
    <form className={styles.form} onSubmit={submit}>
      <input
        className={styles.input}
        type="email"
        name="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder={t('newsletter.placeholder')}
        aria-label={t('newsletter.placeholder')}
      />
      <input className={styles.honeypot} type="text" name="nl_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className={styles.button} type="submit" disabled={busy}>
        {busy ? <Loader2 size={14} className={styles.spin} /> : <Mail size={14} />}
        {t('newsletter.subscribe')}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )

  if (variant === 'compact') {
    return (
      <div className={styles.compact}>
        <span className={styles.compactLabel}>
          <Mail size={14} />
          {t('newsletter.footerLabel')}
        </span>
        {form}
      </div>
    )
  }

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionInner}>
          <h2 className={styles.title}>{t('newsletter.title')}</h2>
          <p className={styles.subtitle}>{t('newsletter.subtitle')}</p>
          {form}
        </div>
      </div>
    </section>
  )
}
