'use client'

import { useId, useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronDown, ChevronRight, Radar } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { ReachRing } from '@/lib/battle/render'
import styles from './CombatPanel.module.css'

const BattleViewer = dynamic(() => import('@/components/battle/BattleViewer'), { ssr: false })

/** The viewer is deliberately read-only: it never receives an authenticated Account. */
export function CombatBattleView({ battleId, playerId, participating, reachRings, onPickShip }: {
  battleId: string
  playerId?: string
  participating: boolean
  reachRings?: ReachRing[]
  onPickShip?: (id: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const regionId = useId()
  return (
    <section className={styles.battleView}>
      <button type="button" className={styles.battleViewToggle} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={regionId}>
        <Radar size={15} aria-hidden />
        <span>{t(participating ? 'battles.playCombat.visualizer' : 'battles.playCombat.lastBattle')}</span>
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
      </button>
      <p className={styles.battleViewHint}>
        {onPickShip
          ? 'Dashed rings show where each weapon hits from your zone. Click an enemy ship to target it. The view can trail the server by a tick.'
          : t(participating ? 'battles.playCombat.historyHint' : 'battles.playCombat.spectatorHint')}
      </p>
      <div id={regionId} hidden={!open}>
        <BattleViewer battleId={battleId} embedded focusPlayerId={playerId} enabled={open} reachRings={reachRings} onPickShip={onPickShip} />
      </div>
    </section>
  )
}
