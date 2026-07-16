'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import {
  AlertTriangle,
  Swords,
  Coins,
  Pickaxe,
  Info,
} from 'lucide-react'
import { usePlayUi } from './PlayProvider'
import type { EventLogEntry } from '@/lib/spacemolt'
import styles from './EventLog.module.css'

const EVENT_CONFIG: Record<string, { icon: typeof Info; className: string }> = {
  danger:  { icon: AlertTriangle, className: 'eventError' },
  combat:  { icon: Swords,        className: 'eventCombat' },
  chat:    { icon: Coins,         className: 'eventTrade' },
  success: { icon: Pickaxe,       className: 'eventMining' },
  info:    { icon: Info,          className: 'eventInfo' },
  warning: { icon: AlertTriangle, className: 'eventWarning' },
}

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'now'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

function EventMessage({ id, message }: { id: number; message: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [clamped, setClamped] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    // Check if text is overflowing (clamped)
    setClamped(el.scrollHeight > el.clientHeight + 1)
  }, [message])

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => !prev)
  }, [])

  return (
    <div className={styles.eventMessageWrap}>
      <span
        ref={textRef}
        className={`${styles.eventMessage} ${expanded ? styles.eventMessageExpanded : styles.eventMessageClamped}`}
      >
        {message}
      </span>
      {(clamped || expanded) && (
        <button className={styles.expandBtn} onClick={toggle} type="button">
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </div>
  )
}

export function EventLog() {
  const eventLog = usePlayUi((s) => s.eventLog)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAutoScrollRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (isAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [eventLog])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAutoScrollRef.current = distFromBottom < 30
  }

  // eventLog is newest-first (index 0 = latest); reverse to render oldest-first
  // with auto-scroll-to-bottom surfacing the latest entry.
  const displayEvents = useMemo<EventLogEntry[]>(() => [...eventLog].reverse(), [eventLog])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Event Log</span>
        <span className={styles.eventCount}>{eventLog.length}</span>
      </div>
      <div
        ref={scrollRef}
        className={styles.events}
        onScroll={handleScroll}
      >
        {displayEvents.length === 0 ? (
          <div className={styles.emptyMessage}>No events yet</div>
        ) : (
          displayEvents.map((entry) => {
            const config = EVENT_CONFIG[entry.kind] || EVENT_CONFIG.info
            const Icon = config.icon
            const eventClass = styles[config.className] || ''
            return (
              <div key={entry.id} className={`${styles.event} ${eventClass}`}>
                <Icon size={13} className={styles.eventIcon} />
                <EventMessage id={entry.id} message={entry.text} />
                <span className={styles.eventTime}>
                  {relativeTime(entry.at)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
