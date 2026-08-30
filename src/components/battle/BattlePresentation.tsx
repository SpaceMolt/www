'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Crosshair, ExternalLink, Radio, RotateCcw } from 'lucide-react'
import styles from './BattleViewer.module.css'
import { useTranslation } from '@/i18n'
import type { BattleData } from '@/lib/battle/useBattleData'
import { battleMomentPath, acceptsPlaybackShortcut, reconcilePlayhead } from '@/lib/battle/viewerNavigation'
import { buildTimeline } from '@/lib/battle/timeline'
import {
  makeTransform,
  renderBackground,
  renderFrame,
  sampleShips,
  shipRadius,
  type ViewState,
} from '@/lib/battle/render'
import { BATTLE_CATEGORY_META, SIDE_COLORS } from '@/lib/battle/types'
import { CategoryIcon } from './CategoryIcon'
import { PlayerLink } from '@/components/profile/ProfileLink'
import BattleTimeline, { useBattleAnimationActive } from './BattleTimeline'
import EventFeed from './EventFeed'
import SideScoreboard from './SideScoreboard'
import ShipInspector from './ShipInspector'

/** Playback duration of one game tick at 1× speed. */
const TICK_MS = 1200
const SPEEDS = [0.5, 1, 2, 4]

export interface BattlePresentationProps {
  battleId: string
  data: BattleData
  embedded?: boolean
  focusPlayerId?: string
  enabled?: boolean
}

