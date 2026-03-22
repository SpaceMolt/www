'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useGame } from './GameProvider'
import styles from './ActionBanner.module.css'

/** Human-readable labels for mutation commands */
const ACTION_LABELS: Record<string, string> = {
  mine: 'Mining',
  travel: 'Traveling',
  jump: 'Jumping',
  dock: 'Docking',
  undock: 'Undocking',
  attack: 'Attacking',
  scan: 'Scanning',
  cloak: 'Cloaking',
  buy: 'Buying',
  sell: 'Selling',
  craft: 'Crafting',
  refuel: 'Refueling',
  repair: 'Repairing',
  install_mod: 'Installing module',
  uninstall_mod: 'Uninstalling module',
  repair_module: 'Repairing module',
  jettison: 'Jettisoning',
  use_item: 'Using item',
  self_destruct: 'Self destructing',
  survey_system: 'Surveying system',
  loot_wreck: 'Looting wreck',
  salvage_wreck: 'Salvaging wreck',
  tow_wreck: 'Towing wreck',
  switch_ship: 'Switching ship',
  commission_ship: 'Commissioning ship',
  accept_mission: 'Accepting mission',
  complete_mission: 'Completing mission',
  deposit_items: 'Depositing',
  withdraw_items: 'Withdrawing',
  create_sell_order: 'Creating sell order',
  create_buy_order: 'Creating buy order',
  trade_offer: 'Sending trade offer',
  trade_accept: 'Accepting trade',
}

function getLabel(command: string): string {
  return ACTION_LABELS[command] || command.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) + '...'
}

export function ActionBanner() {
  const { state } = useGame()
  const [elapsed, setElapsed] = useState(0)

  const pending = state.pendingAction

  useEffect(() => {
    if (!pending) {
      setElapsed(0)
      return
    }
    const interval = setInterval(() => {
      setElapsed(Date.now() - pending.startedAt)
    }, 100)
    return () => clearInterval(interval)
  }, [pending])

  if (!pending) return null

  // Progress bar: assume ~10 second tick cycle max
  const progressPct = Math.min(100, (elapsed / 10000) * 100)

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <Loader2 size={20} className={styles.spinner} />
        <span className={styles.label}>{getLabel(pending.command)}</span>
      </div>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressBar}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}
