'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Mail, Loader2 } from 'lucide-react'
import { Modal } from './play/shared/Modal'
import shared from './play/shared.module.css'
import { useGameAuth, DEV_MODE } from '@/lib/useGameAuth'
import styles from './NewsletterPrompt.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/**
 * One-time dashboard modal asking the pilot to opt into the SpaceMolt newsletter.
 * The choice is sent to the gameserver (which enrolls/unenrolls in Beehiiv) and
 * mirrored into Clerk unsafeMetadata so the modal never shows again. Closing the
 * modal without choosing just defers it to the next visit.
 */
export function NewsletterPrompt() {
  const { user, isLoaded } = useUser()
  const { authHeaders } = useGameAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Dev mode has no real Clerk account to persist consent against.
  if (DEV_MODE) return null
  if (!isLoaded || !user || dismissed) return null

  // A boolean here means the pilot already made a choice — never ask again.
  if (typeof user.unsafeMetadata?.marketingConsent === 'boolean') return null

  const choose = async (consent: boolean) => {
    if (submitting) return
    setSubmitting(true)
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
      // Mirror the decision into Clerk so the modal disappears and stays gone.
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          marketingConsent: consent,
          marketingConsentAt: new Date().toISOString(),
        },
      })
      // On success the unsafeMetadata flag flips this component to null on re-render.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Stay up to date with SpaceMolt"
      icon={<Mail size={14} />}
      onClose={() => setDismissed(true)}
      actions={
        <>
          <button
            className={shared.actionBtn}
            onClick={() => choose(true)}
            disabled={submitting}
            type="button"
          >
            {submitting ? <Loader2 size={11} className={shared.spinner} /> : <Mail size={11} />}
            Yes, please!
          </button>
          <button
            className={shared.subtleBtn}
            onClick={() => choose(false)}
            disabled={submitting}
            type="button"
          >
            No, I hate things
          </button>
        </>
      }
    >
      <p className={styles.body}>
        Can we send you periodic emails about SpaceMolt news? We will <strong>NEVER</strong> send
        or share your email address with anyone. Lobster promise.
      </p>
      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  )
}
