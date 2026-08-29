import type { AttackLogEntry, DefenseComponentLog } from './types'

export type CombatEffectTone = 'danger' | 'warning' | 'support' | 'special' | 'neutral'

export interface CombatEffectBadge {
  key: string
  translationKey: string
  params?: Record<string, string | number>
  tone: CombatEffectTone
}

const SECONDARY_KEYS: Record<string, string> = {
  chain: 'secondaryChain',
  retaliation: 'secondaryRetaliation',
  aoe: 'secondaryAoe',
  ammo_splash: 'secondaryAmmoSplash',
}

export function secondaryAttackKind(attack: AttackLogEntry): string | undefined {
  return attack.secondary_kind || (attack.splash ? 'ammo_splash' : undefined)
}

export function secondaryAttackEffect(attack: AttackLogEntry): CombatEffectBadge | undefined {
  const kind = secondaryAttackKind(attack)
  if (!kind) return undefined
  const knownKey = SECONDARY_KEYS[kind]
  return {
    key: 'secondary',
    translationKey: knownKey ?? 'secondaryOther',
    params: knownKey ? undefined : { kind: kind.replaceAll('_', ' ') },
    tone: 'special',
  }
}

export function combatEffectBadges(attack: AttackLogEntry): CombatEffectBadge[] {
  const badges: CombatEffectBadge[] = []
  const add = (key: string, translationKey: string, tone: CombatEffectTone, params?: Record<string, string | number>) => {
    badges.push({ key, translationKey, params, tone })
  }
  const secondary = secondaryAttackEffect(attack)
  if (secondary) badges.push(secondary)

  if ((attack.ignored_resistance_pct ?? 0) > 0) add('resistance-bypass', 'resistanceBypass', 'special', { percent: attack.ignored_resistance_pct ?? 0 })
  if ((attack.armor_melt_applied_pct ?? 0) > 0) add('armor-melt', 'armorMelt', 'danger', { percent: attack.armor_melt_applied_pct ?? 0 })
  if ((attack.system_disable_ticks ?? 0) > 0) {
    add('system-disable', 'systemsDisabled', 'danger', { ticks: attack.system_disable_ticks ?? 0 })
  } else if (attack.disrupted) {
    add('disruption', 'systemsDisrupted', 'danger')
  }
  if ((attack.cpu_damage_pct ?? 0) > 0) add('cpu-damage', 'damageSuppression', 'danger', { percent: attack.cpu_damage_pct ?? 0 })
  if ((attack.dot_damage ?? 0) > 0 || (attack.dot_duration ?? 0) > 0) add('dot', 'damageOverTime', 'warning', { damage: attack.dot_damage ?? 0, ticks: attack.dot_duration ?? 0 })
  if ((attack.mine_duration ?? 0) > 0) add('mine', 'mineBurn', 'warning', { ticks: attack.mine_duration ?? 0 })
  if ((attack.aoe_radius ?? 0) > 0) add('aoe', 'areaRadius', 'special', { radius: attack.aoe_radius ?? 0 })
  if ((attack.chain_targets ?? 0) > 0) add('chain', attack.chain_targets === 1 ? 'chainsOne' : 'chainsMany', 'special', { count: attack.chain_targets ?? 0 })
  if ((attack.capacitor_drain ?? 0) > 0) add('capacitor-drain', 'capacitorDrain', 'danger', { amount: attack.capacitor_drain ?? 0 })
  if ((attack.shield_drained ?? 0) > 0 || (attack.shield_drain_requested ?? 0) > 0) {
    const requested = attack.shield_drain_requested ?? attack.shield_drained ?? 0
    const actual = attack.shield_drained ?? 0
    add('shield-drain', requested === actual ? 'shieldDrained' : 'shieldDrainedRequested', 'danger', { actual, requested })
  }
  if ((attack.shield_transferred ?? 0) > 0 || (attack.shield_transfer_pct ?? 0) > 0) {
    const amount = attack.shield_transferred ?? 0
    const percent = attack.shield_transfer_pct ?? 0
    add('shield-transfer', percent > 0 ? 'shieldTransferredPercent' : 'shieldTransferred', 'support', { amount, percent })
  }

  const lifestealHeal = (attack.defense_components ?? []).reduce((sum, component) => sum + (component.lifesteal_heal ?? 0), 0)
  if (lifestealHeal > 0) add('lifesteal', 'hullSiphoned', 'support', { amount: lifestealHeal })
  else if ((attack.lifesteal_pct ?? 0) > 0) add('lifesteal', 'lifesteal', 'support', { percent: attack.lifesteal_pct ?? 0 })

  if (attack.emergency_cloak_activated) {
    const duration = attack.emergency_cloak_duration ?? 0
    const strength = attack.emergency_cloak_strength ?? 0
    const translationKey = duration > 0 && strength > 0 ? 'emergencyCloakFull' : duration > 0 ? 'emergencyCloakDuration' : strength > 0 ? 'emergencyCloakStrength' : 'emergencyCloak'
    add('emergency-cloak', translationKey, 'support', { ticks: duration, strength })
  }

  return badges
}

export function componentLandedPercent(component: DefenseComponentLog): number {
  if (component.incoming_damage <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((component.final_damage / component.incoming_damage) * 100)))
}
