'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Check, Film, Maximize, Minimize, Pause, Play, RotateCcw, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { CinemaFilm } from '@/lib/cinema/types'
import type { ShipAppearanceMap } from '@/lib/cinema/appearance'
import type { mountCinema } from '@/lib/cinema/scene'
import { cinemaShortcut } from './playbackControls'
import styles from './Cinema.module.css'

type Quality = 'auto' | 'high' | 'medium' | 'low'
type Player = ReturnType<typeof mountCinema>
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export default function CinemaPlayer({ film, appearances }: { film: CinemaFilm; appearances: ShipAppearanceMap }) {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const player = useRef<Player | null>(null)
  const mountQuality = useRef<Quality>('auto')
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(0.65)
  const [time, setTime] = useState(0)
  const [quality, setQuality] = useState<Quality>('auto')
  const [settings, setSettings] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [active, setActive] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(media.matches)
    const change = () => { setReducedMotion(media.matches); player.current?.setReducedMotion(media.matches) }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    let disposed = false
    setReady(false)
    setFailed(false)
    setStarted(false)
    setPlaying(false)
    setEnded(false)
    setTime(0)
    setMuted(true)
    setVolume(0.65)
    setQuality(mountQuality.current)
    setSettings(false)
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    // The Three.js chunk is requested only after the completed record has been
    // reconciled and compiled. Prewarm a still frame so Play retains its user
    // gesture for unlocking audio, with no async imports between click/resume.
    import('@/lib/cinema/scene').then(({ mountCinema }) => {
      if (disposed || !canvas.current) return
      player.current = mountCinema(canvas.current, film, appearances, {
        quality: mountQuality.current, muted: true, volume: 0.65,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onTime: value => { if (!disposed) setTime(value) },
        onEnd: () => { if (!disposed) { setPlaying(false); setEnded(true) } },
        onError: () => { if (!disposed) { setFailed(true); setPlaying(false); setReady(false) } },
      })
      if (!disposed) setReady(true)
    }).catch(() => { if (!disposed) { setFailed(true); setReady(false) } })
    return () => { disposed = true; player.current?.dispose(); player.current = null }
  }, [film, appearances, reload])

  const showControls = useCallback(() => {
    setActive(true)
    if (activityTimer.current) clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(() => setActive(false), 3000)
  }, [])

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) { player.current?.setPlaying(false); setPlaying(false) }
    }
    const changed = () => setFullscreen(document.fullscreenElement === root.current)
    document.addEventListener('visibilitychange', hidden)
    document.addEventListener('fullscreenchange', changed)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      document.removeEventListener('fullscreenchange', changed)
      if (activityTimer.current) clearTimeout(activityTimer.current)
    }
  }, [])

  const play = (sound?: boolean) => {
    if (!ready || failed || !player.current) return
    if (sound !== undefined) { player.current.setMuted(!sound); setMuted(!sound) }
    if (ended) { player.current.seek(0); setTime(0); setEnded(false) }
    player.current.setPlaying(true)
    setStarted(true)
    setPlaying(true)
    root.current?.focus({ preventScroll: true })
    showControls()
  }
  const togglePlay = () => {
    if (playing) { player.current?.setPlaying(false); setPlaying(false) }
    else play()
  }
  const seek = (value: number) => {
    const clamped = Math.max(0, Math.min(film.duration, value))
    player.current?.seek(clamped)
    setTime(clamped)
    setEnded(clamped >= film.duration)
    if (clamped >= film.duration) { player.current?.setPlaying(false); setPlaying(false) }
    showControls()
  }
  const toggleMuted = () => { player.current?.setMuted(!muted); setMuted(!muted) }
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await root.current?.requestFullscreen()
      setFullscreenError(false)
    } catch { setFullscreenError(true) }
  }
  const visible = active || !playing || settings
  const record = `/battles/${encodeURIComponent(film.battleId)}`

  return (
    <main ref={root} className={`${styles.shell} ${!visible ? styles.inactive : ''}`} tabIndex={0} aria-label={t('cinema.player')}
      onPointerMove={showControls} onPointerDown={showControls} onFocusCapture={showControls}
      onKeyDown={event => {
        const shortcut = cinemaShortcut(event, !!(event.target as HTMLElement).closest('button, a, input, select, textarea, [contenteditable="true"], [role="slider"]'))
        if (!shortcut) return
        if (shortcut === 'play') { event.preventDefault(); togglePlay() }
        if (shortcut === 'back') { event.preventDefault(); seek(time - 5) }
        if (shortcut === 'forward') { event.preventDefault(); seek(time + 5) }
        if (shortcut === 'mute') toggleMuted()
        if (shortcut === 'fullscreen') void toggleFullscreen()
        if (shortcut === 'close-settings') setSettings(false)
        showControls()
      }}>
      <div className={styles.viewport}>
        <canvas key={reload} ref={canvas} className={styles.canvas} aria-label={t('cinema.scene', { system: film.systemName })} />
        <div className={styles.vignette} aria-hidden="true" />
      </div>
      <div className={`${styles.chrome} ${visible ? styles.chromeVisible : ''}`}>
        <header className={styles.header}>
          <Link href={record} className={styles.back}><ArrowLeft size={16} aria-hidden />{t('cinema.record')}</Link>
          <span className={styles.wordmark}>SpaceMolt <span>/</span> {t('cinema.cinema')}</span>
        </header>
      </div>

      {(!started || failed) && <section className={styles.titleScreen} aria-live="polite">
        <div className={styles.titleRule} aria-hidden="true" />
        <p className={styles.eyebrow}>{t(film.arena ? 'cinema.arenaSeries' : 'cinema.series')}</p>
        <h1>{film.systemName}</h1>
        <p className={styles.subtitle}>{t('cinema.title')}</p>
        <p className={styles.description}>{t(failed ? 'cinema.graphicsError' : 'cinema.inspired')}</p>
        <div className={styles.startActions}>
          {failed ? <button className={styles.primary} onClick={() => { mountQuality.current = 'low'; setReload(value => value + 1) }}><RotateCcw size={18} aria-hidden />{t('cinema.retryLow')}</button> : <>
            <button type="button" className={styles.primary} onClick={() => play(true)} disabled={!ready}><Play size={18} fill="currentColor" aria-hidden />{t(ready ? 'cinema.playSound' : 'cinema.preparing')}</button>
            <button type="button" className={styles.secondary} onClick={() => play(false)} disabled={!ready}><VolumeX size={16} aria-hidden />{t('cinema.playMuted')}</button>
          </>}
        </div>
        <p className={styles.screeningNote}>{clock(film.duration)} <span>/</span> {t('cinema.shortFilm')}</p>
      </section>}

      {ended && !failed && <section className={styles.endScreen} aria-live="polite">
        <p className={styles.eyebrow}>{t(film.arena ? 'cinema.exhibitionOver' : 'cinema.transmissionEnds')}</p>
        <h2>{t('cinema.aftermath')}</h2>
        <p className={styles.description}>{t('cinema.endDetail')}</p>
        <div className={styles.startActions}>
          <button className={styles.primary} type="button" onClick={() => play()}><RotateCcw size={17} aria-hidden />{t('cinema.replay')}</button>
          <Link className={styles.secondary} href={record}>{t('cinema.record')}<ArrowUpRight size={16} aria-hidden /></Link>
        </div>
      </section>}

      {started && !failed && <div className={`${styles.controls} ${visible ? styles.controlsVisible : ''}`}>
        {settings && <section className={styles.settings} aria-label={t('cinema.settings')}>
          <div className={styles.settingsHeading}><span>{t('cinema.settings')}</span><button aria-label={t('cinema.close')} onClick={() => setSettings(false)}><X size={16} aria-hidden /></button></div>
          <label className={styles.settingRow}>{t('cinema.quality')}<select value={quality} onChange={event => { const value = event.target.value as Quality; setQuality(value); player.current?.setQuality(value) }}>{(['auto', 'high', 'medium', 'low'] as const).map(value => <option key={value} value={value}>{t(`cinema.${value}`)}</option>)}</select></label>
          <button className={styles.settingRow} aria-pressed={reducedMotion} onClick={() => { setReducedMotion(!reducedMotion); player.current?.setReducedMotion(!reducedMotion) }}>{t('cinema.reducedMotion')}<span className={`${styles.checkbox} ${reducedMotion ? styles.checked : ''}`}>{reducedMotion && <Check size={13} aria-hidden />}</span></button>
          <p className={styles.settingsHint}>{t('cinema.shortcuts')}</p>
        </section>}
        <label className={styles.seekLabel}><span className={styles.srOnly}>{t('cinema.seek')}</span><input className={styles.seek} type="range" min={0} max={film.duration} step={0.1} value={time} aria-valuetext={`${clock(time)} / ${clock(film.duration)}`} onChange={event => seek(Number(event.target.value))} /></label>
        <div className={styles.controlRow}>
          <button type="button" onClick={togglePlay} aria-label={t(playing ? 'cinema.pause' : 'cinema.play')}>{playing ? <Pause size={19} fill="currentColor" aria-hidden /> : <Play size={19} fill="currentColor" aria-hidden />}</button>
          <button type="button" onClick={toggleMuted} aria-label={t(muted ? 'cinema.unmute' : 'cinema.mute')}>{muted ? <VolumeX size={19} aria-hidden /> : <Volume2 size={19} aria-hidden />}</button>
          <input className={styles.volume} type="range" min={0} max={1} step={0.05} value={volume} aria-label={t('cinema.volume')} onChange={event => { const value = Number(event.target.value); setVolume(value); player.current?.setVolume(value); if (muted && value > 0) { setMuted(false); player.current?.setMuted(false) } }} />
          <span className={styles.time}>{clock(time)} <span>/ {clock(film.duration)}</span></span>
          <span className={styles.filmLabel}><Film size={13} aria-hidden />{film.systemName}</span>
          <button type="button" className={styles.settingsButton} onClick={() => setSettings(!settings)} aria-expanded={settings} aria-label={t('cinema.settings')}><SlidersHorizontal size={18} aria-hidden /></button>
          <button type="button" onClick={() => void toggleFullscreen()} aria-label={t(fullscreen ? 'cinema.exitFullscreen' : 'cinema.fullscreen')}>{fullscreen ? <Minimize size={19} aria-hidden /> : <Maximize size={19} aria-hidden />}</button>
        </div>
        {fullscreenError && <p className={styles.settingsHint} role="status">{t('cinema.fullscreenError')}</p>}
      </div>}
      {!started && <p className={styles.waitFooter}>{t('cinema.headphones')}</p>}
    </main>
  )
}
