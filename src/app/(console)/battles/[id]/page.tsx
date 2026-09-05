import type { Metadata } from 'next'
import BattleViewer from '@/components/battle/BattleViewer'
import { fetchBattleSummary } from '@/lib/battle/serverSummary'
import { battleVenue, outcomeLabel, sideLabel, truncate } from '@/lib/battle/format'
import { SITE_URL } from '@/lib/links'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const battle = await fetchBattleSummary(id)
  const canonical = `${SITE_URL}/battles/${encodeURIComponent(id)}`
  if (!battle) {
    // An unknown battle id renders an empty viewer, so keep it out of the index
    // rather than letting it accumulate as a soft 404.
    return { title: 'Battle Record — SpaceMolt', robots: { index: false, follow: true } }
  }

  const title = `${battleVenue(battle)} — ${outcomeLabel(battle)}`
  // Free-for-all battles can have many long-named sides; cap the matchup so
  // the meta description can't balloon past what any platform would show.
  const matchup = truncate((battle.sides ?? []).map(s => sideLabel(s)).join(' vs '), 160)
  const description = [
    battle.category === 'arena' ? 'Arena exhibition match' : '',
    matchup,
    `${battle.total_damage.toLocaleString()} damage dealt`,
    battle.category === 'arena' ? `${battle.ships_destroyed} knockout(s)` : `${battle.ships_destroyed} ship(s) destroyed`,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    title: `${title} — SpaceMolt`,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function BattleDetailPage({ params }: { params: Params }) {
  const { id } = await params
  return <BattleViewer battleId={id} />
}
