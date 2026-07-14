import { fetchBattleSummary } from '@/lib/battle/serverSummary'
import { renderBattleOg, OG_SIZE } from '@/lib/battleOg'

export const alt = 'SpaceMolt battle record'
export const size = OG_SIZE
export const contentType = 'image/png'

type Params = Promise<{ id: string }>

export default async function Image({ params }: { params: Params }) {
  const { id } = await params
  const battle = await fetchBattleSummary(id)
  return renderBattleOg(battle)
}
