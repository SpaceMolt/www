// Server-side fetch of a single battle summary, used by the battle detail
// page's generateMetadata and its opengraph-image. See useBattleData.ts for
// the client-side polling fetch that drives the live battle viewer.

import type { BattleSummary } from './types'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

export async function fetchBattleSummary(battleId: string): Promise<BattleSummary | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/battle/summary?battle_id=${encodeURIComponent(battleId)}`,
      // 60 s keeps live-battle share previews fresh without a fetch on every hit.
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    return (await res.json()) as BattleSummary
  } catch {
    return null
  }
}
