'use client'

import { useEffect, useRef } from 'react'
import { useGame } from './GameProvider'
import {
  AlertTriangle,
  Swords,
  Coins,
  Pickaxe,
  Navigation,
  Info,
  Bell,
  Cpu,
} from 'lucide-react'
import styles from './EventLog.module.css'

const EVENT_CONFIG: Record<string, { icon: typeof Info; className: string }> = {
  error:    { icon: AlertTriangle, className: 'eventError' },
  combat:   { icon: Swords,        className: 'eventCombat' },
  trade:    { icon: Coins,         className: 'eventTrade' },
  mining:   { icon: Pickaxe,       className: 'eventMining' },
  travel:   { icon: Navigation,    className: 'eventTravel' },
  info:     { icon: Info,          className: 'eventInfo' },
  warning:  { icon: AlertTriangle, className: 'eventWarning' },
  system:   { icon: Cpu,           className: 'eventSystem' },
  crafting: { icon: Pickaxe,       className: 'eventMining' },
  drone:    { icon: Bell,          className: 'eventSystem' },
  base:     { icon: Bell,          className: 'eventSystem' },
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

export function EventLog() {
  const { state } = useGame()
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAutoScrollRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (isAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [state.eventLog])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAutoScrollRef.current = distFromBottom < 30
  }

  const events = [...state.eventLog].reverse()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Event Log</span>
        <span className={styles.eventCount}>{state.eventLog.length}</span>
      </div>
      <div
        ref={scrollRef}
        className={styles.events}
        onScroll={handleScroll}
      >
        {events.length === 0 ? (
          <div className={styles.emptyMessage}>No events yet</div>
        ) : (
          events.map((entry) => {
            const config = EVENT_CONFIG[entry.type] || EVENT_CONFIG.info
            const Icon = config.icon
            const eventClass = styles[config.className] || ''
            return (
              <div key={entry.id} className={`${styles.event} ${eventClass}`}>
                <Icon size={13} className={styles.eventIcon} />
                <span className={styles.eventMessage}>{entry.message}</span>
                <span className={styles.eventTime}>
                  {relativeTime(entry.timestamp)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
