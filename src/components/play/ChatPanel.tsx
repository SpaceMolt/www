'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { ChatHistoryMessage } from '@spacemolt/lib'
import { useAccountStore, usePlayer } from '@/lib/spacemolt'
import type { ChatMessage } from '@/lib/spacemolt/uiStore'
import { usePlay, usePlayUi } from './PlayProvider'
import { Send, Hash, Users, Shield, MessageSquare, Siren, ArrowLeft, History } from 'lucide-react'
import { Loading, errorMessage, shared } from './shared'
import styles from './ChatPanel.module.css'

type Channel = 'local' | 'system' | 'faction' | 'private' | 'emergency'

const CHANNEL_CONFIG: Record<Channel, { icon: typeof Hash; label: string }> = {
  local:     { icon: Hash,          label: 'Local' },
  system:    { icon: Hash,          label: 'System' },
  faction:   { icon: Users,         label: 'Faction' },
  private:   { icon: MessageSquare, label: 'Private' },
  emergency: { icon: Siren,         label: 'Distress' },
}

const HISTORY_PAGE = 50
const CONTACT_LIMIT = 30

interface Partner { name: string; id: string }
interface Conversation extends Partner { last: ChatMessage }

function formatTimestamp(ts?: string | null): string {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const fromHistory = ({ timestamp_utc, ...rest }: ChatHistoryMessage): ChatMessage => ({ ...rest, timestamp: timestamp_utc })

const timeOf = (m: ChatMessage) => Date.parse(m.timestamp ?? '') || 0

/** Merge message lists oldest-first, dropping repeats of the same id (later lists win). */
export function mergeChat(...lists: ChatMessage[][]): ChatMessage[] {
  const all = lists.flat()
  const byId = new Map(all.filter((m) => m.id).map((m) => [m.id, m]))
  return [...byId.values(), ...all.filter((m) => !m.id)].sort((a, b) => timeOf(a) - timeOf(b))
}

/** The other side of a private message. Incoming messages carry the partner's id; outgoing carry a username. */
function partnerOf(m: ChatMessage, myId?: string): Partner {
  if (m.sender_id === myId) {
    const name = m.target_name ?? m.target_id ?? ''
    return { name, id: name }
  }
  return { name: m.sender ?? '', id: m.sender_id ?? m.sender ?? '' }
}

const samePartner = (a: Partner, b: Partner) => a.name.toLowerCase() === b.name.toLowerCase()

/** One entry per DM partner, newest conversation first. */
export function buildConversations(messages: ChatMessage[], myId?: string): Conversation[] {
  const byName = new Map<string, Conversation>()
  for (const m of mergeChat(messages.filter((msg) => msg.channel === 'private'))) {
    const partner = partnerOf(m, myId)
    if (!partner.name) continue
    const key = partner.name.toLowerCase()
    // Prefer the id from an incoming message: it resolves empire senders too.
    const id = m.sender_id === myId ? (byName.get(key)?.id ?? partner.id) : partner.id
    byName.set(key, { ...partner, id, last: m })
  }
  return [...byName.values()].sort((a, b) => timeOf(b.last) - timeOf(a.last))
}

/** Names seen in recent private, local, and system messages, most recent first. */
export function recentContacts(messages: ChatMessage[], myId?: string): string[] {
  const names = messages
    .filter((m) => m.channel === 'private' || m.channel === 'local' || m.channel === 'system')
    .flatMap((m) => (m.sender_id === myId ? [m.channel === 'private' ? m.target_name : undefined] : [m.sender]))
    .filter((n): n is string => !!n)
    .reverse()
  return [...new Set(names)].slice(0, CONTACT_LIMIT)
}

interface HistoryPage { messages: ChatMessage[]; hasMore: boolean }

export function ChatPanel() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const myId = usePlayer()?.id
  const chatMessages = usePlayUi((s) => s.chatMessages)
  const [activeChannel, setActiveChannel] = useState<Channel>('local')
  const [input, setInput] = useState('')
  const [privateTarget, setPrivateTarget] = useState('')
  const [dmPartner, setDmPartner] = useState<Partner | null>(null)
  const [history, setHistory] = useState<Record<string, HistoryPage>>({})
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const isAutoScrollRef = useRef(true)

  const dm = activeChannel === 'private' ? dmPartner : null
  const isInbox = activeChannel === 'private' && !dmPartner
  const historyKey = dm ? `private:${dm.name.toLowerCase()}` : activeChannel
  const historyKeyRef = useRef(historyKey)
  historyKeyRef.current = historyKey
  const page = history[historyKey]

  const loadHistory = useCallback(async (before?: string) => {
    const key = historyKey
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await store.account.commands.spacemolt_social.get_chat_history({
        target: activeChannel,
        target_id: dm?.id,
        limit: HISTORY_PAGE,
        before,
      })
      const data = res.structuredContent
      const older = (data?.messages ?? []).map(fromHistory)
      setHistory((h) => ({
        ...h,
        [key]: { messages: mergeChat(h[key]?.messages ?? [], older), hasMore: data?.has_more ?? false },
      }))
    } catch (err) {
      if (historyKeyRef.current === key) setHistoryError(errorMessage(err))
    } finally {
      if (historyKeyRef.current === key) setHistoryLoading(false)
    }
  }, [store, activeChannel, dm, historyKey])

  useEffect(() => {
    isAutoScrollRef.current = true
    void loadHistory()
  }, [loadHistory])

  const liveMessages = useMemo(
    () => chatMessages.filter((msg) =>
      msg.channel === activeChannel && (!dm || samePartner(partnerOf(msg, myId), dm))),
    [chatMessages, activeChannel, dm, myId],
  )
  const shownMessages = useMemo(() => mergeChat(page?.messages ?? [], liveMessages), [page, liveMessages])
  const conversations = useMemo(
    () => (isInbox ? buildConversations([...(page?.messages ?? []), ...liveMessages], myId) : []),
    [isInbox, page, liveMessages, myId],
  )
  const contacts = useMemo(() => recentContacts(chatMessages, myId), [chatMessages, myId])

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    if (isAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [shownMessages.length])

  const handleScroll = useCallback(() => {
    const el = messagesRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAutoScrollRef.current = distFromBottom < 30
  }, [])

  const handleLoadOlder = useCallback(() => {
    isAutoScrollRef.current = false
    void loadHistory(page?.messages.find((m) => m.timestamp)?.timestamp)
  }, [loadHistory, page])

  const openDm = useCallback((partner: Partner | null) => {
    setDmPartner(partner)
    setPrivateTarget('')
  }, [])

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || activeChannel === 'emergency') return
    const typedTarget = privateTarget.trim()
    const targetId = activeChannel === 'private' ? (dmPartner?.id ?? typedTarget) : undefined
    if (activeChannel === 'private' && !targetId) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: 'Choose a recipient first' })
      return
    }

    setInput('')
    try {
      await store.account.commands.spacemolt_social.chat({ content, target: activeChannel, target_id: targetId })
      if (activeChannel !== 'private') return
      // A DM may not echo back to the sender; history picks up the sent message.
      if (dmPartner) void loadHistory()
      else openDm({ name: typedTarget, id: typedTarget })
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    }
  }, [input, activeChannel, privateTarget, dmPartner, store, uiStore, loadHistory, openDm])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  const label = dm ? dm.name : CHANNEL_CONFIG[activeChannel].label

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {(Object.keys(CHANNEL_CONFIG) as Channel[]).map((ch) => {
          const config = CHANNEL_CONFIG[ch]
          const Icon = config.icon
          const isActive = activeChannel === ch
          return (
            <button
              key={ch}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => setActiveChannel(ch)}
              title={config.label}
            >
              <Icon size={12} />
              <span className={styles.tabLabel}>{config.label}</span>
            </button>
          )
        })}
      </div>

      {dm && (
        <div className={styles.dmHeader}>
          <button className={shared.iconBtn} onClick={() => openDm(null)} title="Back to conversations">
            <ArrowLeft size={12} />
          </button>
          <Shield size={10} className={styles.whisperIcon} />
          <span className={styles.whisperTarget}>{dm.name}</span>
        </div>
      )}

      <div
        ref={messagesRef}
        className={styles.messages}
        onScroll={handleScroll}
      >
        {page?.hasMore && (
          <button className={`${shared.subtleBtn} ${styles.loadOlder}`} onClick={handleLoadOlder} disabled={historyLoading}>
            <History size={12} /> Load older
          </button>
        )}
        {historyLoading && <Loading message="Loading history..." />}
        {historyError && <div className={styles.historyError}>{historyError}</div>}
        {isInbox ? (
          conversations.length === 0 ? (
            !historyLoading && <div className={styles.emptyMessages}>No conversations yet</div>
          ) : (
            conversations.map((c) => (
              <button key={c.name} className={`${shared.listCard} ${styles.conversation}`} onClick={() => openDm(c)}>
                <span className={shared.listCardName}>{c.name}</span>
                <span className={styles.conversationPreview}>{c.last.content}</span>
                <span className={styles.timestamp}>{formatTimestamp(c.last.timestamp)}</span>
              </button>
            ))
          )
        ) : shownMessages.length === 0 ? (
          !historyLoading && <div className={styles.emptyMessages}>No messages in {label}</div>
        ) : (
          shownMessages.map((msg, index) => (
            <div key={msg.id ?? index} className={styles.message}>
              <div className={styles.messageMeta}>
                <span className={styles.sender}>{msg.sender}</span>
                {msg.target_name && (
                  <>
                    <Shield size={10} className={styles.whisperIcon} />
                    <span className={styles.whisperTarget}>{msg.target_name}</span>
                  </>
                )}
                {msg.system && <span className={styles.whisperTarget}>{msg.system}</span>}
                <span className={styles.timestamp}>
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
              <div className={styles.messageContent}>{msg.content}</div>
            </div>
          ))
        )}
      </div>

      {activeChannel === 'emergency' ? (
        <div className={styles.inputArea}>
          <div className={styles.readOnly}>Read-only: distress calls within 5 jumps</div>
        </div>
      ) : (
        <div className={styles.inputArea}>
          {isInbox && (
            <>
              <input
                type="text"
                className={styles.targetInput}
                placeholder="Recipient name or ID..."
                list="chat-contacts"
                value={privateTarget}
                onChange={(e) => setPrivateTarget(e.target.value)}
              />
              <datalist id="chat-contacts">
                {contacts.map((name) => <option key={name} value={name} />)}
              </datalist>
            </>
          )}
          <div className={styles.inputRow}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder={`Message ${label}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
            />
            <button
              className={styles.sendButton}
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              title="Send message"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
