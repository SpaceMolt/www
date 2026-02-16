'use client'

import { useState } from 'react'
import { useGame } from './GameProvider'
import { TopBar } from './TopBar'
import { ToastContainer } from './ToastContainer'
import { TravelProgress } from './TravelProgress'
import { PanelNav } from './PanelNav'
import { RightPane } from './RightPane'
import { TickCooldown } from './TickCooldown'
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

  const ActivePanelComponent = PANELS[activePanel] || NavigationPanel

  const badges: Record<string, number> = {}
  if (state.pendingTrades.length > 0) badges.trading = state.pendingTrades.length
  if (state.inCombat) badges.combat = 1

  return (
    <>
      <div className={styles.hud}>
        {/* Top Bar */}
        <TopBar />

        {/* Tick Cooldown Bar */}
        <TickCooldown />

        {/* Tab Bar */}
        <PanelNav
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          badges={badges}
        />

        {/* Main Content: Panel + Right Pane */}
        <div className={styles.main}>
          <div className={styles.panel}>
            <TravelProgress />
            <div className={styles.panelContent}>
              <ActivePanelComponent />
            </div>
          </div>
          <RightPane />
        </div>
      </div>

      {/* Action Toasts (position: fixed, outside grid) */}
      <ToastContainer />
    </>
  )
}
