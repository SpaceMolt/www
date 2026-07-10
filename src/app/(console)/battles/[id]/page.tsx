'use client'

import { useParams } from 'next/navigation'
import BattleViewer from '@/components/battle/BattleViewer'

export default function BattleDetailPage() {
  const params = useParams()
  const battleId = params.id as string
  return <BattleViewer battleId={battleId} />
}
