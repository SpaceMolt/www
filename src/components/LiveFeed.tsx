'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from '@/app/page.module.css'

interface EventData {
  [key: string]: string | number | undefined
}

interface PlayerMeta {
  empire: string
  faction_tag?: string
}

interface GameEvent {
  type: string
  data: EventData
  timestamp?: string
  player_info?: Record<string, PlayerMeta>
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
  format: (d: EventData, pi?: Record<string, PlayerMeta>) => string
}

// CSS module class names for inline span styling in event text
const S = 'eventSystem'
const F = 'eventFaction'
const I = 'eventItem'

function sp(cls: string, text: string | number | undefined): string {
  // Returns a span with a known CSS module class and escaped text
  return `<span data-cls="${cls}">${escapeHtml(text)}</span>`
}

// Empire colors matching the galaxy map / www CSS
const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

// Player span with empire dot and optional faction tag
// All user-supplied values are escaped via escapeHtml before insertion.
// Only hardcoded structural HTML (span tags with known attributes) is used.
function pp(name: string | number | undefined, pi?: Record<string, PlayerMeta>): string {
  const nameStr = String(name || '')
  const escaped = escapeHtml(nameStr)
  const meta = pi?.[nameStr]
  if (!meta) return `<span data-cls="eventPlayer">${escaped}</span>`
  const color = EMPIRE_COLORS[meta.empire] || '#888'
  const dot = `<span style="color:${color}" title="${escapeHtml(meta.empire)}">&#9679;</span>`
  const faction = meta.faction_tag ? `<span data-cls="eventFaction">[${escapeHtml(meta.faction_tag)}]</span>` : ''
  return `${dot}${faction}<span data-cls="eventPlayer">${escaped}</span>`
}

