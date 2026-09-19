import type { AttackLogEntry } from './types'

export interface AttackVisualGroup {
  primaryIndex: number
  kind: string
  secondaryIndices: number[]
}

export interface AttackVisualPlan {
  primaryIndices: number[]
  orphanSecondaryIndices: number[]
  groups: AttackVisualGroup[]
}

function cascadingAttackKind(attack: AttackLogEntry): string {
  if (attack.secondary_kind === 'aoe' || attack.secondary_kind === 'chain' || attack.secondary_kind === 'ammo_splash') {
    return attack.secondary_kind
  }
  return attack.splash ? 'ammo_splash' : ''
}

/**
 * Associates the server's per-target secondary rows with the direct strike
 * that produced them. Current and historical logs append those rows directly
 * after their primary attack; the attacker check makes the fallback fail
 * closed if that ordering contract is ever broken.
 */
export function buildAttackVisualPlan(attacks: AttackLogEntry[]): AttackVisualPlan {
  const primaryIndices: number[] = []
  const orphanSecondaryIndices: number[] = []
  const groups: AttackVisualGroup[] = []
  const primaryByAttacker = new Map<string, number>()

  attacks.forEach((attack, index) => {
    const kind = cascadingAttackKind(attack)
    if (!kind) {
      primaryIndices.push(index)
      // Retaliation (and unknown future secondary effects) remains visible as
      // its own shot, but cannot displace the direct volley that subsequent
      // collateral rows name as their attacker.
      if (!attack.secondary_kind) primaryByAttacker.set(attack.attacker_id, index)
      return
    }
    const primaryIndex = primaryByAttacker.get(attack.attacker_id)
    if (primaryIndex === undefined) {
      orphanSecondaryIndices.push(index)
      return
    }
    const previous = groups[groups.length - 1]
    if (previous?.primaryIndex === primaryIndex && previous.kind === kind) previous.secondaryIndices.push(index)
    else groups.push({ primaryIndex, kind, secondaryIndices: [index] })
  })

  return { primaryIndices, orphanSecondaryIndices, groups }
}
