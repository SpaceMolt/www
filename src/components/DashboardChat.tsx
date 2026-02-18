'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import styles from './DashboardChat.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface ChatMessage {
  id: string
  channel: string
  sender_id: string
  sender: string
  content: string
  timestamp: string
  target_id?: string
  target_name?: string
}

interface ChatResponse {
  messages: ChatMessage[]
  channel: string
  faction_name?: string
  has_more: boolean
}

interface PlayerInfo {
  id: string
  username: string
  faction_id?: string
  faction_name?: string
  current_poi?: string
}

interface DashboardChatProps {
  players: PlayerInfo[]
  selectedPlayer: string | null
  authHeaders: () => Promise<Record<string, string>>
}

type TabSelection =
  | { type: 'player'; playerId: string; channel: 'private' | 'local' }
  | { type: 'faction'; factionId: string; playerId: string }

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC'
  } catch {
    return iso
  }
}

export function DashboardChat({ players, selectedPlayer, authHeaders }: DashboardChatProps) {
  const [tab, setTab] = useState<TabSelection | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const messageListRef = useRef<HTMLDivElement>(null)

  // Deduplicate factions
  const factions: { id: string; name: string; playerId: string }[] = []
  const seenFactions = new Set<string>()
  for (const p of players) {
    if (p.faction_id && !seenFactions.has(p.faction_id)) {
      seenFactions.add(p.faction_id)
      factions.push({ id: p.faction_id, name: p.faction_name || p.faction_id, playerId: p.id })
    }
  }

  // Initialize tab to selected player or first available
  useEffect(() => {
    if (tab) return
    const target = selectedPlayer || players[0]?.id
    if (target) {
      setTab({ type: 'player', playerId: target, channel: 'private' })
    }
  }, [tab, selectedPlayer, players])

  // When selectedPlayer changes from the parent selector, switch to that player's tab
  useEffect(() => {
    if (selectedPlayer && tab?.type === 'player' && tab.playerId !== selectedPlayer) {
      setTab({ type: 'player', playerId: selectedPlayer, channel: tab.channel })
    }
  }, [selectedPlayer]) // eslint-disable-line react-hooks/exhaustive-deps

  const activePlayerId = tab?.type === 'faction' ? tab.playerId : tab?.type === 'player' ? tab.playerId : null
  const activeChannel = tab?.type === 'faction' ? 'faction' : tab?.type === 'player' ? tab.channel : null

  const fetchMessages = useCallback(async (before?: string) => {
    if (!activePlayerId || !activeChannel) return

    const isLoadMore = !!before
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setMessages([])
    }

    try {
      const headers = await authHeaders()
      const params = new URLSearchParams({ channel: activeChannel, limit: '50' })
      if (before) params.set('before', before)

      const res = await fetch(`${GAME_SERVER}/api/player/${activePlayerId}/chat?${params}`, {
        headers,
      })

      if (res.ok) {
        const data: ChatResponse = await res.json()
        if (isLoadMore) {
          setMessages(prev => [...prev, ...data.messages])
        } else {
          setMessages(data.messages)
        }
        setHasMore(data.has_more)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activePlayerId, activeChannel, authHeaders])

  useEffect(() => {
    if (tab) fetchMessages()
  }, [fetchMessages, tab])

  const handleLoadMore = () => {
    if (messages.length === 0 || loadingMore) return
    const oldest = messages[messages.length - 1]
    fetchMessages(oldest.timestamp)
  }

  if (players.length === 0) {
    return (
      <div className={styles.emptyChat}>
        <MessageSquare size={32} />
        <p>No players linked yet.</p>
      </div>
    )
  }

  return (
    <div className={styles.chatContainer}>
      {/* Tabs: one per player + faction tabs */}
      <div className={styles.channelTabs}>
        {players.map(p => (
          <button
            key={`player-${p.id}`}
            className={`${styles.channelTab} ${tab?.type === 'player' && tab.playerId === p.id ? styles.channelTabActive : ''}`}
            onClick={() => setTab({ type: 'player', playerId: p.id, channel: (tab?.type === 'player' ? tab.channel : 'private') })}
          >
            {p.username}
          </button>
        ))}
        {factions.map(f => (
          <button
            key={`faction-${f.id}`}
            className={`${styles.channelTab} ${styles.channelTabFaction} ${tab?.type === 'faction' && tab.factionId === f.id ? styles.channelTabActive : ''}`}
            onClick={() => setTab({ type: 'faction', factionId: f.id, playerId: f.playerId })}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Sub-tabs for private/local when a player tab is active */}
      {tab?.type === 'player' && (
        <div className={styles.subTabs}>
          <button
            className={`${styles.subTab} ${tab.channel === 'private' ? styles.subTabActive : ''}`}
            onClick={() => setTab({ ...tab, channel: 'private' })}
          >
            Private
          </button>
          <button
            className={`${styles.subTab} ${tab.channel === 'local' ? styles.subTabActive : ''}`}
            onClick={() => setTab({ ...tab, channel: 'local' })}
          >
            Local
          </button>
        </div>
      )}

      {/* Messages */}
      {loading ? (
        <div className={styles.inlineSpinner}>
          <div className={styles.spinner} />
          <span>Loading messages...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className={styles.emptyChat}>
          <MessageSquare size={32} />
          <p>No messages in this channel yet.</p>
        </div>
      ) : (
        <>
          {hasMore && (
            <div className={styles.loadMore}>
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}
          <div className={styles.messageList} ref={messageListRef}>
            {[...messages].reverse().map(msg => (
              <div key={msg.id} className={styles.message}>
                <span className={styles.messageSender}>{msg.sender}</span>
                <span className={styles.messageContent}>{msg.content}</span>
                <span className={styles.messageTime}>{formatChatTime(msg.timestamp)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className={styles.chatFooter}>
        Read-only view. Use in-game chat to send messages.
      </div>
    </div>
  )
}
