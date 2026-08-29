import type { AttackLogEntry, DefenseComponentLog } from './types'

export type CombatEffectTone = 'danger' | 'warning' | 'support' | 'special' | 'neutral'

export interface CombatEffectBadge {
  key: string
  label: string
  tone: CombatEffectTone
}

const SECONDARY_LABELS: Record<string, string> = {
  chain: 'Chain arc',
  retaliation: 'Retaliation',
  aoe: 'Area strike',
  ammo_splash: 'Ammo splash',
}

export function secondaryAttackLabel(attack: AttackLogEntry): string | undefined {
  const kind = attack.secondary_kind || (attack.splash ? 'ammo_splash' : '')
  if (!kind) return undefined
  return SECONDARY_LABELS[kind] ?? kind.replaceAll('_', ' ')
}

export function combatEffectBadges(attack: AttackLogEntry): CombatEffectBadge[] {
  const badges: CombatEffectBadge[] = []
  const add = (key: string, label: string, tone: CombatEffectTone) => badges.push({ key, label, tone })
  const secondary = secondaryAttackLabel(attack)
  if (secondary) add('secondary', secondary, 'special')

  if ((attack.ignored_resistance_pct ?? 0) > 0) {
    add('resistance-bypass', `${attack.ignored_resistance_pct}% resistance bypass`, 'special')
  }
  if ((attack.armor_melt_applied_pct ?? 0) > 0) {
    add('armor-melt', `${attack.armor_melt_applied_pct}% armor melt`, 'danger')
  }
  if ((attack.system_disable_ticks ?? 0) > 0) {
    add('system-disable', `Systems disabled ${attack.system_disable_ticks}t`, 'danger')
  } else if (attack.disrupted) {
    add('disruption', 'Systems disrupted', 'danger')
  }
  if ((attack.cpu_damage_pct ?? 0) > 0) {
    add('cpu-damage', `${attack.cpu_damage_pct}% damage suppression`, 'danger')
  }
  if ((attack.dot_damage ?? 0) > 0 || (attack.dot_duration ?? 0) > 0) {
    add('dot', `${attack.dot_damage ?? 0}/t damage-over-time · ${attack.dot_duration ?? 0}t`, 'warning')
  }
  if ((attack.mine_duration ?? 0) > 0) {
    add('mine', `Mine burn · ${attack.mine_duration}t`, 'warning')
  }
  if ((attack.aoe_radius ?? 0) > 0) {
    add('aoe', `Area radius ${attack.aoe_radius}`, 'special')
  }
  if ((attack.chain_targets ?? 0) > 0) {
    add('chain', `Chains to ${attack.chain_targets} target${attack.chain_targets === 1 ? '' : 's'}`, 'special')
  }
  if ((attack.capacitor_drain ?? 0) > 0) {
    add('capacitor-drain', `Capacitor drain · up to ${attack.capacitor_drain}`, 'danger')
  }
  if ((attack.shield_drained ?? 0) > 0 || (attack.shield_drain_requested ?? 0) > 0) {
    const requested = attack.shield_drain_requested ?? attack.shield_drained ?? 0
    const actual = attack.shield_drained ?? 0
    add('shield-drain', `Shield drained ${actual}${requested !== actual ? `/${requested}` : ''}`, 'danger')
  }
  if ((attack.shield_transferred ?? 0) > 0 || (attack.shield_transfer_pct ?? 0) > 0) {
    const amount = attack.shield_transferred ?? 0
    const pct = attack.shield_transfer_pct ?? 0
    add('shield-transfer', `${amount} shield transferred${pct > 0 ? ` · ${pct}%` : ''}`, 'support')
  }

  const lifestealHeal = (attack.defense_components ?? []).reduce((sum, component) => sum + (component.lifesteal_heal ?? 0), 0)
  if (lifestealHeal > 0) {
    add('lifesteal', `${lifestealHeal} hull siphoned`, 'support')
  } else if ((attack.lifesteal_pct ?? 0) > 0) {
    add('lifesteal', `${attack.lifesteal_pct}% lifesteal`, 'support')
  }

  if (attack.emergency_cloak_activated) {
    const detail = [
      attack.emergency_cloak_duration ? `${attack.emergency_cloak_duration}t` : '',
      attack.emergency_cloak_strength ? `strength ${attack.emergency_cloak_strength}` : '',
    ].filter(Boolean).join(' · ')
    add('emergency-cloak', `Emergency cloak${detail ? ` · ${detail}` : ''}`, 'support')
  }

  return badges
}

export function componentLandedPercent(component: DefenseComponentLog): number {
  if (component.incoming_damage <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((component.final_damage / component.incoming_damage) * 100)))
}