/** Shared, read-only replay presentation. Authentication and combat commands stay in Play. */
export default function BattlePresentation({ battleId, data, embedded = false, focusPlayerId, enabled = true }: BattlePresentationProps) {
  const { t } = useTranslation()
  const { summary, entries, isLive, loading, error } = data
  const timeline = useMemo(() => buildTimeline(entries, summary), [entries, summary])
  const timelineRef = useRef(timeline)
  timelineRef.current = timeline

  // --- Playback clock (refs drive the rAF loop; state mirrors for the UI) ---
  const playheadRef = useRef(0)
  const playingRef = useRef(false)
  const followRef = useRef(false)
  const speedRef = useRef(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [follow, setFollow] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [uiTick, setUiTick] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  hoveredRef.current = hoveredId
  selectedRef.current = selectedId

  const viewRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const reducedMotionRef = useRef(false)

  const ready = !loading && entries.length > 0
  const rootRef = useRef<HTMLDivElement>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const animationActive = useBattleAnimationActive(rootRef, enabled && ready)
  const stageVisible = useBattleAnimationActive(stageRef, enabled && ready)
  const stageVisibleRef = useRef(stageVisible)
  stageVisibleRef.current = stageVisible

  const setPlaying = useCallback((v: boolean) => {
    playingRef.current = v
    setIsPlaying(v)
    if (v) followRef.current = false
    if (v) setFollow(false)
  }, [])

  const setFollowing = useCallback((v: boolean) => {
    followRef.current = v
    setFollow(v)
    if (v) {
      playingRef.current = false
      setIsPlaying(false)
    }
  }, [])

  const seek = useCallback((tickFloat: number, keepFollow = false) => {
    const len = timelineRef.current.entries.length
    playheadRef.current = Math.max(0, Math.min(len > 0 ? len - 1 + 0.999 : 0, tickFloat))
    if (!keepFollow) {
      followRef.current = false
      setFollow(false)
    }
    setUiTick(Math.floor(playheadRef.current))
  }, [])

  // Initial position: ?t= from the URL, else start (or live tail).
  const initializedRef = useRef(false)
  const previousEntriesRef = useRef(entries)
  useEffect(() => {
    playheadRef.current = reconcilePlayhead(previousEntriesRef.current, entries, playheadRef.current)
    previousEntriesRef.current = entries
    setUiTick(Math.floor(playheadRef.current))
  }, [entries])

  useEffect(() => {
    if (initializedRef.current || loading || entries.length === 0) return
    initializedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const tParam = embedded ? null : params.get('t')
    if (tParam !== null && !Number.isNaN(Number(tParam))) {
      seek(Math.min(entries.length - 1, Math.max(0, Number(tParam))))
    } else if (isLive) {
      seek(entries.length - 1, true)
      setFollowing(true)
    } else if (embedded) {
      seek(entries.length - 1 + 0.999)
    } else {
      setPlaying(true)
    }
  }, [loading, entries.length, isLive, embedded, seek, setFollowing, setPlaying])

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // --- Page title ---
  useEffect(() => {
    if (embedded) return
    const sys = summary?.system_name || entries[0]?.system_id
    document.title = sys ? `Battle in ${sys} - SpaceMolt` : 'Battle Replay - SpaceMolt'
  }, [summary, entries, embedded])

  // --- Canvas sizing + background ---
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return

    const resize = () => {
      const rect = stage.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      sizeRef.current = { width: rect.width, height: rect.height, dpr }
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      if (!bgCanvasRef.current) bgCanvasRef.current = document.createElement('canvas')
      renderBackground(bgCanvasRef.current, rect.width, rect.height, dpr, battleId, SIDE_COLORS)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [battleId, ready])

  // --- Master animation loop: clock + arena drawing ---
  useEffect(() => {
    if (!animationActive) return
    let raf = 0
    let last = performance.now()

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(100, now - last)
      last = now
      if (document.visibilityState === 'hidden') return

      const tl = timelineRef.current
      const len = tl.entries.length
      const maxHead = len > 0 ? len - 1 + 0.999 : 0

      if (playingRef.current && len > 0) {
        playheadRef.current += (dt / TICK_MS) * speedRef.current
        if (playheadRef.current >= maxHead) {
          playheadRef.current = maxHead
          playingRef.current = false
          setIsPlaying(false)
        }
      } else if (followRef.current && len > 0) {
        // Chase the newest tick; jump if we fall far behind.
        const target = maxHead
        const gap = target - playheadRef.current
        if (gap > 5) playheadRef.current = target - 2
        else if (gap > 0.001) {
          playheadRef.current = Math.min(target, playheadRef.current + (dt / TICK_MS) * Math.max(1, gap / 2))
        }
      }

      const tick = Math.floor(playheadRef.current)
      setUiTick(prev => (prev === tick ? prev : tick))

      // Keep the clock moving for visible playback controls, but do not draw
      // an arena that has scrolled out of Play's center panel.
      if (!stageVisibleRef.current) return
      const canvas = canvasRef.current
      const bg = bgCanvasRef.current
      const { width, height, dpr } = sizeRef.current
      if (!canvas || width === 0) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (bg) ctx.drawImage(bg, 0, 0, width, height)
      else {
        ctx.fillStyle = '#04070f'
        ctx.fillRect(0, 0, width, height)
      }
      if (len > 0) {
        renderFrame(ctx, {
          timeline: tl,
          battleId,
          playhead: playheadRef.current,
          timeMs: now,
          width,
          height,
          hoveredId: hoveredRef.current,
          selectedId: selectedRef.current ?? focusPlayerId ?? null,
          view: viewRef.current,
          reducedMotion: reducedMotionRef.current,
        })
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [battleId, ready, focusPlayerId, animationActive])

  // --- Pointer interaction: hover, select, pan, zoom ---
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mx = clientX - rect.left
    const my = clientY - rect.top
    const { width, height } = sizeRef.current
    const tf = makeTransform(width, height, viewRef.current)
    const ships = sampleShips(timelineRef.current, playheadRef.current, performance.now(), true)
    let best: string | null = null
    let bestDist = Infinity
    for (const s of ships.values()) {
      if (!s.alive) continue
      const p = tf.toScreen(s.pos)
      const d = Math.hypot(p.x - mx, p.y - my)
      // A ship is a 28px target whatever its glyph. A station is drawn far larger
      // than that — ring, spars and all — so it takes a target that covers what
      // is actually on screen, or most of the thing would not be clickable.
      const reach = s.meta.kind === 'station' ? Math.max(28, shipRadius(s.meta, tf.scale) * 1.45) : 28
      if (d < reach && d < bestDist) {
        bestDist = d
        best = s.meta.id
      }
    }
    return best
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    rootRef.current?.focus({ preventScroll: true })
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.x
        const dy = e.clientY - dragRef.current.y
        if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true
        if (dragRef.current.moved) {
          viewRef.current.panX += dx
          viewRef.current.panY += dy
          dragRef.current.x = e.clientX
          dragRef.current.y = e.clientY
        }
        return
      }
      setHoveredId(hitTest(e.clientX, e.clientY))
    },
    [hitTest],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasDrag = dragRef.current?.moved
      dragRef.current = null
      if (wasDrag) return
      const hit = hitTest(e.clientX, e.clientY)
      setSelectedId(prev => (hit === prev ? null : hit))
    },
    [hitTest],
  )

  const onWheel = useCallback((e: React.WheelEvent) => {
    const v = viewRef.current
    const factor = Math.exp(-e.deltaY * 0.0012)
    const next = Math.max(0.5, Math.min(3, v.zoom * factor))
    const applied = next / v.zoom
    // Zoom around the viewport centre; keep pan proportional.
    v.panX *= applied
    v.panY *= applied
    v.zoom = next
  }, [])

  const resetView = useCallback(() => {
    viewRef.current = { zoom: 1, panX: 0, panY: 0 }
  }, [])

  // Shortcuts belong to the focused viewer, never the rest of Play or a form control.
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!acceptsPlaybackShortcut(e, !!target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="slider"]'))) return
    switch (e.key) {
      case ' ':
        e.preventDefault()
        setPlaying(!playingRef.current)
        break
      case 'ArrowLeft':
        e.preventDefault()
        seek(Math.floor(playheadRef.current) - (e.shiftKey ? 5 : 1))
        break
      case 'ArrowRight':
        e.preventDefault()
        seek(Math.floor(playheadRef.current) + (e.shiftKey ? 5 : 1))
        break
      case 'Home':
        e.preventDefault()
        seek(0)
        break
      case 'End':
        e.preventDefault()
        seek(timelineRef.current.entries.length)
        break
      case 'l':
      case 'L':
        if (timelineRef.current.entries.length > 0) setFollowing(!followRef.current)
        break
      case 'Escape':
        setSelectedId(null)
        break
    }
  }

  const cycleSpeed = useCallback(() => {
    const next = SPEEDS[(SPEEDS.indexOf(speedRef.current) + 1) % SPEEDS.length]
    speedRef.current = next
    setSpeed(next)
  }, [])

  const copyMomentLink = useCallback(() => {
    const url = `${window.location.origin}${battleMomentPath(battleId, playheadRef.current)}`
    navigator.clipboard?.writeText(url).catch(() => {})
  }, [battleId])

  // --- Derived UI data ---
  const entry = timeline.entries[Math.min(uiTick, timeline.entries.length - 1)]
  const ended = timeline.entries.some(e => e.battle_ended)
  const endEntry = timeline.entries.find(e => e.battle_ended)?.battle_ended
  const showOutcome = ended && uiTick >= timeline.entries.length - 1 && !isPlaying && endEntry

  const outcomeText = useMemo(() => {
    if (!endEntry) return ''
    if (endEntry.outcome === 'victory') {
      const side = timeline.sides.find(s => s.sideId === endEntry.winning_side)
      return `${t('battles.outcomeVictory')} — ${side?.label ?? `Side ${endEntry.winning_side}`}`
    }
    if (endEntry.outcome === 'stalemate') return t('battles.outcomeStalemate')
    if (endEntry.outcome === 'mutual_destruction') return t('battles.outcomeMutualDestruction')
    return endEntry.outcome
  }, [endEntry, timeline.sides, t])

  if (loading) {
    return (
      <div className={styles.stateScreen}>
        <div className={styles.loadingRings}>
          <span />
          <span />
          <span />
        </div>
        <p>{t('battles.loading')}</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={styles.stateScreen}>
        <p>{error ? t('battles.error') : t(`battles.stream.${data.phase === 'live' ? 'waiting' : data.phase}`)}</p>
        <button type="button" onClick={data.retry} className={styles.replayBtn} disabled={data.refreshing}>
          <RotateCcw size={12} aria-hidden /> {t('battles.stream.retry')}
        </button>
        {!embedded && <Link href="/battles" className={styles.backLink}>{t('battles.pageTitle')}</Link>}
      </div>
    )
  }

  return (
    <div ref={rootRef} className={`${styles.viewer} ${embedded ? styles.embedded : ''}`} tabIndex={0} role="region" aria-label={t('battles.stream.viewerLabel')} onKeyDown={onKey}>
      {embedded ? (
        <header className={styles.embeddedHeader}>
          <span className={styles.embeddedMode}><Radio size={12} aria-hidden /> {t(isLive && follow ? 'battles.stream.following' : 'battles.stream.recorded')}</span>
          <div className={styles.embeddedActions}>
            {focusPlayerId && timeline.participants.has(focusPlayerId) && (
              <button type="button" onClick={() => { resetView(); setSelectedId(focusPlayerId) }}>
                <Crosshair size={13} aria-hidden /> {t('battles.stream.yourShip')}
              </button>
            )}
            <a href={`/battles/${encodeURIComponent(battleId)}`} target="_blank" rel="noopener noreferrer">
              {t('battles.stream.fullReplay')} <ExternalLink size={12} aria-hidden />
            </a>
          </div>
        </header>
      ) : <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/battles" className={styles.backLink}>
            ←
          </Link>
          <div>
            <h1 className={styles.title}>
              {summary?.system_name || entry?.system_id || t('battles.unknownSystem')}
            </h1>
            <div className={styles.subtitle}>
              {timeline.sides.map((s, i) => (
                <span key={s.sideId}>
                  {i > 0 && <span className={styles.vs}> vs </span>}
                  <span style={{ color: s.color }}>{s.label}</span>
                </span>
              ))}
            </div>
            {(summary?.player_names?.length ?? 0) > 0 && (
              <div className={styles.pilotLinks}>
                {summary!.player_names!.map((name, i) => (
                  <span key={name}>
                    {i > 0 && ', '}
                    <PlayerLink name={name} className={styles.pilotLink} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={styles.headerRight}>
          {summary?.category && BATTLE_CATEGORY_META[summary.category] && (
            <span
              className={styles.categoryBadge}
              style={{
                color: BATTLE_CATEGORY_META[summary.category].color,
                borderColor: BATTLE_CATEGORY_META[summary.category].color,
              }}
            >
              <CategoryIcon category={summary.category} size={11} /> {t(BATTLE_CATEGORY_META[summary.category].labelKey)}
            </span>
          )}
          {isLive ? (
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              {t('battles.statusLive')}
            </span>
          ) : (
            <span className={styles.finalBadge}>{outcomeText || t('battles.statusCompleted')}</span>
          )}
          <div className={styles.metaStats}>
            <span>
              <b>{timeline.entries.length}</b> {t('battles.ticks')}
            </span>
            <span>
              <b>{timeline.participants.size}</b> {t('battles.participants')}
            </span>
            <span>
              <b>{(endEntry?.total_damage ?? summary?.total_damage ?? timeline.totalDamage).toLocaleString()}</b>{' '}
              {t('battles.damage')}
            </span>
          </div>
        </div>
      </header>}

      <div className={`${styles.streamStatus} ${data.freshness === 'stale' ? styles.streamStale : ''}`} role="status">
        <span>{t(`battles.stream.${data.freshness === 'stale' ? 'stale' : data.phase}`)}</span>
        {entry && <span>{t('battles.stream.resolvedTick', { tick: entry.tick })}</span>}
        {(data.freshness === 'stale' || data.phase === 'unavailable') && <button type="button" onClick={data.retry} disabled={data.refreshing}>{t('battles.stream.retry')}</button>}
      </div>

      <div className={styles.stageRow}>
        <div
          ref={stageRef}
          className={styles.stage}
          onDoubleClick={resetView}
          onWheel={onWheel}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              setHoveredId(null)
              dragRef.current = null
            }}
          />

          {/* display:contents on desktop (panels dock to the arena flanks);
              a stacked chip column on narrow screens so multi-side battles
              never bury the arena under floating panels. */}
          <div className={styles.scoreboardLayer}>
            {timeline.sides.map(side => (
              <SideScoreboard
                key={side.sideId}
                side={side}
                timeline={timeline}
                tickIndex={Math.min(uiTick, timeline.entries.length - 1)}
                selectedId={selectedId}
                onSelect={id => setSelectedId(prev => (prev === id ? null : id))}
                winner={endEntry?.winning_side === side.sideId && !!showOutcome}
                compact={embedded}
                focusPlayerId={focusPlayerId}
              />
            ))}
          </div>

          {selectedId && (
            <ShipInspector
              timeline={timeline}
              participantId={selectedId}
              tickIndex={Math.min(uiTick, timeline.entries.length - 1)}
              onClose={() => setSelectedId(null)}
            />
          )}

          {showOutcome && (
            <div className={styles.outcomeBanner}>
              <div className={styles.outcomeInner}>
                <span className={styles.outcomeLabel}>{outcomeText}</span>
                <span className={styles.outcomeMeta}>
                  {endEntry.duration} ticks · {endEntry.total_damage.toLocaleString()} damage ·{' '}
                  {endEntry.ships_destroyed} {t('battles.destroyed')}
                </span>
                <button className={styles.replayBtn} onClick={() => { seek(0); setPlaying(true) }}>
                  <RotateCcw size={12} aria-hidden /> {t('battles.replay')}
                </button>
              </div>
            </div>
          )}
        </div>

        <EventFeed
          timeline={timeline}
          tickIndex={Math.min(uiTick, timeline.entries.length - 1)}
          isPlaying={isPlaying || follow}
          onJump={(tickIndex, actorId) => {
            seek(tickIndex)
            if (actorId) setSelectedId(actorId)
          }}
        />
      </div>

      <BattleTimeline
        timeline={timeline}
        getPlayhead={() => playheadRef.current}
        isPlaying={isPlaying}
        isLive={isLive}
        follow={follow}
        speed={speed}
        onSeek={seek}
        onTogglePlay={() => setPlaying(!playingRef.current)}
        onToggleFollow={() => setFollowing(!followRef.current)}
        onCycleSpeed={cycleSpeed}
        onCopyLink={copyMomentLink}
        enabled={enabled}
      />
    </div>
  )
}
