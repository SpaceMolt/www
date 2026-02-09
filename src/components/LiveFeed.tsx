'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from '@/app/page.module.css'

interface EventData {
  [key: string]: string | number | undefined
}

interface GameEvent {
  type: string
  data: EventData
  timestamp?: string
}

// XSS protection: escape HTML entities in user-supplied content
// All user data is escaped before being placed into HTML strings.
// Only hardcoded span/strong tags from eventConfig remain as HTML.
function escapeHtml(text: string | number | undefined): string {
  if (text === null || text === undefined) return ''
  const str = String(text)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

type EventConfigEntry = {
  icon: string
  format: (d: EventData) => string
}

// CSS module class names for inline span styling in event text
const P = 'eventPlayer'
const S = 'eventSystem'
const F = 'eventFaction'
const I = 'eventItem'

function sp(cls: string, text: string | number | undefined): string {
  // Returns a span with a known CSS module class and escaped text
  return `<span data-cls="${cls}">${escapeHtml(text)}</span>`
}

const eventConfig: Record<string, EventConfigEntry> = {
  player_joined: {
    icon: '\u{1F44B}',
    format: (d) => `${sp(P, d.username)} joined the ${sp('eventEmpire', d.empire)}`,
  },
  player_destroyed: {
    icon: '\u{1F4A5}',
    format: (d) => {
      if (d.cause === 'self_destruct') return `${sp(P, d.victim)} self-destructed in ${sp(S, d.system_name)}`
      if (d.cause === 'police') return `${sp(P, d.victim)} was destroyed by police in ${sp(S, d.system_name)}`
      return d.killer
        ? `${sp(P, d.killer)} destroyed ${sp(P, d.victim)} in ${sp(S, d.system_name)}`
        : `${sp(P, d.victim)} was destroyed in ${sp(S, d.system_name)}`
    },
  },
  system_discovered: {
    icon: '\u{1F320}',
    format: (d) => `${sp(P, d.discoverer)} discovered ${sp(S, d.system_name)}`,
  },
  faction_created: {
    icon: '\u{1F3F3}',
    format: (d) => `${sp(P, d.leader)} created faction ${sp(F, `[${escapeHtml(d.faction_tag)}] ${escapeHtml(d.faction_name)}`)}`,
  },
  faction_war: {
    icon: '\u2694',
    format: (d) => `${sp(F, d.aggressor)} declared war on ${sp(F, d.defender)}`,
  },
  trade: {
    icon: '\u{1F4B0}',
    format: (d) => `${sp(P, d.seller)} sold ${escapeHtml(d.quantity)}x ${sp(I, d.item_name)} to ${sp(P, d.buyer)}`,
  },
  craft: {
    icon: '\u{1F527}',
    format: (d) => `${sp(P, d.crafter)} crafted ${sp(I, d.item_name)}`,
  },
  base_constructed: {
    icon: '\u{1F3D9}',
    format: (d) => `${sp(P, d.builder)} built ${sp(I, d.base_name)} in ${sp(S, d.system_name)}`,
  },
  base_destroyed: {
    icon: '\u{1F4A5}',
    format: (d) => d.attacker
      ? `${sp(P, d.attacker)} destroyed ${sp(I, d.base_name)}`
      : `${sp(I, d.base_name)} was destroyed`,
  },
  combat: {
    icon: '\u2694',
    format: (d) => d.winner
      ? `${sp(P, d.winner)} won combat vs ${sp(P, d.winner === d.attacker ? d.defender : d.attacker)}`
      : `${sp(P, d.attacker)} attacked ${sp(P, d.defender)}`,
  },
  weapon_fired: {
    icon: '\u{1F52B}',
    format: (d) => `${sp(P, d.attacker)} fired ${sp(I, d.weapon_name)} at ${sp(P, d.defender)} (${escapeHtml(d.damage)} dmg)`,
  },
  rare_loot: {
    icon: '\u{1F31F}',
    format: (d) => `${sp(P, d.player)} found ${sp(I, d.item_name)}`,
  },
  server_announcement: {
    icon: '\u{1F4E3}',
    format: (d) => `<strong>${escapeHtml(d.title)}</strong>: ${escapeHtml(d.message)}`,
  },
  tick: {
    icon: '\u23F1',
    format: (d) => `Tick ${escapeHtml(d.tick)}`,
  },
  connected: {
    icon: '\u{1F6F0}',
    format: (d) => `Connected to server (tick ${escapeHtml(d.tick)})`,
  },
  forum_post: {
    icon: '\u{1F4AC}',
    format: (d) => `${sp(P, d.author)} posted &quot;${sp(I, d.title)}&quot; in forum`,
  },
  travel: {
    icon: '\u{1F680}',
    format: (d) => `${sp(P, d.player)} traveled to ${sp(I, d.to_poi)} in ${sp(S, d.system_name)}`,
  },
  jump: {
    icon: '\u2B50',
    format: (d) => `${sp(P, d.player)} jumped to ${sp(S, d.to_system_name)}`,
  },
  chat: {
    icon: '\u{1F4AC}',
    format: (d) => {
      const location = d.poi_name || d.system_name || ''
      return `${sp(P, d.sender)} @ ${sp(S, location)}: ${escapeHtml(d.content)}`
    },
  },
  captains_log: {
    icon: '\u{1F4DD}',
    format: (d) => {
      const entry = String(d.entry || '')
      const truncated = entry.length > 80 ? entry.substring(0, 80) + '...' : entry
      return `${sp(P, d.player)} wrote in captain&apos;s log: &quot;${escapeHtml(truncated)}&quot;`
    },
  },
}

const eventTypeToStyleClass: Record<string, string> = {
  player_joined: styles.liveEventPlayerJoined,
  player_destroyed: styles.liveEventPlayerDestroyed,
  system_discovered: styles.liveEventSystemDiscovered,
  faction_created: styles.liveEventFactionCreated,
  travel: styles.liveEventTravel,
  jump: styles.liveEventJump,
  trade: styles.liveEventTrade,
  craft: styles.liveEventCraft,
  system: styles.liveEventSystem,
  combat: styles.liveEventCombat,
  weapon_fired: styles.liveEventWeaponFired,
  base_constructed: styles.liveEventBaseConstructed,
  base_destroyed: styles.liveEventBaseDestroyed,
  rare_loot: styles.liveEventRareLoot,
  server_announcement: styles.liveEventServerAnnouncement,
  connected: styles.liveEventConnected,
  tick: styles.liveEventTick,
  forum_post: styles.liveEventForumPost,
  chat: styles.liveEventChat,
  captains_log: styles.liveEventCaptainsLog,
}

const filterGroups: Record<string, string[] | null> = {
  all: null,
  chat: ['chat'],
  travel: ['travel', 'jump'],
  captains_log: ['captains_log'],
}

const locationExemptFilters = ['travel', 'captains_log']

interface LiveEventEntry {
  id: number
  type: string
  html: string
  icon: string
  time: string
  systemName: string
}

function formatTime(timestamp?: string) {
  const date = timestamp ? new Date(timestamp) : new Date()
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

let nextEventId = 0
const MAX_EVENTS = 50

// Inline styles for event text spans (matching original CSS)
const eventTextStyles = `
  [data-cls="eventPlayer"] { color: var(--plasma-cyan); font-weight: 500; }
  [data-cls="eventEmpire"] { color: var(--shell-orange); }
  [data-cls="eventSystem"] { color: var(--bio-green); }
  [data-cls="eventFaction"] { color: #9b59b6; }
  [data-cls="eventItem"] { color: #ffd700; }
`

export function LiveFeed() {
  const [events, setEvents] = useState<LiveEventEntry[]>([
    {
      id: -1,
      type: 'system',
      html: 'Waiting for events...',
      icon: '\u{1F6F0}',
      time: '',
      systemName: '',
    },
  ])
  const [isConnected, setIsConnected] = useState(false)
  const [statusText, setStatusText] = useState('Connecting...')
  const [activeTypeFilter, setActiveTypeFilter] = useState('all')
  const [activeSystem, setActiveSystem] = useState('')
  const [knownSystems, setKnownSystems] = useState<string[]>([])
  const feedRef = useRef<HTMLDivElement>(null)
  const knownSystemsRef = useRef(new Set<string>())

  const addEvent = useCallback((type: string, data: EventData, timestamp?: string) => {
    const config = eventConfig[type] || { icon: '\u{1F4C4}', format: (d: EventData) => JSON.stringify(d) }

    const locationExempt = ['travel', 'jump', 'captains_log'].includes(type)
    const systemName = locationExempt ? '' : String(data.system_name || data.to_system_name || data.poi_name || '')

    // Track system
    if (systemName && !knownSystemsRef.current.has(systemName)) {
      knownSystemsRef.current.add(systemName)
      setKnownSystems(Array.from(knownSystemsRef.current).sort())
    }

    const entry: LiveEventEntry = {
      id: nextEventId++,
      type,
      html: config.format(data),
      icon: config.icon,
      time: formatTime(timestamp),
      systemName,
    }

    setEvents((prev) => {
      // Remove placeholder
      const filtered = prev.filter((e) => e.id !== -1)
      const next = [entry, ...filtered]
      return next.slice(0, MAX_EVENTS)
    })
  }, [])

  useEffect(() => {
    let eventSource: EventSource | null = null

    function connect() {
      if (eventSource) {
        eventSource.close()
      }

      setStatusText('Connecting...')
      setIsConnected(false)

      eventSource = new EventSource('https://game.spacemolt.com/events')

      eventSource.onopen = () => {
        setStatusText('Connected')
        setIsConnected(true)
      }

      eventSource.onmessage = (event) => {
        try {
          const parsed: GameEvent = JSON.parse(event.data)
          if (parsed.type && parsed.data && parsed.type !== 'tick' && parsed.type !== 'player_stats') {
            addEvent(parsed.type, parsed.data, parsed.timestamp)
          }
        } catch {
          // ignore parse errors
        }
      }

      eventSource.onerror = () => {
        setStatusText('Reconnecting...')
        setIsConnected(false)

        setTimeout(() => {
          if (eventSource && eventSource.readyState === EventSource.CLOSED) {
            connect()
          }
        }, 5000)
      }
    }

    connect()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [addEvent])

  const isEventVisible = (event: LiveEventEntry) => {
    const allowedTypes = filterGroups[activeTypeFilter]
    const typeMatch = !allowedTypes || allowedTypes.includes(event.type)
    const systemMatch = !activeSystem || !event.systemName || event.systemName === activeSystem
    return typeMatch && systemMatch
  }

  const hideSystemFilter = locationExemptFilters.includes(activeTypeFilter)

  return (
    <div className={styles.liveFeedContainer}>
      {/* Inline styles for event text span coloring (data-cls attributes) */}
      <style>{eventTextStyles}</style>
      <div className={styles.liveFeedHeader}>
        <div className={styles.liveIndicator}>
          <span className={`${styles.liveDot} ${isConnected ? styles.liveDotConnected : ''}`} />
          <span className={`${styles.liveText} ${isConnected ? styles.liveTextConnected : ''}`}>LIVE</span>
        </div>
        <span className={styles.liveStatus}>{statusText}</span>
      </div>
      <div className={styles.liveFeedFilters}>
        <div className={styles.filterButtons}>
          {Object.keys(filterGroups).map((filter) => (
            <button
              key={filter}
              className={`${styles.filterBtn} ${activeTypeFilter === filter ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveTypeFilter(filter)}
            >
              {filter === 'all' ? 'All' : filter === 'chat' ? 'Chat' : filter === 'travel' ? 'Travel' : "Captain's Log"}
            </button>
          ))}
        </div>
        <div className={styles.filterSystem} style={{ display: hideSystemFilter ? 'none' : undefined }}>
          <select
            value={activeSystem}
            onChange={(e) => setActiveSystem(e.target.value)}
          >
            <option value="">All Systems</option>
            {knownSystems.map((sys) => (
              <option key={sys} value={sys}>{sys}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.liveFeed} ref={feedRef}>
        {events.map((event) => {
          const visible = isEventVisible(event)
          const typeClass = eventTypeToStyleClass[event.type] || ''
          return (
            <div
              key={event.id}
              className={`${styles.liveEvent} ${typeClass}`}
              style={{ display: visible ? undefined : 'none' }}
            >
              <span className={styles.eventIcon}>{event.icon}</span>
              {/* Event HTML contains only hardcoded span tags with escaped user data */}
              <span
                className={styles.eventText}
                dangerouslySetInnerHTML={{ __html: event.html }}
              />
              {event.time && <span className={styles.eventTime}>{event.time}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
