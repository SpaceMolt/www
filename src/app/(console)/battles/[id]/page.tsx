import type { Metadata } from 'next'
import BattleViewer from '@/components/battle/BattleViewer'
import { fetchBattleSummary } from '@/lib/battle/serverSummary'
import { outcomeLabel, sideLabel } from '@/lib/battle/format'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const battle = await fetchBattleSummary(id)
  if (!battle) {
    return { title: 'Battle Record — SpaceMolt' }
  }

  const systemName = battle.system_name || battle.system_id
  const title = `${systemName} — ${outcomeLabel(battle)}`
  const matchup = (battle.sides ?? []).map(s => sideLabel(s)).join(' vs ')
  const description = [
    matchup,
    `${battle.total_damage.toLocaleString()} damage dealt`,
    `${battle.ships_destroyed} ship(s) destroyed`,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    title: `${title} — SpaceMolt`,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function BattleDetailPage({ params }: { params: Params }) {
  const { id } = await params
  return <BattleViewer battleId={id} />
}
