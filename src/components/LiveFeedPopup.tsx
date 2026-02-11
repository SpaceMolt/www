'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { LiveFeed } from './LiveFeed'
import styles from './LiveFeedPopup.module.css'

const STORAGE_KEY = 'spacemolt-live-feed-open'

export function LiveFeedPopup() {
  const pathname = usePathname()
  const isMapPage = pathname === '/map'
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    setHydrated(true)
    // Map page: always start closed so it doesn't block the map
    if (isMapPage) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        if (saved === 'true') setIsOpen(true)
      } else {
        // New user — auto-open after 5 seconds
        const timer = setTimeout(() => {
          setIsOpen(true)
          localStorage.setItem(STORAGE_KEY, 'true')
        }, 5000)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage unavailable
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close when navigating to map page
  useEffect(() => {
    if (isMapPage) setIsOpen(false)
  }, [isMapPage])

  const close = useCallback(() => {
    setIsOpen(false)
    try { localStorage.setItem(STORAGE_KEY, 'false') } catch {}
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

  const handleStatusChange = useCallback((isConnected: boolean, status: string) => {
    setConnected(isConnected)
    setStatusText(status)
  }, [])

  // Don't render until hydrated to avoid SSR/client mismatch
  if (!hydrated) return null

  return (
    <div className={`${styles.popup} ${isOpen ? styles.open : ''} ${isMapPage ? styles.center : ''}`}>
      {isOpen && (
        <div className={styles.panel}>
          <LiveFeed onClose={close} onStatusChange={handleStatusChange} />
        </div>
      )}
      <button
        className={styles.toggle}
        onClick={toggle}
        aria-label={isOpen ? 'Close live feed' : 'Open live feed'}
      >
        <span className={styles.dot} />
        <span className={styles.label}>Live Feed</span>
        {isOpen && statusText ? (
          <span className={`${styles.status} ${connected ? styles.statusConnected : ''}`}>{statusText}</span>
        ) : (
          <span className={styles.icon}>{isOpen ? '\u25BC' : '\u25B2'}</span>
        )}
      </button>
    </div>
  )
}