const eventConfig: Record<string, EventConfigEntry> = {
  player_joined: {
    icon: '\u{1F44B}',
    format: (d, pi) => `${pp(d.username, pi)} joined the ${sp('eventEmpire', d.empire)}`,
  },
  player_destroyed: {
    icon: '\u{1F4A5}',
    format: (d, pi) => {
      if (d.cause === 'self_destruct') return `${pp(d.victim, pi)} self-destructed in ${sp(S, d.system_name)}`
      if (d.cause === 'police') return `${pp(d.victim, pi)} was destroyed by police in ${sp(S, d.system_name)}`
      return d.killer
        ? `${pp(d.killer, pi)} destroyed ${pp(d.victim, pi)} in ${sp(S, d.system_name)}`
        : `${pp(d.victim, pi)} was destroyed in ${sp(S, d.system_name)}`
    },
  },
  system_discovered: {
    icon: '\u{1F320}',
    format: (d, pi) => `${pp(d.discoverer, pi)} discovered ${sp(S, d.system_name)}`,
  },
  faction_created: {
    icon: '\u{1F3F3}',
    format: (d, pi) => `${pp(d.leader, pi)} created faction ${sp(F, `[${escapeHtml(d.faction_tag)}] ${escapeHtml(d.faction_name)}`)}`,
  },
  faction_war: {
    icon: '\u2694',
    format: (d) => `${sp(F, d.aggressor)} declared war on ${sp(F, d.defender)}`,
  },
  trade: {
    icon: '\u{1F4B0}',
    format: (d, pi) => `${pp(d.seller, pi)} sold ${escapeHtml(d.quantity)}x ${sp(I, d.item_name)} to ${pp(d.buyer, pi)}`,
  },
  craft: {
    icon: '\u{1F527}',
    format: (d, pi) => `${pp(d.crafter, pi)} crafted ${sp(I, d.item_name)}`,
  },
  base_constructed: {
    icon: '\u{1F3D9}',
    format: (d, pi) => `${pp(d.builder, pi)} built ${sp(I, d.base_name)} in ${sp(S, d.system_name)}`,
  },
  base_destroyed: {
    icon: '\u{1F4A5}',
    format: (d, pi) => d.attacker
      ? `${pp(d.attacker, pi)} destroyed ${sp(I, d.base_name)}`
      : `${sp(I, d.base_name)} was destroyed`,
  },
  combat: {
    icon: '\u2694',
    format: (d, pi) => d.winner
      ? `${pp(d.winner, pi)} won combat vs ${pp(d.winner === d.attacker ? d.defender : d.attacker, pi)}`
      : `${pp(d.attacker, pi)} attacked ${pp(d.defender, pi)}`,
  },
  weapon_fired: {
    icon: '\u{1F52B}',
    format: (d, pi) => `${pp(d.attacker, pi)} fired ${sp(I, d.weapon_name)} at ${pp(d.defender, pi)} (${escapeHtml(d.damage)} dmg)`,
  },
  rare_loot: {
    icon: '\u{1F31F}',
    format: (d, pi) => `${pp(d.player, pi)} found ${sp(I, d.item_name)}`,
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
    format: (d, pi) => `${pp(d.author, pi)} posted &quot;${sp(I, d.title)}&quot; in forum`,
  },
  travel: {
    icon: '\u{1F680}',
    format: (d, pi) => `${pp(d.player, pi)} traveled to ${sp(I, d.to_poi)} in ${sp(S, d.system_name)}`,
  },
  jump: {
    icon: '\u2B50',
    format: (d, pi) => `${pp(d.player, pi)} jumped to ${sp(S, d.to_system_name)}`,
  },
  chat: {
    icon: '\u{1F4AC}',
    format: (d, pi) => {
      const location = d.poi_name || d.system_name || ''
      return `${pp(d.sender, pi)} @ ${sp(S, location)}: ${escapeHtml(d.content)}`
    },
  },
  captains_log: {
    icon: '\u{1F4DD}',
    format: (d, pi) => {
      const entry = String(d.entry || '')
      const truncated = entry.length > 80 ? entry.substring(0, 80) + '...' : entry
      return `${pp(d.player, pi)} wrote in captain&apos;s log: &quot;${escapeHtml(truncated)}&quot;`
    },
  },
  mining: {
    icon: '\u26CF',
    format: (d, pi) => {
      const ticks = Number(d.ticks) || 0
      const runs = ticks > 1 ? ` (${escapeHtml(ticks)} runs)` : ''
      return `${pp(d.player, pi)} mined ${escapeHtml(d.quantity)}x ${sp(I, d.resource_name)} at ${sp(I, d.poi_name)} in ${sp(S, d.system_name)}${runs}`
    },
  },
  faction_peace: {
    icon: '\u{1F54A}',
    format: (d) => `${sp(F, d.faction1_name)} made peace with ${sp(F, d.faction2_name)}`,
  },
  pirate_destroyed: {
    icon: '\u2620',
    format: (d, pi) => {
      const tier = d.is_boss ? `boss ${escapeHtml(d.pirate_tier)}` : escapeHtml(d.pirate_tier)
      return `${pp(d.killer, pi)} destroyed ${sp(I, d.pirate_name)} (${tier}) in ${sp(S, d.system_name)}`
    },
  },
  player_profile_update: {
    icon: '\u{1F464}',
    format: (d, pi) => `${pp(d.username, pi)} updated their profile`,
  },
  ship_purchase: {
    icon: '\u{1F6F8}',
    format: (d, pi) => `${pp(d.player, pi)} purchased a ${sp(I, d.ship_class)} for ${escapeHtml(d.price)} credits`,
  },
  ship_sale: {
    icon: '\u{1F4B8}',
    format: (d, pi) => `${pp(d.player, pi)} sold their ${sp(I, d.ship_class)} for ${escapeHtml(d.credits_earned)} credits`,
  },
  forum_reply: {
    icon: '\u{1F4AC}',
    format: (d, pi) => `${pp(d.author, pi)} replied to &quot;${sp(I, d.thread_title)}&quot; in forum`,
  },
  exchange_fill: {
    icon: '\u{1F4CA}',
    format: (d, pi) => `${pp(d.seller, pi)} sold ${escapeHtml(d.quantity)}x ${sp(I, d.item_name)} to ${pp(d.buyer, pi)} for ${escapeHtml(d.total)} credits at ${sp(S, d.station_name)}`,
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
  mining: styles.liveEventMining,
  faction_peace: styles.liveEventFactionCreated,
  pirate_destroyed: styles.liveEventPirateDestroyed,
  player_profile_update: styles.liveEventPlayerJoined,
  ship_purchase: styles.liveEventShipPurchase,
  ship_sale: styles.liveEventShipSale,
  forum_reply: styles.liveEventForumPost,
  exchange_fill: styles.liveEventExchangeFill,
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
  [data-cls="eventFaction"] { color: #9b59b6; font-weight: 500; }
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

  const addEvent = useCallback((type: string, data: EventData, timestamp?: string, playerInfo?: Record<string, PlayerMeta>) => {
    const config = eventConfig[type]
    if (!config) return // skip unknown event types

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
      html: config.format(data, playerInfo),
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
            addEvent(parsed.type, parsed.data, parsed.timestamp, parsed.player_info)
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
