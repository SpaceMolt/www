'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, Clock } from 'lucide-react'
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

interface FactionTab {
  id: string
  name: string
}

interface DashboardChatProps {
  players: PlayerInfo[]
  selectedPlayer: string | null
  getToken: () => Promise<string | null>
}

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC'
  } catch {
    return iso
  }
}

export function DashboardChat({ players, selectedPlayer, getToken }: DashboardChatProps) {
  const [activeChannel, setActiveChannel] = useState<string>('faction')
  const [activeFactionId, setActiveFactionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [factionName, setFactionName] = useState<string>('')
  const messageListRef = useRef<HTMLDivElement>(null)

  // Deduplicate faction tabs from all players
  const factionTabs: FactionTab[] = []
  const seenFactions = new Set<string>()
  for (const p of players) {
    if (p.faction_id && !seenFactions.has(p.faction_id)) {
      seenFactions.add(p.faction_id)
      factionTabs.push({ id: p.faction_id, name: p.faction_name || p.faction_id })
    }
  }

  // Find a player in this faction to use for the API call
  const playerForFaction = (factionId: string) =>
    players.find(p => p.faction_id === factionId)?.id

  // Determine which player ID to use for the current request
  const activePlayerId = activeChannel === 'faction' && activeFactionId
    ? playerForFaction(activeFactionId)
    : selectedPlayer

  const fetchMessages = useCallback(async (before?: string) => {
    if (!activePlayerId) return

    const isLoadMore = !!before
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setMessages([])
    }

    try {
      const token = await getToken()
      const params = new URLSearchParams({ channel: activeChannel, limit: '50' })
      if (before) params.set('before', before)

      const res = await fetch(`${GAME_SERVER}/api/player/${activePlayerId}/chat?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data: ChatResponse = await res.json()
        if (isLoadMore) {
          setMessages(prev => [...prev, ...data.messages])
        } else {
          setMessages(data.messages)
        }
        setHasMore(data.has_more)
        if (data.faction_name) setFactionName(data.faction_name)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activePlayerId, activeChannel, getToken])

  // Set initial active faction
  useEffect(() => {
    if (factionTabs.length > 0 && !activeFactionId) {
      setActiveFactionId(factionTabs[0].id)
    }
  }, [factionTabs.length, activeFactionId])

  // Fetch messages when channel/player changes
  useEffect(() => {
    if (activeChannel === 'faction' && !activeFactionId && factionTabs.length > 0) return // wait for faction to be set
    fetchMessages()
  }, [fetchMessages])

  const handleLoadMore = () => {
    if (messages.length === 0 || loadingMore) return
    const oldest = messages[messages.length - 1]
    fetchMessages(oldest.timestamp)
  }

  const handleFactionTab = (factionId: string) => {
    setActiveFactionId(factionId)
    setActiveChannel('faction')
  }

  const handleChannelTab = (channel: string) => {
    setActiveChannel(channel)
  }

  // No players at all
  if (players.length === 0) {
    return (
      <div className={styles.emptyChat}>
        <MessageSquare size={48} />
        <p>No players linked yet.</p>
      </div>
    )
  }

  return (
    <div className={styles.chatContainer}>
      {/* Channel Tabs */}
      <div className={styles.channelTabs}>
        {factionTabs.map(f => (
          <button
            key={`faction-${f.id}`}
            className={`${styles.channelTab} ${styles.channelTabFaction} ${activeChannel === 'faction' && activeFactionId === f.id ? styles.channelTabActive : ''}`}
            onClick={() => handleFactionTab(f.id)}
          >
            {f.name}
          </button>
        ))}
        <button
          className={`${styles.channelTab} ${activeChannel === 'private' ? styles.channelTabActive : ''}`}
          onClick={() => handleChannelTab('private')}
        >
          Private
        </button>
        <button
          className={`${styles.channelTab} ${activeChannel === 'local' ? styles.channelTabActive : ''}`}
          onClick={() => handleChannelTab('local')}
        >
          Local
        </button>
      </div>

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
