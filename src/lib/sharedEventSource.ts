// Shared SSE connection to the gameserver `/events` feed.
//
// The gameserver rate-limits SSE connections to a small number per IP. The site
// previously opened a separate EventSource per component (LiveFeed, GalaxyMap,
// MarketTicker) and per browser tab, so a user with a few tabs open could
// exhaust the limit and get "Too many SSE connections from your IP."
//
// This module collapses all of that into a single connection per browser:
//   - Within a tab, every subscriber shares one EventSource.
//   - Across tabs, a Web Locks leader election picks one tab to hold the real
//     EventSource; it relays events to the other tabs over a BroadcastChannel.
//
// Subscribers receive the raw `event.data` string and parse/filter it
// themselves, matching the previous per-component behaviour.

const EVENTS_URL = `${process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'}/events`
const CHANNEL_NAME = 'spacemolt-events'
const LEADER_LOCK = 'spacemolt-sse-leader'
const RECONNECT_DELAY = 5000

type EventListener = (data: string) => void
type StatusListener = (connected: boolean, text: string) => void

type ChannelMessage =
  | { t: 'event'; d: string }
  | { t: 'status'; connected: boolean; text: string }

const eventListeners = new Set<EventListener>()
const statusListeners = new Set<StatusListener>()

let started = false
let channel: BroadcastChannel | null = null
let source: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

let connected = false
let statusText = 'Connecting...'

function notifyStatus(isConnected: boolean, text: string) {
  connected = isConnected
  statusText = text
  for (const listener of statusListeners) {
    try {
      listener(isConnected, text)
    } catch {
      // a misbehaving listener must not break the others
    }
  }
}

function setStatus(isConnected: boolean, text: string) {
  if (isConnected === connected && text === statusText) return
  notifyStatus(isConnected, text)
  channel?.postMessage({ t: 'status', connected: isConnected, text } satisfies ChannelMessage)
}

function deliverEvent(data: string) {
  // Receiving traffic means we're connected, even on a follower tab that never
  // observed the leader's "open" status broadcast.
  if (!connected) notifyStatus(true, 'Connected')
  for (const listener of eventListeners) {
    try {
      listener(data)
    } catch {
      // ignore parse/handler errors in individual subscribers
    }
  }
}

function emitEvent(data: string) {
  deliverEvent(data)
  channel?.postMessage({ t: 'event', d: data } satisfies ChannelMessage)
}

function connectAsLeader() {
  if (source) source.close()
  setStatus(false, 'Connecting...')

  source = new EventSource(EVENTS_URL)
  source.onopen = () => setStatus(true, 'Connected')
  source.onmessage = (event) => emitEvent(event.data)
  source.onerror = () => {
    setStatus(false, 'Reconnecting...')
    if (source) {
      source.close()
      source = null
    }
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connectAsLeader, RECONNECT_DELAY)
  }
}

function ensureStarted() {
  if (started || typeof window === 'undefined') return
  started = true

  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const msg = event.data
      if (msg.t === 'event') {
        deliverEvent(msg.d)
      } else {
        notifyStatus(msg.connected, msg.text)
      }
    }
  }

  // With Web Locks, exactly one tab holds the leader lock at a time. The lock is
  // held for the tab's lifetime (the callback returns a never-resolving
  // promise); when the leader tab closes, a waiting tab acquires it and takes
  // over the connection. Tabs without the lock rely on the BroadcastChannel.
  if (channel && 'locks' in navigator) {
    navigator.locks
      .request(LEADER_LOCK, () => {
        connectAsLeader()
        return new Promise<void>(() => {})
      })
      .catch(() => {
        // Lock acquisition failed unexpectedly — fall back to a direct
        // connection so this tab still receives events.
        connectAsLeader()
      })
  } else {
    // No cross-tab coordination available: open a direct connection. Components
    // within this tab still share it, so we never open more than one per tab.
    connectAsLeader()
  }
}

/** Subscribe to raw SSE event payloads. Returns an unsubscribe function. */
export function subscribeToEvents(listener: EventListener): () => void {
  ensureStarted()
  eventListeners.add(listener)
  return () => {
    eventListeners.delete(listener)
  }
}

/**
 * Subscribe to connection status changes. The listener is called immediately
 * with the current status. Returns an unsubscribe function.
 */
export function subscribeToStatus(listener: StatusListener): () => void {
  ensureStarted()
  statusListeners.add(listener)
  listener(connected, statusText)
  return () => {
    statusListeners.delete(listener)
  }
}
