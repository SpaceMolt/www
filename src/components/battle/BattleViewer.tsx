'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import styles from './BattleViewer.module.css'
import { useTranslation } from '@/i18n'
import { useBattleData } from '@/lib/battle/useBattleData'
import { buildTimeline } from '@/lib/battle/timeline'
import {
  makeTransform,
  renderBackground,
  renderFrame,
  sampleShips,
  type ViewState,
} from '@/lib/battle/render'
import { BATTLE_CATEGORY_META, SIDE_COLORS } from '@/lib/battle/types'
import BattleTimeline from './BattleTimeline'
import EventFeed from './EventFeed'
import SideScoreboard from './SideScoreboard'
import ShipInspector from './ShipInspector'

/** Playback duration of one game tick at 1× speed. */
const TICK_MS = 1200
const SPEEDS = [0.5, 1, 2, 4]

export default function BattleViewer({ battleId }: { battleId: string }) {
  const { t } = useTranslation()
  const { summary, entries, isLive, loading, error } = useBattleData(battleId)
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

  const ready = !loading && !error && entries.length > 0

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })

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
  useEffect(() => {
    if (initializedRef.current || loading || entries.length === 0) return
    initializedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const tParam = params.get('t')
    if (tParam !== null && !Number.isNaN(Number(tParam))) {
      seek(Math.min(entries.length - 1, Math.max(0, Number(tParam))))
    } else if (isLive) {
      seek(entries.length - 1, true)
      setFollowing(true)
    } else {
      setPlaying(true)
    }
  }, [loading, entries.length, isLive, seek, setFollowing, setPlaying])

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // --- Page title ---
  useEffect(() => {
    const sys = summary?.system_name || entries[0]?.system_id
    document.title = sys ? `Battle in ${sys} - SpaceMolt` : 'Battle Replay - SpaceMolt'
  }, [summary, entries])

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
    let raf = 0
    let last = performance.now()

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(100, now - last)
      last = now

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
          selectedId: selectedRef.current,
          view: viewRef.current,
          reducedMotion: reducedMotionRef.current,
        })
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [battleId, ready])

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
    let bestDist = 28
    for (const s of ships.values()) {
      if (!s.alive) continue
      const p = tf.toScreen(s.pos)
      const d = Math.hypot(p.x - mx, p.y - my)
      if (d < bestDist) {
        bestDist = d
        best = s.meta.id
      }
    }
    return best
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
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

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seek, setPlaying, setFollowing])

  const cycleSpeed = useCallback(() => {
    setSpeed(prev => {
      const next = SPEEDS[(SPEEDS.indexOf(prev) + 1) % SPEEDS.length]
      speedRef.current = next
      return next
    })
  }, [])

  const copyMomentLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?t=${Math.floor(playheadRef.current)}`
    navigator.clipboard?.writeText(url).catch(() => {})
  }, [])

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

  if (error || entries.length === 0) {
    return (
      <div className={styles.stateScreen}>
        <p className={styles.errorTitle}>{error ? t('battles.error') : t('battles.noBattles')}</p>
        <Link href="/battles" className={styles.backLink}>
          ← {t('battles.pageTitle')}
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.viewer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/battles" className={styles.backLink}>
            ←
          </Link>
          <div>
            <h1 className={styles.title}>
              {summary?.system_name || entry?.system_id || 'Unknown System'}
            </h1>
            <div className={styles.subtitle}>
              {timeline.sides.map((s, i) => (
                <span key={s.sideId}>
                  {i > 0 && <span className={styles.vs}> vs </span>}
                  <span style={{ color: s.color }}>{s.label}</span>
                </span>
              ))}
            </div>
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
              {BATTLE_CATEGORY_META[summary.category].glyph} {BATTLE_CATEGORY_META[summary.category].label}
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
              <b>{timeline.entries.length}</b> ticks
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
      </header>

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

          {timeline.sides.map(side => (
            <SideScoreboard
              key={side.sideId}
              side={side}
              timeline={timeline}
              tickIndex={Math.min(uiTick, timeline.entries.length - 1)}
              selectedId={selectedId}
              onSelect={id => setSelectedId(prev => (prev === id ? null : id))}
              winner={endEntry?.winning_side === side.sideId && !!showOutcome}
            />
          ))}

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
                  ⟲ Replay
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
      />
    </div>
  )
}
