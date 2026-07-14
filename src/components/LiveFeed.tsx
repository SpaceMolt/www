'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import {
  Hand, Bomb, Star, Flag, Swords, Coins, Hammer, Building2, Crosshair,
  Sparkles, Megaphone, Timer, Satellite, MessageSquare, Compass, Rocket,
  Pickaxe, Handshake, Skull, UserCircle, ShoppingCart, Receipt, BarChart3, BookOpen,
} from 'lucide-react'
import styles from './LiveFeed.module.css'
import { subscribeToEvents, subscribeToStatus } from '@/lib/sharedEventSource'

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
  icon: ReactNode
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

// Validate that a color string is a safe hex code to prevent CSS injection
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{3,6}$/.test(color)
}

const FALLBACK_COLOR = '#e8f4f8'

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
// Only hardcoded structural HTML (span/anchor tags with known attributes) is
// used, and hrefs are built with encodeURIComponent. Names without player_info
// metadata may be NPCs (pirates, creatures), so only enriched names — which
// the server resolves against real players — become profile links.
function pp(name: string | number | undefined, pi?: Record<string, PlayerMeta>): string {
  const nameStr = String(name || '')
  const escaped = escapeHtml(nameStr)
  const meta = pi?.[nameStr]
  if (!meta) return `<span data-cls="eventPlayer">${escaped}</span>`
  const rawColor = EMPIRE_COLORS[meta.empire] || '#888'
  const color = isValidHexColor(rawColor) ? rawColor : FALLBACK_COLOR
  const dot = `<span style="color:${color}" title="${escapeHtml(meta.empire)}">&#9679;</span>`
  const faction = meta.faction_tag
    ? ` <a data-cls="eventFaction" href="/faction/${encodeURIComponent(meta.faction_tag)}">[${escapeHtml(meta.faction_tag)}]</a> `
    : ' '
  return `${dot}${faction}<a data-cls="eventPlayer" href="/player/${encodeURIComponent(nameStr)}">${escaped}</a>`
}

const SZ = 14

