'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './BattleViewer.module.css'
import { useTranslation } from '@/i18n'
import type { BattleTimeline as Timeline } from '@/lib/battle/timeline'

interface Props {
  timeline: Timeline
  getPlayhead: () => number
  isPlaying: boolean
  isLive: boolean
  follow: boolean
  speed: number
  onSeek: (tickFloat: number) => void
  onTogglePlay: () => void
  onToggleFollow: () => void
  onCycleSpeed: () => void
  onCopyLink: () => void
}

/**
 * Playback controls plus a scrubber whose background is a per-tick damage
 * intensity chart (stacked by side) with event markers for kills, joins,
 * escapes and battle end.
 */
export default function BattleTimeline({
  timeline,
  getPlayhead,
  isPlaying,
  isLive,
  follow,
  speed,
  onSeek,
  onTogglePlay,
  onToggleFollow,
  onCycleSpeed,
  onCopyLink,
}: Props) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)
  const [hoverInfo, setHoverInfo] = useState<{ x: number; tickIndex: number } | null>(null)
  const [copied, setCopied] = useState(false)

  const n = timeline.entries.length

  const tickAtClientX = useCallback(
    (clientX: number): number => {
      const wrap = wrapRef.current
      if (!wrap || n === 0) return 0
      const rect = wrap.getBoundingClientRect()
      const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return f * (n - 1)
    },
    [n],
  )

  // Draw loop: chart is static per timeline, playhead moves every frame.
  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      const rect = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const W = rect.width
      const H = rect.height
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
        canvas.style.width = `${W}px`
        canvas.style.height = `${H}px`
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const markerH = 12
      const chartTop = markerH + 2
      const chartH = H - chartTop - 4

      if (n === 0) return
      const slotW = W / n
      const barW = Math.max(1, Math.min(slotW - 2, slotW * 0.7))
      const peak = Math.max(1, timeline.peakTickDamage)

      // Damage bars, stacked by side with 1px gaps between segments.
      for (let i = 0; i < n; i++) {
        const td = timeline.tickDamage[i]
        const x = i * slotW + (slotW - barW) / 2
        // Idle ticks still get a faint baseline notch so the scrubber reads as a track.
        if (td.total <= 0) {
          ctx.fillStyle = 'rgba(107,143,163,0.18)'
          ctx.fillRect(x, chartTop + chartH - 1.5, barW, 1.5)
          continue
        }
        const totalH = Math.max(3, (td.total / peak) * chartH)
        let y = chartTop + chartH
        td.bySide.forEach((dmg, si) => {
          if (dmg <= 0) return
          const h = Math.max(1.5, (dmg / td.total) * totalH - 1)
          y -= h
          ctx.fillStyle = timeline.sides[si]?.color ?? '#a8c5d6'
          ctx.beginPath()
          ctx.roundRect(x, y, barW, h, 1)
          ctx.fill()
          y -= 1 // gap between stacked segments
        })
      }

      // Event markers.
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const ev of timeline.events) {
        if (ev.kind !== 'kill' && ev.kind !== 'join' && ev.kind !== 'escape' && ev.kind !== 'end') continue
        const x = ev.tickIndex * slotW + slotW / 2
        ctx.fillStyle = ev.color
        ctx.font = '700 9px "JetBrains Mono", monospace'
        const glyph = ev.kind === 'kill' ? '✕' : ev.kind === 'join' ? '+' : ev.kind === 'escape' ? '↗' : '⚑'
        ctx.fillText(glyph, x, markerH / 2 + 1)
      }

      // Played region tint.
      const ph = Math.max(0, Math.min(n - 1, getPlayhead()))
      const px = n > 1 ? (ph / (n - 1)) * W : 0
      ctx.fillStyle = 'rgba(0,212,255,0.07)'
      ctx.fillRect(0, chartTop, px, chartH)

      // Playhead.
      ctx.strokeStyle = '#00d4ff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, 2)
      ctx.lineTo(px, H - 2)
      ctx.stroke()
      ctx.fillStyle = '#00d4ff'
      ctx.beginPath()
      ctx.moveTo(px - 4, 0)
      ctx.lineTo(px + 4, 0)
      ctx.lineTo(px, 6)
      ctx.closePath()
      ctx.fill()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [timeline, n, getPlayhead])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      scrubbing.current = true
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      onSeek(tickAtClientX(e.clientX))
    },
    [onSeek, tickAtClientX],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const wrap = wrapRef.current
      if (wrap) {
        const rect = wrap.getBoundingClientRect()
        setHoverInfo({ x: e.clientX - rect.left, tickIndex: Math.round(tickAtClientX(e.clientX)) })
      }
      if (scrubbing.current) onSeek(tickAtClientX(e.clientX))
    },
    [onSeek, tickAtClientX],
  )
  const onPointerUp = useCallback(() => {
    scrubbing.current = false
  }, [])

  const hoverDamage = hoverInfo ? timeline.tickDamage[hoverInfo.tickIndex] : null
  const hoverEvents = hoverInfo
    ? timeline.events.filter(
        ev => ev.tickIndex === hoverInfo.tickIndex && (ev.kind === 'kill' || ev.kind === 'escape' || ev.kind === 'end'),
      )
    : []

  const playheadTick = Math.floor(Math.max(0, Math.min(n - 1, getPlayhead())))
  const gameTick = timeline.entries[playheadTick]?.tick

  return (
    <div className={styles.timelineBar}>
      <div className={styles.controls}>
        <button className={styles.ctrlBtn} onClick={() => onSeek(0)} title="Restart (Home)" aria-label={t('battles.restart')}>
          ⏮
        </button>
        <button className={`${styles.ctrlBtn} ${styles.playBtn}`} onClick={onTogglePlay} title="Play/Pause (Space)" aria-label={isPlaying ? t('battles.pause') : t('battles.play')}>
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button className={styles.ctrlBtn} onClick={onCycleSpeed} title="Playback speed" aria-label={`${t('battles.playbackSpeed')} ${speed}x`}>
          {speed}×
        </button>
        {isLive && (
          <button
            className={`${styles.ctrlBtn} ${styles.liveBtn} ${follow ? styles.liveBtnOn : ''}`}
            onClick={onToggleFollow}
            title="Follow live (L)"
            aria-label={t('battles.followLive')}
          >
            ● LIVE
          </button>
        )}
      </div>

      <div
        ref={wrapRef}
        className={styles.scrubber}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHoverInfo(null)
          scrubbing.current = false
        }}
      >
        <canvas ref={canvasRef} className={styles.scrubberCanvas} />
        {hoverInfo && hoverDamage && (
          <div
            className={styles.scrubTooltip}
            style={{ left: Math.min(Math.max(hoverInfo.x, 70), (wrapRef.current?.clientWidth ?? 200) - 70) }}
          >
            <div className={styles.scrubTooltipTitle}>
              {t('battles.tickShort')} {hoverInfo.tickIndex + 1}/{n}
            </div>
            {hoverDamage.total > 0 ? (
              hoverDamage.bySide.map((dmg, si) =>
                dmg > 0 ? (
                  <div key={si} className={styles.scrubTooltipRow}>
                    <span className={styles.dot} style={{ background: timeline.sides[si]?.color }} />
                    {timeline.sides[si]?.label}: {dmg.toLocaleString()}
                  </div>
                ) : null,
              )
            ) : (
              <div className={styles.scrubTooltipRow}>{t('battles.noDamage')}</div>
            )}
            {hoverEvents.map((ev, i) => (
              <div key={i} className={styles.scrubTooltipRow} style={{ color: ev.color }}>
                {ev.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.tickReadout}>
        <span className={styles.tickNum}>
          {playheadTick + 1}/{n}
        </span>
        {gameTick !== undefined && <span className={styles.gameTick}>#{gameTick}</span>}
        <button
          className={styles.ctrlBtn}
          aria-label={t('battles.copyMoment')}
          onClick={() => {
            onCopyLink()
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          title="Copy link to this moment"
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>
    </div>
  )
}
