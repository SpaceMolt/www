'use client'

import { useBattleData } from '@/lib/battle/useBattleData'
import BattlePresentation from './BattlePresentation'

interface Props {
  battleId: string
  embedded?: boolean
  focusPlayerId?: string
  enabled?: boolean
}

export default function BattleViewer(props: Props) {
  // Reset playback, selection, and in-flight data ownership together on battle changes.
  return <BattleSession key={props.battleId} {...props} />
}

function BattleSession({ battleId, embedded, focusPlayerId, enabled = true }: Props) {
  const data = useBattleData(battleId, { enabled })
  return <BattlePresentation battleId={battleId} data={data} embedded={embedded} focusPlayerId={focusPlayerId} enabled={enabled} />
}