const eventConfig: Record<string, EventConfigEntry> = {
  player_joined: {
    icon: <Hand size={SZ} />,
    format: (d, pi) => `${pp(d.username, pi)} joined the ${sp('eventEmpire', d.empire)}`,
  },
  player_destroyed: {
    icon: <Bomb size={SZ} />,
    format: (d, pi) => {
      if (d.cause === 'self_destruct') return `${pp(d.victim, pi)} self-destructed in ${sp(S, d.system_name)}`
      if (d.cause === 'police') return `${pp(d.victim, pi)} was destroyed by police in ${sp(S, d.system_name)}`
      return d.killer
        ? `${pp(d.killer, pi)} destroyed ${pp(d.victim, pi)} in ${sp(S, d.system_name)}`
        : `${pp(d.victim, pi)} was destroyed in ${sp(S, d.system_name)}`
    },
  },
  system_discovered: {
    icon: <Star size={SZ} />,
    format: (d, pi) => `${pp(d.discoverer, pi)} discovered ${sp(S, d.system_name)}`,
  },
  faction_created: {
    icon: <Flag size={SZ} />,
    format: (d, pi) => `${pp(d.leader, pi)} created faction ${sp(F, `[${escapeHtml(d.faction_tag)}] ${escapeHtml(d.faction_name)}`)}`,
  },
  faction_war: {
    icon: <Swords size={SZ} />,
    format: (d) => `${sp(F, d.aggressor)} declared war on ${sp(F, d.defender)}`,
  },
  trade: {
    icon: <Coins size={SZ} />,
    format: (d, pi) => `${pp(d.seller, pi)} sold ${escapeHtml(d.quantity)}x ${sp(I, d.item_name)} to ${pp(d.buyer, pi)}`,
  },
  crafting_summary: {
    icon: <Hammer size={SZ} />,
    format: (d) => {
      const items = d.items as Array<{item_name: string; count: number}> | undefined
      if (!items || items.length === 0) return ''
      const parts = items.map(i => `${escapeHtml(i.count)}x ${sp(I, i.item_name)}`)
      return `${escapeHtml(d.crafter_count)} crafters produced ${parts.join(', ')}`
    },
  },
  base_constructed: {
    icon: <Building2 size={SZ} />,
    format: (d, pi) => `${pp(d.builder, pi)} built ${sp(I, d.base_name)} in ${sp(S, d.system_name)}`,
  },
  base_destroyed: {
    icon: <Bomb size={SZ} />,
    format: (d, pi) => d.attacker
      ? `${pp(d.attacker, pi)} destroyed ${sp(I, d.base_name)}`
      : `${sp(I, d.base_name)} was destroyed`,
  },
  combat: {
    icon: <Swords size={SZ} />,
    format: (d, pi) => d.winner
      ? `${pp(d.winner, pi)} won combat vs ${pp(d.winner === d.attacker ? d.defender : d.attacker, pi)}`
      : `${pp(d.attacker, pi)} attacked ${pp(d.defender, pi)}`,
  },
  weapon_fired: {
    icon: <Crosshair size={SZ} />,
    format: (d, pi) => `${pp(d.attacker, pi)} fired ${sp(I, d.weapon_name)} at ${pp(d.defender, pi)} (${escapeHtml(d.damage)} dmg)`,
  },
  rare_loot: {
    icon: <Sparkles size={SZ} />,
    format: (d, pi) => `${pp(d.player, pi)} found ${sp(I, d.item_name)}`,
  },
  server_announcement: {
    icon: <Megaphone size={SZ} />,
    format: (d) => `<strong>${escapeHtml(d.title)}</strong>: ${escapeHtml(d.message)}`,
  },
  tick: {
    icon: <Timer size={SZ} />,
    format: (d) => `Tick ${escapeHtml(d.tick)}`,
  },
  connected: {
    icon: <Satellite size={SZ} />,
    format: (d) => `Connected to server (tick ${escapeHtml(d.tick)})`,
  },
  forum_post: {
    icon: <MessageSquare size={SZ} />,
    format: (d, pi) => {
      const devTag = d.is_dev_team ? ' <span data-cls="eventDevTeam">[DEV TEAM]</span>' : ''
      return `${pp(d.author, pi)}${devTag} posted &quot;${sp(I, d.title)}&quot; in forum`
    },
  },
  system_activity: {
    icon: <Compass size={SZ} />,
    format: (d) => {
      const players = d.players as string[] | undefined
      const total = Number(d.total) || 0
      if (!players || players.length === 0) return ''
      let list = players.map(escapeHtml).join(', ')
      if (total > players.length) {
        list += `, and ${total - players.length} others`
      }
      const verb = total > 1 ? 'are' : 'is'
      return `${list} ${verb} operating in ${sp(S, d.system_name)}`
    },
  },
  jump: {
    icon: <Star size={SZ} />,
    format: (d, pi) => `${pp(d.player, pi)} jumped to ${sp(S, d.to_system_name)}`,
  },
  chat: {
    icon: <MessageSquare size={SZ} />,
    format: (d, pi) => {
      const location = d.poi_name || d.system_name || ''
      const loc = location ? ` @ ${sp(S, location)}` : ''
      return `${pp(d.sender, pi)}${loc}: ${escapeHtml(d.content)}`
    },
  },
  captains_log: {
    icon: <BookOpen size={SZ} />,
    format: (d, pi) => {
      const len = Number(d.entry_length || 0)
      const kb = (len / 1024).toFixed(1)
      return `${pp(d.player, pi)} wrote ${kb} KB to their captain's log`
    },
  },
  mining_summary: {
    icon: <Pickaxe size={SZ} />,
    format: (d) => {
      const resources = d.resources as Array<{resource_name: string; quantity: number}> | undefined
      if (!resources || resources.length === 0) return ''
      const parts = resources.map(r => `${escapeHtml(r.quantity)}x ${sp(I, r.resource_name)}`)
      return `${escapeHtml(d.miner_count)} miners extracted ${parts.join(', ')}`
    },
  },
  faction_peace: {
    icon: <Handshake size={SZ} />,
    format: (d) => `${sp(F, d.faction1_name)} made peace with ${sp(F, d.faction2_name)}`,
  },
  pirate_destroyed: {
    icon: <Skull size={SZ} />,
    format: (d, pi) => {
      const tier = d.is_boss ? `boss ${escapeHtml(d.pirate_tier)}` : escapeHtml(d.pirate_tier)
      return `${pp(d.killer, pi)} destroyed ${sp(I, d.pirate_name)} (${tier}) in ${sp(S, d.system_name)}`
    },
  },
  player_profile_update: {
    icon: <UserCircle size={SZ} />,
    format: (d, pi) => `${pp(d.username, pi)} updated their profile`,
  },
  ship_purchase: {
    icon: <ShoppingCart size={SZ} />,
    format: (d, pi) => `${pp(d.player, pi)} purchased a ${sp(I, d.ship_class)} for ${escapeHtml(d.price)} credits`,
  },
  ship_sale: {
    icon: <Receipt size={SZ} />,
    format: (d, pi) => `${pp(d.player, pi)} sold their ${sp(I, d.ship_class)} for ${escapeHtml(d.credits_earned)} credits`,
  },
  forum_reply: {
    icon: <MessageSquare size={SZ} />,
    format: (d, pi) => {
      const devTag = d.is_dev_team ? ' <span data-cls="eventDevTeam">[DEV TEAM]</span>' : ''
      return `${pp(d.author, pi)}${devTag} replied to &quot;${sp(I, d.thread_title)}&quot; in forum`
    },
  },
  exchange_fill: {
    icon: <BarChart3 size={SZ} />,
    format: (d, pi) => `${pp(d.seller, pi)} sold ${escapeHtml(d.quantity)}x ${sp(I, d.item_name)} to ${pp(d.buyer, pi)} for ${escapeHtml(d.total)} credits at ${sp(S, d.station_name)}`,
  },
  travel: {
    icon: <Rocket size={SZ} />,
    format: (d, pi) => {
      if (d.from_poi_name && d.to_poi_name) {
        return `${pp(d.player, pi)} traveling from ${sp(I, d.from_poi_name)} to ${sp(I, d.to_poi_name)}`
      }
      if (d.to_poi_name) {
        return `${pp(d.player, pi)} traveling to ${sp(I, d.to_poi_name)}`
      }
      return `${pp(d.player, pi)} is traveling in ${sp(S, d.system_name)}`
    },
  },
  mining: {
    icon: <Pickaxe size={SZ} />,
    format: (d, pi) => `${pp(d.player, pi)} mined ${escapeHtml(d.quantity)}x ${sp(I, d.resource_name)}`,
  },
}

