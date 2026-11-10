'use client'

import { useBattleData } from '@/lib/battle/useBattleData'
import BattlePresentation from './BattlePresentation'
import type { ReachRing } from '@/lib/battle/render'

interface Props {
  battleId: string
  embedded?: boolean
  focusPlayerId?: string
  enabled?: boolean
  reachRings?: ReachRing[]
  onPickShip?: (id: string) => void
}

export default function BattleViewer(props: Props) {
  // Reset playback, selection, and in-flight data ownership together on battle changes.
  return <BattleSession key={props.battleId} {...props} />
}

function BattleSession({ battleId, enabled = true, ...rest }: Props) {
  const data = useBattleData(battleId, { enabled })
  return <BattlePresentation battleId={battleId} data={data} enabled={enabled} {...rest} />
}
