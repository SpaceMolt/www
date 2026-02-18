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
  chat_private_count?: number
  chat_local_count?: number
  chat_faction_count?: number
}

interface DashboardChatProps {
  players: PlayerInfo[]
  selectedPlayer: string | null
  authHeaders: () => Promise<Record<string, string>>
  onRefreshRef?: React.MutableRefObject<(() => void) | null>
}

// Sidebar selection: a channel (faction/local) or a DM contact
type Selection =
  | { type: 'channel'; channel: 'faction' | 'local' }
  | { type: 'dm'; contactId: string }

interface DMContact {
  id: string
  name: string
  lastMessage: string
  count: number
}

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC'
  } catch {
    return iso
  }
}

export function DashboardChat({ players, selectedPlayer, authHeaders, onRefreshRef }: DashboardChatProps) {
  const [selection, setSelection] = useState<Selection>({ type: 'channel', channel: 'faction' })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const messageListRef = useRef<HTMLDivElement>(null)

  // DM state — all DMs fetched once, filtered client-side
  const [dmContacts, setDmContacts] = useState<DMContact[]>([])
  const [allDmMessages, setAllDmMessages] = useState<ChatMessage[]>([])
  const [dmLoaded, setDmLoaded] = useState(false)

  const activePlayer = players.find(p => p.id === selectedPlayer)
  const hasFaction = !!activePlayer?.faction_id

  // Reset when selected player changes
  useEffect(() => {
    setSelection(hasFaction ? { type: 'channel', channel: 'faction' } : { type: 'channel', channel: 'local' })
    setMessages([])
    setDmContacts([])
    setAllDmMessages([])
    setDmLoaded(false)
  }, [selectedPlayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch channel messages (faction/local)
  const fetchChannelMessages = useCallback(async (channel: 'faction' | 'local', before?: string) => {
    if (!selectedPlayer) return

    const isLoadMore = !!before
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setMessages([])
    }

    try {
      const headers = await authHeaders()
      const params = new URLSearchParams({ channel, limit: '50' })
      if (before) params.set('before', before)

      const res = await fetch(`${GAME_SERVER}/api/player/${selectedPlayer}/chat?${params}`, { headers })
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
  }, [selectedPlayer, authHeaders])

  // Fetch all DMs once (for contact list + client-side filtering)
  const fetchAllDms = useCallback(async () => {
    if (!selectedPlayer || dmLoaded) return
    setLoading(true)

    try {
      const headers = await authHeaders()
      const params = new URLSearchParams({ channel: 'private', limit: '100' })
      const res = await fetch(`${GAME_SERVER}/api/player/${selectedPlayer}/chat?${params}`, { headers })

      if (res.ok) {
        const data: ChatResponse = await res.json()
        setAllDmMessages(data.messages)

        const contactMap = new Map<string, DMContact>()
        for (const msg of data.messages) {
          const isOutgoing = msg.sender_id === selectedPlayer
          const otherId = isOutgoing ? (msg.target_id || '') : msg.sender_id
          const otherName = isOutgoing ? (msg.target_name || msg.target_id || '') : msg.sender
          if (!otherId) continue
          const existing = contactMap.get(otherId)
          if (existing) {
            existing.count++
          } else {
            contactMap.set(otherId, { id: otherId, name: otherName, lastMessage: msg.content, count: 1 })
          }
        }
        setDmContacts(Array.from(contactMap.values()))
        setDmLoaded(true)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [selectedPlayer, authHeaders, dmLoaded])

  // Auto-load DMs on mount
  useEffect(() => {
    if (selectedPlayer && !dmLoaded) fetchAllDms()
  }, [selectedPlayer, dmLoaded, fetchAllDms])

  // Fetch data when selection changes
  useEffect(() => {
    if (!selectedPlayer) return
    if (selection.type === 'channel') {
      fetchChannelMessages(selection.channel)
    }
  }, [selection, selectedPlayer, fetchChannelMessages])

  const handleRefresh = useCallback(() => {
    setDmLoaded(false)
    setDmContacts([])
    setAllDmMessages([])
    if (selection.type === 'channel') {
      fetchChannelMessages(selection.channel)
    }
  }, [selection, fetchChannelMessages])

  // Expose refresh to parent
  useEffect(() => {
    if (onRefreshRef) onRefreshRef.current = handleRefresh
    return () => { if (onRefreshRef) onRefreshRef.current = null }
  }, [onRefreshRef, handleRefresh])

  // Derive displayed messages
  const displayMessages = selection.type === 'dm'
    ? allDmMessages.filter(msg =>
        msg.sender_id === selection.contactId || msg.target_id === selection.contactId
      )
    : messages

  const handleLoadMore = () => {
    if (selection.type !== 'channel' || messages.length === 0 || loadingMore) return
    const oldest = messages[messages.length - 1]
    fetchChannelMessages(selection.channel, oldest.timestamp)
  }

  if (players.length === 0 || !selectedPlayer) {
    return (
      <div className={styles.emptyChat}>
        <MessageSquare size={32} />
        <p>No player selected.</p>
      </div>
    )
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.dmLayout}>
        {/* Sidebar */}
        <div className={styles.dmSidebar}>
          {/* Chatrooms header */}
          <div className={styles.dmSeparator}>Chatrooms</div>

          {/* Channel entries */}
          {hasFaction && (
            <button
              className={`${styles.dmContact} ${styles.dmContactChannel} ${selection.type === 'channel' && selection.channel === 'faction' ? styles.dmContactActive : ''}`}
              onClick={() => setSelection({ type: 'channel', channel: 'faction' })}
            >
              <div className={styles.dmContactChannelRow}>
                <span className={styles.dmContactChannelName}>
                  {activePlayer?.faction_name || 'Faction'}
                </span>
                {(activePlayer?.chat_faction_count ?? 0) > 0 && (
                  <span className={styles.dmContactCount}>{activePlayer?.chat_faction_count}</span>
                )}
              </div>
            </button>
          )}
          <button
            className={`${styles.dmContact} ${styles.dmContactChannel} ${selection.type === 'channel' && selection.channel === 'local' ? styles.dmContactActive : ''}`}
            onClick={() => setSelection({ type: 'channel', channel: 'local' })}
          >
            <div className={styles.dmContactChannelRow}>
              <span className={styles.dmContactChannelName}>Local</span>
              {(activePlayer?.chat_local_count ?? 0) > 0 && (
                <span className={styles.dmContactCount}>{activePlayer?.chat_local_count}</span>
              )}
            </div>
          </button>

          {/* DM separator */}
          {dmContacts.length > 0 && (
            <div className={styles.dmSeparator}>DMs</div>
          )}

          {/* DM contacts */}
          {dmContacts.map(c => (
            <button
              key={c.id}
              className={`${styles.dmContact} ${selection.type === 'dm' && selection.contactId === c.id ? styles.dmContactActive : ''}`}
              onClick={() => setSelection({ type: 'dm', contactId: c.id })}
            >
              <div className={styles.dmContactChannelRow}>
                <span className={styles.dmContactName}>{c.name}</span>
                <span className={styles.dmContactCount}>{c.count}</span>
              </div>
              <span className={styles.dmContactPreview}>{c.lastMessage}</span>
            </button>
          ))}

        </div>

        {/* Messages pane */}
        <div className={styles.dmMessages}>
          {loading ? (
            <div className={styles.inlineSpinner}>
              <div className={styles.spinner} />
              <span>Loading...</span>
            </div>
          ) : displayMessages.length === 0 ? (
            <div className={styles.emptyChat}>
              <MessageSquare size={32} />
              <p>No messages yet.</p>
            </div>
          ) : (
            <>
              {hasMore && selection.type === 'channel' && (
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
                {[...displayMessages].reverse().map(msg => (
                  <div key={msg.id} className={styles.message}>
                    <span className={styles.messageSender}>{msg.sender}</span>
                    <span className={styles.messageContent}>{msg.content}</span>
                    <span className={styles.messageTime}>{formatChatTime(msg.timestamp)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