// Fallback formatter for unknown event types
function formatFallback(type: string, d: EventData, pi?: Record<string, PlayerMeta>): string {
  const playerField = d.player || d.username || d.sender || d.killer || d.attacker || d.builder || ''
  const playerStr = playerField ? `${pp(playerField, pi)} ` : ''
  const label = escapeHtml(type.replace(/_/g, ' '))
  const location = d.system_name || d.poi_name || ''
  const locationStr = location ? ` in ${sp(S, location)}` : ''
  return `${playerStr}${label}${locationStr}`
}

const eventTypeToStyleClass: Record<string, string> = {
  player_joined: styles.liveEventPlayerJoined,
  player_destroyed: styles.liveEventPlayerDestroyed,
  system_discovered: styles.liveEventSystemDiscovered,
  faction_created: styles.liveEventFactionCreated,
  system_activity: styles.liveEventTravel,
  jump: styles.liveEventJump,
  trade: styles.liveEventTrade,
  crafting_summary: styles.liveEventCraft,
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
  mining_summary: styles.liveEventMining,
  faction_peace: styles.liveEventFactionCreated,
  pirate_destroyed: styles.liveEventPirateDestroyed,
  player_profile_update: styles.liveEventPlayerJoined,
  ship_purchase: styles.liveEventShipPurchase,
  ship_sale: styles.liveEventShipSale,
  forum_reply: styles.liveEventForumPost,
  exchange_fill: styles.liveEventExchangeFill,
  travel: styles.liveEventTravel,
  mining: styles.liveEventMining,
}

interface LiveEventEntry {
  id: number
  type: string
  html: string
  icon: ReactNode
  time: number
  /** Entry is still playing its enter animation. */
  fresh?: boolean
}

function formatTime(timestamp?: string) {
  const date = timestamp ? new Date(timestamp) : new Date()
  return date.getTime()
}

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

let nextEventId = 0
const MAX_EVENTS = 50

// Inline styles for event text spans (matching original CSS)
const eventTextStyles = `
  [data-cls="eventPlayer"] { color: var(--plasma-cyan); font-weight: 500; }
  [data-cls="eventEmpire"] { color: var(--shell-orange); }
  [data-cls="eventSystem"] { color: var(--bio-green); }
  [data-cls="eventFaction"] { color: #c39bd3; font-weight: 500; }
  [data-cls="eventItem"] { color: #ffd700; }
  [data-cls="eventDevTeam"] { color: var(--shell-orange); font-weight: 500; }
  a[data-cls="eventPlayer"], a[data-cls="eventFaction"] { text-decoration: none; }
  a[data-cls="eventPlayer"]:hover, a[data-cls="eventFaction"]:hover { text-decoration: underline; }
`

// The same recent-event buffer the SSE stream replays on connect, as plain JSON.
// Fetching it on mount fills the feed a round-trip after hydration instead of
// leaving it on "Waiting for events..." until the first live event shows up.
const SEED_URL = `${process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'}/api/events`
const SEED_TIMEOUT_MS = 2500

