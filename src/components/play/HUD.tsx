'use client'

import { useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { useGame } from './GameProvider'
import { ShipStatus } from './ShipStatus'
import { PlayerInfo } from './PlayerInfo'
import { TravelProgress } from './TravelProgress'
import { PanelNav } from './PanelNav'
import { ChatPanel } from './ChatPanel'
import { EventLog } from './EventLog'
import { NavigationPanel } from './panels/NavigationPanel'
import { CombatPanel } from './panels/CombatPanel'
import { MiningPanel } from './panels/MiningPanel'
import { TradingPanel } from './panels/TradingPanel'
import { ShipPanel } from './panels/ShipPanel'
import { CraftingPanel } from './panels/CraftingPanel'
import { FactionPanel } from './panels/FactionPanel'
import { BasePanel } from './panels/BasePanel'
import { InfoPanel } from './panels/InfoPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import styles from './HUD.module.css'

const PANELS: Record<string, React.ComponentType> = {
  navigation: NavigationPanel,
  combat: CombatPanel,
  mining: MiningPanel,
  trading: TradingPanel,
  ship: ShipPanel,
  crafting: CraftingPanel,
  faction: FactionPanel,
  base: BasePanel,
  info: InfoPanel,
  settings: SettingsPanel,
}

export function HUD() {
  const { state } = useGame()
  const [activePanel, setActivePanel] = useState('navigation')
  const [chatOpen, setChatOpen] = useState(true)
  const [chatOpenMobile, setChatOpenMobile] = useState(false)

  const ActivePanelComponent = PANELS[activePanel] || NavigationPanel

  const badges: Record<string, number> = {}
  if (state.pendingTrades.length > 0) badges.trading = state.pendingTrades.length
  if (state.inCombat) badges.combat = 1

  return (
    <div className={styles.hud}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <ShipStatus />
        <PlayerInfo />
      </div>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Left Sidebar - Panel Navigation */}
        <PanelNav
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          badges={badges}
        />

        {/* Center - Active Panel */}
        <div className={styles.center}>
          <TravelProgress />
          <div className={styles.panelContent}>
            <ActivePanelComponent />
          </div>
        </div>

        {/* Right Sidebar - Chat (desktop) */}
        <div className={`${styles.chatSidebar} ${chatOpen ? styles.chatSidebarOpen : ''}`}>
          <button
            className={styles.chatToggle}
            onClick={() => setChatOpen(!chatOpen)}
            aria-label={chatOpen ? 'Close chat' : 'Open chat'}
          >
            {chatOpen ? <X size={16} /> : <MessageSquare size={16} />}
          </button>
          {chatOpen && <ChatPanel />}
        </div>
      </div>

      {/* Bottom Bar - Event Log */}
      <div className={styles.bottomBar}>
        <EventLog />
      </div>

      {/* Mobile Chat Toggle */}
      <button
        className={styles.mobileChatBtn}
        onClick={() => setChatOpenMobile(!chatOpenMobile)}
        aria-label="Toggle chat"
      >
        <MessageSquare size={20} />
        {state.chatMessages.length > 0 && (
          <span className={styles.mobileChatBadge} />
        )}
      </button>

      {/* Mobile Chat Overlay */}
      {chatOpenMobile && (
        <div className={styles.mobileChatOverlay}>
          <div className={styles.mobileChatHeader}>
            <span>Chat</span>
            <button onClick={() => setChatOpenMobile(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>
          <ChatPanel />
        </div>
      )}
    </div>
  )
}
