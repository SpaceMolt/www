'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useGame } from './GameProvider'
import { Send, Hash, Users, Shield, MessageSquare } from 'lucide-react'
import styles from './ChatPanel.module.css'

type Channel = 'local' | 'system' | 'faction' | 'private'

const CHANNEL_CONFIG: Record<Channel, { icon: typeof Hash; label: string }> = {
  local:   { icon: Hash,          label: 'Local' },
  system:  { icon: Hash,          label: 'System' },
  faction: { icon: Users,         label: 'Faction' },
  private: { icon: MessageSquare, label: 'Private' },
}

function formatTimestamp(ts?: string | null): string {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function ChatPanel() {
  const { state, sendCommand } = useGame()
  const [activeChannel, setActiveChannel] = useState<Channel>('local')
  const [input, setInput] = useState('')
  const [privateTarget, setPrivateTarget] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const isAutoScrollRef = useRef(true)

  const filteredMessages = state.chatMessages.filter((msg) => {
    if (activeChannel === 'private') {
      return msg.channel === 'private' || msg.channel === 'whisper'
    }
    return msg.channel === activeChannel
  })

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    if (isAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [filteredMessages.length])

  const handleScroll = useCallback(() => {
    const el = messagesRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAutoScrollRef.current = distFromBottom < 30
  }, [])

  const handleSend = useCallback(() => {
    const content = input.trim()
    if (!content) return

    const payload: Record<string, unknown> = {
      channel: activeChannel,
      content,
    }
    if (activeChannel === 'private' && privateTarget.trim()) {
      payload.target_id = privateTarget.trim()
    }

    sendCommand('chat', payload)
    setInput('')
  }, [input, activeChannel, privateTarget, sendCommand])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

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

      <div
        ref={messagesRef}
        className={styles.messages}
        onScroll={handleScroll}
      >
        {filteredMessages.length === 0 ? (
          <div className={styles.emptyMessages}>
            No messages in {CHANNEL_CONFIG[activeChannel].label}
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div key={msg.id} className={styles.message}>
              <div className={styles.messageMeta}>
                <span className={styles.sender}>{msg.sender}</span>
                {msg.target_name && (
                  <>
                    <Shield size={10} className={styles.whisperIcon} />
                    <span className={styles.whisperTarget}>{msg.target_name}</span>
                  </>
                )}
                <span className={styles.timestamp}>
                  {formatTimestamp(msg.timestamp || msg.timestamp_utc)}
                </span>
              </div>
              <div className={styles.messageContent}>{msg.content}</div>
            </div>
          ))
        )}
      </div>

      <div className={styles.inputArea}>
        {activeChannel === 'private' && (
          <input
            type="text"
            className={styles.targetInput}
            placeholder="Player ID..."
            value={privateTarget}
            onChange={(e) => setPrivateTarget(e.target.value)}
          />
        )}
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.chatInput}
            placeholder={`Message ${CHANNEL_CONFIG[activeChannel].label}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!input.trim()}
            title="Send message"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
