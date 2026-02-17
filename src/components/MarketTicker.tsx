'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './MarketTicker.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface TickerTrade {
  id: number
  item_name: string
  quantity: number
  price_each: number
  total: number
  buyer: string
  seller: string
  station_name: string
  order_type: string
  time: number
}

interface GameEvent {
  type: string
  data: Record<string, string | number | undefined>
  timestamp?: string
}

const MAX_ITEMS = 50
let nextId = 0

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`
  return n.toLocaleString()
}

export default function MarketTicker() {
  const [trades, setTrades] = useState<TickerTrade[]>([])
  const [connected, setConnected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const addTrade = useCallback((data: Record<string, string | number | undefined>, timestamp?: string) => {
    const trade: TickerTrade = {
      id: nextId++,
      item_name: String(data.item_name || ''),
      quantity: Number(data.quantity || 0),
      price_each: Number(data.price_each || 0),
      total: Number(data.total || 0),
      buyer: String(data.buyer || ''),
      seller: String(data.seller || ''),
      station_name: String(data.station_name || ''),
      order_type: String(data.order_type || ''),
      time: timestamp ? new Date(timestamp).getTime() : Date.now(),
    }

    setTrades(prev => {
      const next = [trade, ...prev]
      return next.slice(0, MAX_ITEMS)
    })
  }, [])

  useEffect(() => {
    let eventSource: EventSource | null = null

    function connect() {
      if (eventSource) eventSource.close()
      setConnected(false)

      eventSource = new EventSource(`${API_BASE}/events`)

      eventSource.onopen = () => setConnected(true)

      eventSource.onmessage = (event) => {
        try {
          const parsed: GameEvent = JSON.parse(event.data)
          if (parsed.type === 'exchange_fill' && parsed.data) {
            addTrade(parsed.data, parsed.timestamp)
          }
        } catch {
          // ignore
        }
      }

      eventSource.onerror = () => {
        setConnected(false)
        setTimeout(() => {
          if (eventSource && eventSource.readyState === EventSource.CLOSED) {
            connect()
          }
        }, 5000)
      }
    }

    connect()
    return () => { if (eventSource) eventSource.close() }
  }, [addTrade])

  // Build the ticker content — duplicate for seamless loop
  const items = trades.length > 0 ? trades : null

  return (
    <div className={styles.ticker}>
      <div className={styles.label}>
        <span className={`${styles.dot} ${connected ? styles.dotConnected : ''}`} />
        LIVE
      </div>
      <div className={styles.track} ref={containerRef}>
        {!items ? (
          <span className={styles.waiting}>
            {connected ? 'Waiting for trades...' : 'Connecting...'}
          </span>
        ) : (
          <div className={styles.scroll}>
            {/* Render twice for seamless loop */}
            {[0, 1].map(copy => (
              <div key={copy} className={styles.scrollCopy} aria-hidden={copy === 1}>
                {items.map((t, i) => (
                  <span key={`${copy}-${t.id}`} className={styles.trade}>
                    <span className={styles.itemName}>{t.item_name}</span>
                    <span className={styles.qty}>x{t.quantity}</span>
                    <span className={styles.at}>@</span>
                    <span className={styles.price}>{formatCredits(t.price_each)}</span>
                    <span className={styles.credits}>cr</span>
                    <span className={styles.arrow}>{'\u2192'}</span>
                    <span className={styles.station}>{t.station_name}</span>
                    {i < items.length - 1 && <span className={styles.divider}>|</span>}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
