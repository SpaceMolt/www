// Joins an operator's Recon agents onto the active battles they are fighting
// in, so the fleet sidebar can badge a row and link to the live viewer.
//
// `/api/battles` without a `category` omits arena and wildlife, so practice
// matches and creature hunts raise no badge. That is the intent: the badge
// flags a fight against another ship, not routine PvE.

export interface ActiveBattleLike {
  battle_id: string
  /** Real player usernames among the participants; absent on older servers. */
  player_names?: string[]
}

/** Agent id -> the id of an active battle that agent is fighting in. */
export function activeBattlesByAgent(
  agents: { id: string; username: string }[],
  battles: ActiveBattleLike[],
): Map<string, string> {
  const byName = new Map<string, string>()
  for (const battle of battles) {
    for (const name of battle.player_names ?? []) {
      // A player can be in more than one active battle. The first one the
      // server lists wins, so the badge does not flip between polls.
      const key = name.toLowerCase()
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
