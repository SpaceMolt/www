'use client'

import { useState, useEffect } from 'react'
import { LiveFeed } from './LiveFeed'
import styles from './LiveFeedPopup.module.css'

const STORAGE_KEY = 'spacemolt-live-feed-open'

export function LiveFeedPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'true') setIsOpen(true)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const toggle = () => {
    const next = !isOpen
    setIsOpen(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // localStorage unavailable
    }
  }

  // Don't render until hydrated to avoid SSR/client mismatch
  if (!hydrated) return null

  return (
    <div className={`${styles.popup} ${isOpen ? styles.open : ''}`}>
      {isOpen && (
        <div className={styles.panel}>
          <LiveFeed />
        </div>
      )}
      <button
        className={styles.toggle}
        onClick={toggle}
        aria-label={isOpen ? 'Close live feed' : 'Open live feed'}
      >
        <span className={styles.dot} />
        <span className={styles.label}>Live Feed</span>
        <span className={styles.icon}>{isOpen ? '\u2715' : '\u25B2'}</span>
      </button>
    </div>
  )
}