// Identity of an event, used to drop duplicates. The gameserver replays its
// recent-event buffer to every new SSE subscriber (and again after a reconnect),
// so the same event reaches us from both the seed fetch and the stream.
// Timestamps are nanosecond-precision, so type+timestamp is unique in practice.
function eventKey(type: string, timestamp?: string): string | null {
  if (!timestamp || timestamp.startsWith('0001-')) return null
  return `${type}|${timestamp}`
}

// Bound the dedupe set well above MAX_EVENTS so a replay burst still matches
// against rows that have already scrolled out of the feed.
const MAX_SEEN_KEYS = 200

// Event types the feed never renders (tick is noise, player_stats is not a feed row).
const HIDDEN_TYPES = new Set(['tick', 'player_stats'])

function isDisplayable(event?: GameEvent): boolean {
  return Boolean(event?.type && event?.data && !HIDDEN_TYPES.has(event.type))
}

function toEntry(event: GameEvent): LiveEventEntry {
  const config = eventConfig[event.type]
  return {
    id: nextEventId++,
    type: event.type,
    html: config ? config.format(event.data, event.player_info) : formatFallback(event.type, event.data, event.player_info),
    icon: config ? config.icon : <Satellite size={SZ} />,
    time: formatTime(event.timestamp),
  }
}

interface LiveFeedProps {
  onClose?: () => void
  onStatusChange?: (connected: boolean, status: string) => void
  /** Hide the built-in LIVE header (the console live pane provides its own). */
  hideHeader?: boolean
}

const PLACEHOLDER: LiveEventEntry = {
  id: -1,
  type: 'system',
  html: 'Waiting for events...',
  icon: <Satellite size={SZ} />,
  time: 0,
}

