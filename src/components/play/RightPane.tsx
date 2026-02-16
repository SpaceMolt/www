'use client'

import { useState } from 'react'
import { Radio, MessageSquare, ChevronUp } from 'lucide-react'
import { useGame } from './GameProvider'
import { EventLog } from './EventLog'
import { ChatPanel } from './ChatPanel'
import styles from './RightPane.module.css'

type SubTab = 'events' | 'chat'

export function RightPane() {
  const { state } = useGame()
  const [activeTab, setActiveTab] = useState<SubTab>('events')
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const eventCount = state.eventLog.length
  const hasUnreadChat = state.chatMessages.length > 0

  return (
    <div className={`${styles.container} ${mobileExpanded ? styles.containerExpanded : ''}`}>
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'events' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <Radio size={12} />
          <span>Events</span>
          {eventCount > 0 && (
            <span className={styles.countBadge}>{eventCount > 99 ? '99+' : eventCount}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'chat' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={12} />
          <span>Chat</span>
          {hasUnreadChat && activeTab !== 'chat' && (
            <span className={styles.unreadDot} />
          )}
        </button>
        {/* Mobile expand/collapse toggle */}
        <button
          className={styles.mobileToggle}
          onClick={() => setMobileExpanded(!mobileExpanded)}
          aria-label={mobileExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronUp size={14} className={`${styles.toggleChevron} ${mobileExpanded ? styles.toggleChevronOpen : ''}`} />
        </button>
      </div>
      <div className={styles.content}>
        {activeTab === 'events' ? <EventLog /> : <ChatPanel />}
      </div>
    </div>
  )
}
