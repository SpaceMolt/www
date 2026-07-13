'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { LiveFeed } from '@/components/LiveFeed'
import { subscribeToEvents } from '@/lib/sharedEventSource'
import { useTranslation } from '@/i18n'
import type { ServerStats } from './useServerStats'
import styles from './console.module.css'

export const PANE_MIN_W = 260
export const PANE_MAX_W = 560
export const PANE_MIN_H = 180
export const PANE_MAX_H = 560

interface LivePaneProps {
  /** Collapsed: pane stays mounted (so feeds keep accumulating) but is not shown. */
  hidden?: boolean
  width: number
  height: number
  onWidthChange: (w: number) => void
  onHeightChange: (h: number) => void
  onClose: () => void
  stats: ServerStats | null
  online: boolean
}

interface TradeEntry {
  id: number
  item_name: string
  quantity: number
  price_each: number
  station_name: string
  time: number
}

let nextTradeId = 0
const MAX_TRADES = 40

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`
  return n.toLocaleString()
}

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 10) return 'now'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
}

function LiveTrades() {
  const { t } = useTranslation()
  const [trades, setTrades] = useState<TradeEntry[]>([])
  const [, setClock] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return subscribeToEvents((raw) => {
      try {
        const parsed = JSON.parse(raw) as {
          type?: string
          timestamp?: string
          data?: Record<string, string | number | undefined>
        }
        if (parsed.type !== 'exchange_fill' || !parsed.data) return
        const d = parsed.data
        const entry: TradeEntry = {
          id: nextTradeId++,
          item_name: String(d.item_name || ''),
          quantity: Number(d.quantity || 0),
          price_each: Number(d.price_each || 0),
          station_name: String(d.station_name || ''),
          time: parsed.timestamp ? new Date(parsed.timestamp).getTime() : Date.now(),
        }
        setTrades((prev) => [entry, ...prev].slice(0, MAX_TRADES))
      } catch {
        // ignore parse errors
      }
    })
  }, [])

  if (trades.length === 0) {
    return <div className={styles.tradesEmpty}>{t('console.waitingTrades')}</div>
  }

  return (
    <div className={styles.trades} tabIndex={0} role="region" aria-label="Recent trades">
      {trades.map((trade) => (
        <div key={trade.id} className={styles.tradeRow}>
          <span className={styles.tradeItem}>{trade.item_name}</span>
          <span className={styles.tradeQty}>x{trade.quantity}</span>
          <span className={styles.tradePrice}>{formatCredits(trade.price_each)} cr</span>
          <span className={styles.tradeStation}>{trade.station_name}</span>
          <span className={styles.tradeTime}>{relativeTime(trade.time)}</span>
        </div>
      ))}
    </div>
  )
}

export function LivePane({ hidden, width, height, onWidthChange, onHeightChange, onClose, stats, online }: LivePaneProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'feed' | 'trades'>('feed')
  const [feedStatus, setFeedStatus] = useState('')
  const dragState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  const handleStatusChange = useCallback((connected: boolean, status: string) => {
    void connected
    setFeedStatus(status)
  }, [])

  // --- desktop horizontal resize ---
  const onResizerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, startW: width, startH: height }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add(styles.resizing)
  }, [width, height])

  const onResizerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const delta = dragState.current.startX - e.clientX
    onWidthChange(Math.min(PANE_MAX_W, Math.max(PANE_MIN_W, dragState.current.startW + delta)))
  }, [onWidthChange])

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = null
    e.currentTarget.classList.remove(styles.resizing)
  }, [])

  const onResizerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      onWidthChange(Math.min(PANE_MAX_W, width + 24))
    } else if (e.key === 'ArrowRight') {
      onWidthChange(Math.max(PANE_MIN_W, width - 24))
    } else if (e.key === 'Home') {
      onWidthChange(PANE_MAX_W)
    } else if (e.key === 'End') {
      onWidthChange(PANE_MIN_W)
    } else {
      return
    }
    e.preventDefault()
  }, [width, onWidthChange])

  // --- mobile vertical resize (bottom sheet grip) ---
  const onGripPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, startW: width, startH: height }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [width, height])

  const onGripPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const delta = dragState.current.startY - e.clientY
    onHeightChange(Math.min(PANE_MAX_H, Math.max(PANE_MIN_H, dragState.current.startH + delta)))
  }, [onHeightChange])

  const onGripKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      onHeightChange(Math.min(PANE_MAX_H, height + 24))
    } else if (e.key === 'ArrowDown') {
      onHeightChange(Math.max(PANE_MIN_H, height - 24))
    } else {
      return
    }
    e.preventDefault()
  }, [height, onHeightChange])

  return (
    <>
      <aside
        id="console-live-pane"
        className={styles.pane}
        hidden={hidden}
        aria-label={t('console.telemetry')}
        data-pagefind-ignore
        style={{ '--pane-w': `${width}px`, '--pane-h': `${height}px` } as React.CSSProperties}
      >
        <div
          className={styles.resizer}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('console.resizeLive')}
          aria-valuemin={PANE_MIN_W}
          aria-valuemax={PANE_MAX_W}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={onResizerPointerDown}
          onPointerMove={onResizerPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onResizerKeyDown}
        />
        <div
          className={styles.sheetGrip}
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('console.resizeLive')}
          aria-valuemin={PANE_MIN_H}
          aria-valuemax={PANE_MAX_H}
          aria-valuenow={height}
          tabIndex={0}
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onGripKeyDown}
        />
        <div className={styles.paneHeader}>
          <span className={`${styles.statusLed} ${online ? styles.ledOnline : ''}`} aria-hidden />
          <span className={styles.paneTitle}>{t('console.telemetry')}</span>
          <span className={styles.paneStatus}>{feedStatus}</span>
          <button className={styles.paneClose} onClick={onClose} aria-label={t('console.closeLive')}>
            <X size={14} />
          </button>
        </div>
        <div className={styles.paneTabs} role="tablist" aria-label={t('console.telemetry')}>
          <button
            role="tab"
            id="live-tab-feed"
            aria-selected={tab === 'feed'}
            aria-controls="live-panel-feed"
            className={styles.paneTab}
            onClick={() => setTab('feed')}
          >
            {t('console.feed')}
          </button>
          <button
            role="tab"
            id="live-tab-trades"
            aria-selected={tab === 'trades'}
            aria-controls="live-panel-trades"
            className={styles.paneTab}
            onClick={() => setTab('trades')}
          >
            {t('console.trades')}
          </button>
        </div>
        <div
          id="live-panel-feed"
          role="tabpanel"
          aria-labelledby="live-tab-feed"
          className={styles.paneContent}
          hidden={tab !== 'feed'}
        >
          <LiveFeed hideHeader onStatusChange={handleStatusChange} />
        </div>
        <div
          id="live-panel-trades"
          role="tabpanel"
          aria-labelledby="live-tab-trades"
          className={styles.paneContent}
          hidden={tab !== 'trades'}
        >
          <LiveTrades />
        </div>
        <div className={styles.paneStats}>
          <div className={styles.paneStat}>
            <span className={styles.paneStatLabel}>{t('statsBar.onlineCount')}</span>
            <span className={styles.paneStatValue}>{stats ? stats.online_players.toLocaleString() : '-'}</span>
          </div>
          <div className={styles.paneStat}>
            <span className={styles.paneStatLabel}>{t('statsBar.players')}</span>
            <span className={styles.paneStatValue}>{stats ? stats.total_players.toLocaleString() : '-'}</span>
          </div>
          <div className={styles.paneStat}>
            <span className={styles.paneStatLabel}>{t('statsBar.systems')}</span>
            <span className={styles.paneStatValue}>{stats ? stats.total_systems.toLocaleString() : '-'}</span>
          </div>
          <div className={styles.paneStat}>
            <span className={styles.paneStatLabel}>{t('statsBar.posts')}</span>
            <span className={styles.paneStatValue}>
              {stats ? ((stats.forum_threads || 0) + (stats.forum_replies || 0)).toLocaleString() : '-'}
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
