'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/i18n'
import { ConsoleTopbar } from './ConsoleTopbar'
import { ConsoleSidebar } from './ConsoleSidebar'
import { LivePane, PANE_MIN_W, PANE_MAX_W, PANE_MIN_H, PANE_MAX_H } from './LivePane'
import { useServerStats } from './useServerStats'
import styles from './console.module.css'

const STORAGE_OPEN = 'sm-console-pane-open'
const STORAGE_W = 'sm-console-pane-width'
const STORAGE_H = 'sm-console-pane-height'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { stats, online } = useServerStats()

  const [navOpen, setNavOpen] = useState(false)
  const [paneOpen, setPaneOpen] = useState(true)
  const [paneW, setPaneW] = useState(340)
  const [paneH, setPaneH] = useState(320)

  // Restore persisted pane state. Default: open on desktop, closed on small
  // screens (the bottom sheet would cover too much of the viewport).
  useEffect(() => {
    try {
      const storedOpen = localStorage.getItem(STORAGE_OPEN)
      if (storedOpen !== null) {
        setPaneOpen(storedOpen === 'true')
      } else if (window.matchMedia('(max-width: 900px)').matches) {
        setPaneOpen(false)
      }
      const storedW = localStorage.getItem(STORAGE_W)
      if (storedW) setPaneW(clamp(parseInt(storedW, 10) || 340, PANE_MIN_W, PANE_MAX_W))
      const storedH = localStorage.getItem(STORAGE_H)
      if (storedH) setPaneH(clamp(parseInt(storedH, 10) || 320, PANE_MIN_H, PANE_MAX_H))
    } catch {
      // localStorage unavailable
    }
  }, [])

  // Close the mobile nav drawer on navigation.
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // Escape closes the nav drawer.
  useEffect(() => {
    if (!navOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  const togglePane = useCallback(() => {
    setPaneOpen((open) => {
      try { localStorage.setItem(STORAGE_OPEN, String(!open)) } catch {}
      return !open
    })
  }, [])

  const closePane = useCallback(() => {
    setPaneOpen(false)
    try { localStorage.setItem(STORAGE_OPEN, 'false') } catch {}
  }, [])

  const onWidthChange = useCallback((w: number) => {
    setPaneW(w)
    try { localStorage.setItem(STORAGE_W, String(w)) } catch {}
  }, [])

  const onHeightChange = useCallback((h: number) => {
    setPaneH(h)
    try { localStorage.setItem(STORAGE_H, String(h)) } catch {}
  }, [])

  return (
    <div className={styles.shell}>
      <a href="#console-main" className={styles.skipLink}>{t('console.skip')}</a>
      <ConsoleTopbar
        stats={stats}
        online={online}
        navOpen={navOpen}
        onToggleNav={() => setNavOpen((v) => !v)}
        paneOpen={paneOpen}
        onTogglePane={togglePane}
      />
      <div className={styles.body}>
        <ConsoleSidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <main id="console-main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        {/* The pane stays mounted while collapsed so the live feed keeps
            accumulating events; it is only hidden visually. */}
        <LivePane
          hidden={!paneOpen}
          width={paneW}
          height={paneH}
          onWidthChange={onWidthChange}
          onHeightChange={onHeightChange}
          onClose={closePane}
          stats={stats}
          online={online}
        />
      </div>
    </div>
  )
}
