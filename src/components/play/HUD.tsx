'use client'

import { useState } from 'react'
import { useGame } from './GameProvider'
import { TopBar } from './TopBar'
import { ToastContainer } from './ToastContainer'
import { TravelProgress } from './TravelProgress'
import { PanelNav } from './PanelNav'
import { LeftSidebar } from './LeftSidebar'
import { RightPane } from './RightPane'
import { TickCooldown } from './TickCooldown'
import { ActionBanner } from './ActionBanner'
import { GalaxyPanel } from './panels/GalaxyPanel'
import { CombatPanel } from './panels/CombatPanel'
import { TradingPanel } from './panels/TradingPanel'
import { StoragePanel } from './panels/StoragePanel'
import { ShipPanel } from './panels/ShipPanel'
import { ShipyardPanel } from './panels/ShipyardPanel'
import { CraftingPanel } from './panels/CraftingPanel'
import { FactionPanel } from './panels/FactionPanel'
import { MissionsPanel } from './panels/MissionsPanel'
import { InfoPanel } from './panels/InfoPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import styles from './HUD.module.css'

const PANELS: Record<string, React.ComponentType> = {
  galaxy: GalaxyPanel,
  combat: CombatPanel,
  trading: TradingPanel,
  storage: StoragePanel,
  ship: ShipPanel,
  shipyard: ShipyardPanel,
  crafting: CraftingPanel,
  faction: FactionPanel,
  missions: MissionsPanel,
  info: InfoPanel,
  settings: SettingsPanel,
}

export function HUD() {
  const { state } = useGame()
  const [activePanel, setActivePanel] = useState('galaxy')

  const ActivePanelComponent = PANELS[activePanel] || GalaxyPanel

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
          isDocked={state.isDocked}
          inCombat={state.inCombat}
        />

        {/* Main Content: Left Sidebar + Panel + Right Pane */}
        <div className={styles.main}>
          <LeftSidebar />
          <div className={styles.panel}>
            <ActionBanner />
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
