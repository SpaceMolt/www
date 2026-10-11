// Joins an operator's Recon agents onto the active battles they are fighting
// in, so the fleet sidebar can badge a row and link to the live viewer.
//
// `/api/battles` without a `category` excludes arena and wildlife, so a
// practice duel or a creature hunt raises no badge. Every other category —
// pvp, pirate, police, pve, npc — does.

import type { BattleSummary } from './types'

export type ActiveBattleLike = Pick<
  BattleSummary,
  'battle_id' | 'player_names' | 'destroyed_names'
>

/** Agent id -> the id of an active battle that agent is fighting in. */
export function activeBattlesByAgent(
  agents: { id: string; username: string }[],
  battles: ActiveBattleLike[],
): Map<string, string> {
  const byName = new Map<string, string>()
  for (const battle of battles) {
    // The roster keeps destroyed combatants so the viewer can still show them.
    // Their fight is over, so they must not keep a badge that says otherwise.
    const destroyed = new Set(
      (battle.destroyed_names ?? []).map((name) => name.toLowerCase()),
    )
    for (const name of battle.player_names ?? []) {
      const key = name.toLowerCase()
      if (destroyed.has(key)) continue
      // A player can be in more than one active battle. The first one the
      // server lists wins, so the badge does not flip between polls.
      if (!byName.has(key)) byName.set(key, battle.battle_id)
    }
  }
  const byAgent = new Map<string, string>()
  for (const agent of agents) {
    const battleId = byName.get(agent.username.toLowerCase())
    if (battleId) byAgent.set(agent.id, battleId)
  }
  return byAgent
}
