import { describe, expect, it } from 'bun:test'
import { combatEffectBadges, componentLandedPercent, secondaryAttackLabel } from './combatTelemetry'
import type { AttackLogEntry, DefenseComponentLog } from './types'

function attack(overrides: Partial<AttackLogEntry> = {}): AttackLogEntry {
  return {
    attacker_id: 'attacker',
    target_id: 'target',
    zone_distance: 1,
    weapons: [],
    raw_damage: 100,
    weapon_skill_pct: 0,
    pre_hit_damage: 100,
    hit_chance: 0.8,
    hit_roll: 0.2,
    hit_success: true,
    final_damage: 40,
    shield_damage: 30,
    hull_damage: 10,
    damage_type: 'em',
    ...overrides,
  }
}

describe('combat telemetry', () => {
  it('surfaces every additive battle effect reported by current servers', () => {
    const badges = combatEffectBadges(attack({
      ignored_resistance_pct: 25,
      armor_melt_applied_pct: 20,
      system_disable_ticks: 3,
      cpu_damage_pct: 15,
      dot_damage: 8,
      dot_duration: 5,
      mine_duration: 4,
      aoe_radius: 2,
      chain_targets: 2,
      capacitor_drain: 30,
      shield_drain_requested: 30,
      shield_drained: 18,
      shield_transfer_pct: 50,
      shield_transferred: 9,
      emergency_cloak_activated: true,
      emergency_cloak_duration: 10,
      emergency_cloak_strength: 4,
      defense_components: [{ lifesteal_heal: 7 } as DefenseComponentLog],
    }))

    expect(badges.map(badge => badge.key)).toEqual([
      'resistance-bypass',
      'armor-melt',
      'system-disable',
      'cpu-damage',
      'dot',
      'mine',
      'aoe',
      'chain',
      'capacitor-drain',
      'shield-drain',
      'shield-transfer',
      'lifesteal',
      'emergency-cloak',
    ])
    expect(badges.find(badge => badge.key === 'shield-drain')?.label).toBe('Shield drained 18/30')
    expect(badges.find(badge => badge.key === 'lifesteal')?.label).toBe('7 hull siphoned')
    expect(badges.find(badge => badge.key === 'shield-transfer')?.label).toBe('9 shield transferred · 50%')
    expect(badges.find(badge => badge.key === 'capacitor-drain')?.label).toBe('Capacitor drain · up to 30')
  })

  it('labels every secondary hit kind and supports old splash logs', () => {
    expect(secondaryAttackLabel(attack({ secondary_kind: 'chain' }))).toBe('Chain arc')
    expect(secondaryAttackLabel(attack({ secondary_kind: 'retaliation' }))).toBe('Retaliation')
    expect(secondaryAttackLabel(attack({ secondary_kind: 'aoe' }))).toBe('Area strike')
    expect(secondaryAttackLabel(attack({ splash: true }))).toBe('Ammo splash')
  })

  it('reports the actual share landed without misclassifying overkill as mitigation', () => {
    expect(componentLandedPercent({ incoming_damage: 100, final_damage: 31 } as DefenseComponentLog)).toBe(31)
    expect(componentLandedPercent({ incoming_damage: 100, final_damage: 10 } as DefenseComponentLog)).toBe(10)
    expect(componentLandedPercent({ incoming_damage: 0, final_damage: 0 } as DefenseComponentLog)).toBe(0)
  })
})
