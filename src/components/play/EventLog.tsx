'use client'

import { useEffect, useRef, useMemo } from 'react'
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
  Users,
} from 'lucide-react'
import type { EventLogEntry } from './types'
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

function isTrafficEvent(e: EventLogEntry): boolean {
  const st = e.data?.subtype
  return st === 'poi_arrival' || st === 'poi_departure'
}

type DisplayItem =
  | { kind: 'single'; entry: EventLogEntry }
  | { kind: 'group'; key: string; arrivals: number; departures: number; timestamp: number }

function groupEvents(events: EventLogEntry[]): DisplayItem[] {
  const result: DisplayItem[] = []
  let i = 0
  while (i < events.length) {
    if (isTrafficEvent(events[i])) {
      let j = i + 1
      while (j < events.length && isTrafficEvent(events[j])) j++
      const count = j - i
      if (count > 2) {
        let arrivals = 0
        let departures = 0
        for (let k = i; k < j; k++) {
          if (events[k].data?.subtype === 'poi_arrival') arrivals++
          else departures++
        }
        result.push({
          kind: 'group',
          key: events[i].id,
          arrivals,
          departures,
          timestamp: events[j - 1].timestamp,
        })
      } else {
        for (let k = i; k < j; k++) result.push({ kind: 'single', entry: events[k] })
      }
      i = j
    } else {
      result.push({ kind: 'single', entry: events[i] })
      i++
    }
  }
  return result
}

function trafficSummary(arrivals: number, departures: number): string {
  const parts: string[] = []
  if (arrivals > 0) parts.push(`${arrivals} player${arrivals > 1 ? 's' : ''} arrived`)
  if (departures > 0) parts.push(`${departures} player${departures > 1 ? 's' : ''} departed`)
  return parts.join(', ')
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

  const displayItems = useMemo(() => {
    const events = [...state.eventLog].reverse()
    return groupEvents(events)
  }, [state.eventLog])

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
        {displayItems.length === 0 ? (
          <div className={styles.emptyMessage}>No events yet</div>
        ) : (
          displayItems.map((item) => {
            if (item.kind === 'group') {
              const eventClass = styles.eventInfo || ''
              return (
                <div key={item.key} className={`${styles.event} ${eventClass}`}>
                  <Users size={13} className={styles.eventIcon} />
                  <span className={styles.eventMessage}>
                    {trafficSummary(item.arrivals, item.departures)}
                  </span>
                  <span className={styles.eventTime}>
                    {relativeTime(item.timestamp)}
                  </span>
                </div>
              )
            }
            const config = EVENT_CONFIG[item.entry.type] || EVENT_CONFIG.info
            const Icon = config.icon
            const eventClass = styles[config.className] || ''
            return (
              <div key={item.entry.id} className={`${styles.event} ${eventClass}`}>
                <Icon size={13} className={styles.eventIcon} />
                <span className={styles.eventMessage}>{item.entry.message}</span>
                <span className={styles.eventTime}>
                  {relativeTime(item.entry.timestamp)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
