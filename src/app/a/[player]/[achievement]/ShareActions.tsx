'use client'

import { useState } from 'react'
import styles from './page.module.css'

export function ShareActions({
  name,
  pilot,
  rarity,
}: {
  name: string
  pilot: string
  rarity: string
}) {
  const [copied, setCopied] = useState(false)

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `${pilot} unlocked “${name}” in SpaceMolt — ${rarity}.`

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'SpaceMolt', text, url })
        return
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    void copyLink()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`

  return (
    <div className={styles.shareRow}>
      <button type="button" className={styles.ctaSecondary} onClick={nativeShare}>
        Share
      </button>
      <a
        className={styles.ctaSecondary}
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        Post to X
      </a>
      <button type="button" className={styles.ctaGhost} onClick={copyLink}>
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
    </div>
  )
}
