// Server-side fetch of a single battle summary, used by the battle detail
// page's generateMetadata and its opengraph-image. See useBattleData.ts for
// the client-side polling fetch that drives the live battle viewer.

import type { BattleSummary } from './types'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

export async function fetchBattleSummary(battleId: string): Promise<BattleSummary | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/battle/summary?battle_id=${encodeURIComponent(battleId)}`,
      // Only generateMetadata and opengraph-image read this, and a finished
      // battle's summary is immutable. The live viewer polls client-side.
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return null
    return (await res.json()) as BattleSummary
  } catch {
    return null
  }
}
