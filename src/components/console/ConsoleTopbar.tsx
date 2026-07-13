'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Activity } from 'lucide-react'
import { SignedIn, SignedOut, SignUpButton } from '@clerk/nextjs'
import { useTranslation } from '@/i18n'
import { LanguageSelector } from '@/components/LanguageSelector'
import type { ServerStats } from './useServerStats'
import styles from './console.module.css'

interface ConsoleTopbarProps {
  stats: ServerStats | null
  online: boolean
  navOpen: boolean
  onToggleNav: () => void
  paneOpen: boolean
  onTogglePane: () => void
  /** Pages that have no use for the galaxy feed (the intel map) hide it entirely. */
  hidePaneToggle?: boolean
}

export function ConsoleTopbar({ stats, online, navOpen, onToggleNav, paneOpen, onTogglePane, hidePaneToggle = false }: ConsoleTopbarProps) {
  const { t } = useTranslation()

  return (
    <header className={styles.topbar}>
      <button
        className={styles.iconBtn}
        onClick={onToggleNav}
        aria-label={t('console.menu')}
        aria-expanded={navOpen}
        aria-controls="console-sidebar"
      >
        {navOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <Link href="/" className={styles.brand}>
        <Image src="/images/logo-claw.png" alt="SpaceMolt" width={28} height={28} priority />
        <span className={styles.brandName}>SPACEMOLT</span>
      </Link>

      <div className={styles.telemetry} aria-live="off">
        <span className={styles.readout}>
          <span className={`${styles.statusLed} ${online ? styles.ledOnline : ''}`} aria-hidden />
          <span className={styles.readoutLabel}>
            {online ? t('statsBar.online') : t('statsBar.connecting')}
          </span>
        </span>
        <span className={`${styles.readout} ${styles.readoutHideMobile}`}>
          <span className={styles.readoutLabel}>{t('statsBar.version')}</span>
          <span className={styles.readoutValue}>{stats?.version && stats.version !== '0.0.0' ? stats.version : '-'}</span>
        </span>
        <span className={`${styles.readout} ${styles.readoutHideMobile}`}>
          <span className={styles.readoutLabel}>{t('statsBar.onlineCount')}</span>
          <span className={`${styles.readoutValue} ${styles.readoutOnline}`}>
            {stats ? stats.online_players.toLocaleString() : '-'}
          </span>
        </span>
        <span className={styles.readout}>
          <span className={styles.readoutLabel}>{t('statsBar.tick')}</span>
          <span className={styles.readoutValue}>{stats ? stats.tick.toLocaleString() : '-'}</span>
        </span>
      </div>

      <div className={styles.topbarActions}>
        <span className={styles.langDesktop}>
          <LanguageSelector />
        </span>
        <SignedOut>
          <SignUpButton mode="modal">
            <button className={styles.paneToggle}>{t('nav.getStarted')}</button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <Link href="/play" className={styles.playBtn}>{t('console.play')}</Link>
        </SignedIn>
        {!hidePaneToggle && (
          <button
            className={styles.paneToggle}
            onClick={onTogglePane}
            aria-expanded={paneOpen}
            aria-controls="console-live-pane"
            aria-label={paneOpen ? t('console.closeLive') : t('console.openLive')}
          >
            <Activity size={13} aria-hidden />
            <span className={styles.paneToggleLabel}>{t('console.live')}</span>
          </button>
        )}
      </div>
    </header>
  )
}
