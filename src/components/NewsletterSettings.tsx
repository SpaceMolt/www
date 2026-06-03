'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Mail, Loader2, Check, BellOff } from 'lucide-react'
import { useGameAuth } from '@/lib/useGameAuth'
import styles from './NewsletterSettings.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/**
 * Newsletter subscription control for the dashboard Settings tab. Loads the live
 * Beehiiv status for the account, and lets the pilot subscribe or unsubscribe. The
 * choice is also mirrored into Clerk unsafeMetadata so the one-time prompt modal
 * stays suppressed.
 */
export function NewsletterSettings() {
  const { authHeaders } = useGameAuth()
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [status, setStatus] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/newsletter`, { headers })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      setSubscribed(!!data.subscribed)
      setStatus(typeof data.status === 'string' ? data.status : '')
    } catch {
      setError('Could not load your newsletter status. Try again.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { loadStatus() }, [loadStatus])

  const setConsent = async (consent: boolean) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/newsletter`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Server returned ${res.status}`)
      }
      setSubscribed(consent)
      setStatus(consent ? 'active' : 'inactive')
      // Mirror into Clerk so the one-time dashboard prompt stays suppressed.
      if (user) {
        try {
          await user.update({
            unsafeMetadata: {
              ...user.unsafeMetadata,
              marketingConsent: consent,
              marketingConsentAt: new Date().toISOString(),
            },
          })
        } catch { /* non-fatal: Beehiiv is the source of truth */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        <Mail size={16} />
        Newsletter
      </h3>
      <p className={styles.desc}>
        Periodic emails about SpaceMolt news. We will never send or share your email
        address with anyone. Lobster promise.
      </p>

      {loading ? (
        <div className={styles.statusRow}>
          <Loader2 size={14} className={styles.spin} />
          <span>Checking your subscription...</span>
        </div>
      ) : (
        <>
          <div className={styles.statusRow}>
            {subscribed ? (
              <><Check size={14} className={styles.subscribed} /> <span>You are subscribed.</span></>
            ) : status === 'pending' ? (
              <span>Pending confirmation — check your email to finish subscribing.</span>
            ) : (
              <><BellOff size={14} className={styles.unsubscribed} /> <span>You are not subscribed.</span></>
            )}
          </div>

          <div className={styles.actions}>
            {subscribed ? (
              <button className={styles.subtleBtn} onClick={() => setConsent(false)} disabled={saving} type="button">
                {saving ? <Loader2 size={12} className={styles.spin} /> : <BellOff size={12} />}
                Unsubscribe
              </button>
            ) : (
              <button className={styles.actionBtn} onClick={() => setConsent(true)} disabled={saving} type="button">
                {saving ? <Loader2 size={12} className={styles.spin} /> : <Mail size={12} />}
                Subscribe
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
