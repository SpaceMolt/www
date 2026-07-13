'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Activity, MessageCircle, Heart, Rocket, Play } from 'lucide-react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { useTranslation } from '@/i18n'
import { LanguageSelector } from '@/components/LanguageSelector'
import { DISCORD_URL, PATREON_URL } from '@/lib/links'
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
    <header className={styles.topbar} data-pagefind-ignore>
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
        <span className={`${styles.readout} ${styles.readoutTick}`}>
          <span className={styles.readoutLabel}>{t('statsBar.tick')}</span>
          <span className={styles.readoutValue}>{stats ? stats.tick.toLocaleString() : '-'}</span>
        </span>
      </div>

      {/* Left→right: console utility, then community, then the primary CTA
          anchored at the right edge where the eye lands. */}
      <div className={styles.topbarActions}>
        {!hidePaneToggle && (
          <button
            className={styles.paneToggle}
            onClick={onTogglePane}
            aria-expanded={paneOpen}
            aria-controls="console-live-pane"
            aria-label={paneOpen ? t('console.closeLive') : t('console.openLive')}
          >
            <Activity size={13} aria-hidden />
            <span className={styles.btnLabel}>{t('console.live')}</span>
          </button>
        )}
        <span className={styles.langDesktop}>
          <LanguageSelector />
        </span>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.socialBtn} ${styles.socialDiscord}`}
          aria-label={t('nav.discord')}
        >
          <MessageCircle size={13} aria-hidden />
          <span className={styles.btnLabel}>{t('nav.discord')}</span>
        </a>
        <a
          href={PATREON_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.socialBtn} ${styles.socialPatreon}`}
          aria-label={t('console.patreon')}
        >
          <Heart size={13} aria-hidden />
          <span className={styles.btnLabel}>{t('console.patreon')}</span>
        </a>
        {/* aria-label on the anchor: the label span is display:none below 400px,
            which takes it out of the accessibility tree with it. */}
        <SignedOut>
          <Link href="/docs/getting-started" className={styles.ctaBtn} aria-label={t('nav.getStarted')}>
            <Rocket size={14} aria-hidden />
            <span className={styles.ctaLabel}>{t('nav.getStarted')}</span>
          </Link>
        </SignedOut>
        <SignedIn>
          <Link href="/play" className={styles.ctaBtn} aria-label={t('console.play')}>
            <Play size={14} aria-hidden />
            <span className={styles.ctaLabel}>{t('console.play')}</span>
          </Link>
        </SignedIn>
      </div>
    </header>
  )
}