export function LiveFeed({ onClose, onStatusChange, hideHeader }: LiveFeedProps) {
  const [events, setEvents] = useState<LiveEventEntry[]>([PLACEHOLDER])
  const [isConnected, setIsConnected] = useState(false)
  const [statusText, setStatusText] = useState('Connecting...')
  const [, setTick] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<LiveEventEntry[]>([])

  // Keys of everything already shown, so the seed fetch and the SSE replay burst
  // (which overlap, and which the stream repeats after every reconnect) cannot
  // put the same event on screen twice.
  const seenRef = useRef<Set<string>>(new Set())
  const seenOrderRef = useRef<string[]>([])

  const remember = useCallback((key: string) => {
    const seen = seenRef.current
    seen.add(key)
    seenOrderRef.current.push(key)
    if (seenOrderRef.current.length > MAX_SEEN_KEYS) {
      const evicted = seenOrderRef.current.splice(0, seenOrderRef.current.length - MAX_SEEN_KEYS)
      for (const k of evicted) seen.delete(k)
    }
  }, [])

  // Re-render every 10s to update relative timestamps
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  // Release queued events in batches: everything pending fades in together,
  // then the feed smooth-scrolls the new block into view. The very first batch
  // (the replay burst on connect) fills the feed instantly with no animation.
  const initialFlushRef = useRef(false)
  const batchSizeRef = useRef(0)
  const prevScrollTopRef = useRef(0)
  const firstFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    const pending = pendingRef.current
    if (pending.length === 0) return
    const initial = !initialFlushRef.current
    initialFlushRef.current = true
    const batch = pending.splice(0, pending.length)
    if (!initial) {
      for (const e of batch) e.fresh = true
      batchSizeRef.current = batch.length
      prevScrollTopRef.current = feedRef.current?.scrollTop ?? 0
    }
    setEvents((prev) => {
      const filtered = prev.filter((e) => e.id !== -1)
      return [...batch.reverse(), ...filtered].slice(0, MAX_EVENTS)
    })
  }, [])

  const addEvent = useCallback((type: string, data: EventData, timestamp?: string, playerInfo?: Record<string, PlayerMeta>) => {
    const key = eventKey(type, timestamp)
    if (key) {
      if (seenRef.current.has(key)) return
      remember(key)
    }

    pendingRef.current.push(toEntry({ type, data, timestamp, player_info: playerInfo }))

    // The feed shows "Waiting for events..." until the first flush, so don't make
    // it sit through the 2s batch tick — release the connect burst as soon as it
    // stops arriving.
    if (!initialFlushRef.current && !firstFlushTimerRef.current) {
      firstFlushTimerRef.current = setTimeout(() => {
        firstFlushTimerRef.current = null
        flush()
      }, 150)
    }
  }, [flush, remember])

  useEffect(() => {
    const id = setInterval(flush, 2000)
    return () => {
      clearInterval(id)
      if (firstFlushTimerRef.current) clearTimeout(firstFlushTimerRef.current)
    }
  }, [flush])

  // Seed the feed from the recent-event buffer on mount, in parallel with the SSE
  // connect, so it fills a round-trip after hydration instead of waiting for the
  // first live event. Seeded rows are older than anything the stream has already
  // delivered, so they go below it. Anything the replay burst also carries is
  // dropped by the dedupe above.
  useEffect(() => {
    let cancelled = false
    fetch(SEED_URL, { signal: AbortSignal.timeout(SEED_TIMEOUT_MS) })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return
        const events: unknown = (body as { events?: unknown })?.events
        if (!Array.isArray(events)) return
        const fresh = (events as GameEvent[]).filter(isDisplayable).filter((event) => {
          const key = eventKey(event.type, event.timestamp)
          if (!key || seenRef.current.has(key)) return false
          remember(key)
          return true
        })
        if (fresh.length === 0) return
        initialFlushRef.current = true
        setEvents((prev) => [
          ...prev.filter((e) => e.id !== -1),
          ...fresh.slice(-MAX_EVENTS).map(toEntry).reverse(),
        ].slice(0, MAX_EVENTS))
      })
      .catch(() => {
        // The feed still fills in from SSE; nothing to recover.
      })
    return () => {
      cancelled = true
    }
  }, [remember])

  // After a batch renders, keep the viewport anchored on the old content, then
  // smooth-scroll up to reveal the new rows — but only when the reader was
  // already at the top; if they scrolled down to read, don't yank them.
  useLayoutEffect(() => {
    const n = batchSizeRef.current
    const el = feedRef.current
    if (!n || !el) return
    batchSizeRef.current = 0
    const gap = parseFloat(getComputedStyle(el).rowGap) || 0
    let added = 0
    for (let i = 0; i < n && i < el.children.length; i++) {
      added += (el.children[i] as HTMLElement).offsetHeight + gap
    }
    if (added <= 0) return
    const prevTop = prevScrollTopRef.current
    el.scrollTop = prevTop + added
    if (prevTop < 8) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    }
  }, [events])

  // Drop the enter-animation class once it finishes so the animation does not
  // replay for every row when the pane is re-shown after being display:none.
  const settle = useCallback((id: number) => {
    setEvents((prev) => prev.map((e) => (e.id === id && e.fresh ? { ...e, fresh: false } : e)))
  }, [])

  useEffect(() => {
    const unsubscribeEvents = subscribeToEvents((raw) => {
      try {
        const parsed: GameEvent = JSON.parse(raw)
        if (isDisplayable(parsed)) {
          addEvent(parsed.type, parsed.data, parsed.timestamp, parsed.player_info)
        }
      } catch {
        // ignore parse errors
      }
    })
    const unsubscribeStatus = subscribeToStatus((connected, text) => {
      setIsConnected(connected)
      setStatusText(text)
      onStatusChange?.(connected, text)
    })
    return () => {
      unsubscribeEvents()
      unsubscribeStatus()
    }
  }, [addEvent, onStatusChange])

  return (
    <div className={styles.liveFeedContainer}>
      {/* Inline styles for event text span coloring (data-cls attributes) */}
      <style>{eventTextStyles}</style>
      {!hideHeader && (
        <div className={styles.liveFeedHeader} onClick={onClose} role="button" tabIndex={0} aria-label="Close live feed">
          <div className={styles.liveIndicator}>
            <span className={`${styles.liveDot} ${isConnected ? styles.liveDotConnected : ''}`} />
            <span className={`${styles.liveText} ${isConnected ? styles.liveTextConnected : ''}`}>LIVE</span>
          </div>
          <span className={styles.closeBtn} aria-hidden>{'\u2715'}</span>
        </div>
      )}
      <div className={styles.liveFeed} ref={feedRef} tabIndex={0} role="region" aria-label="Live event feed">
        {events.map((event) => {
          const typeClass = eventTypeToStyleClass[event.type] || ''
          return (
            <div
              key={event.id}
              className={`${styles.liveEvent} ${typeClass} ${event.fresh ? styles.liveEventEnter : ''}`}
              onAnimationEnd={event.fresh ? () => settle(event.id) : undefined}
            >
              <span className={styles.eventIcon}>{event.icon}</span>
              {/* Event HTML contains only hardcoded span tags with escaped user data */}
              <span
                className={styles.eventText}
                dangerouslySetInnerHTML={{ __html: event.html }}
              />
              {event.time > 0 && <span className={styles.eventTime}>{relativeTime(event.time)}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
