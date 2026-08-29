import { describe, expect, it } from 'bun:test'
import { combatEffectBadges, componentLandedPercent, secondaryAttackEffect, secondaryAttackKind } from './combatTelemetry'
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

function defenseComponent(overrides: Partial<DefenseComponentLog> = {}): DefenseComponentLog {
  return {
    weapon_instance_id: 'weapon-1',
    weapon_name: 'Test Cannon',
    damage_type: 'kinetic',
    incoming_damage: 100,
    shield_resist_pct: 0,
    after_shield_resist: 100,
    type_resist_pct: 0,
    after_type_resist: 100,
    flat_reduction_pct: 0,
    after_flat_reduction: 100,
    shield_bypass_pct: 0,
    armor_bypass_pct: 0,
    ignore_all_defense: false,
    final_damage: 100,
    shield_damage: 100,
    hull_damage: 0,
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
      defense_components: [defenseComponent({ lifesteal_heal: 7 })],
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
    expect(badges.find(badge => badge.key === 'shield-drain')).toMatchObject({ translationKey: 'shieldDrainedRequested', params: { actual: 18, requested: 30 } })
    expect(badges.find(badge => badge.key === 'lifesteal')).toMatchObject({ translationKey: 'hullSiphoned', params: { amount: 7 } })
    expect(badges.find(badge => badge.key === 'shield-transfer')).toMatchObject({ translationKey: 'shieldTransferredPercent', params: { amount: 9, percent: 50 } })
    expect(badges.find(badge => badge.key === 'capacitor-drain')).toMatchObject({ translationKey: 'capacitorDrain', params: { amount: 30 } })
  })

  it('labels every secondary hit kind and supports old splash logs', () => {
    expect(secondaryAttackEffect(attack({ secondary_kind: 'chain' }))?.translationKey).toBe('secondaryChain')
    expect(secondaryAttackEffect(attack({ secondary_kind: 'retaliation' }))?.translationKey).toBe('secondaryRetaliation')
    expect(secondaryAttackEffect(attack({ secondary_kind: 'aoe' }))?.translationKey).toBe('secondaryAoe')
    expect(secondaryAttackEffect(attack({ splash: true }))?.translationKey).toBe('secondaryAmmoSplash')
    expect(secondaryAttackKind(attack({ secondary_kind: 'future_effect' }))).toBe('future_effect')
  })

  it('reports the actual share landed without misclassifying overkill as mitigation', () => {
    expect(componentLandedPercent(defenseComponent({ incoming_damage: 100, final_damage: 31 }))).toBe(31)
    expect(componentLandedPercent(defenseComponent({ incoming_damage: 100, final_damage: 10 }))).toBe(10)
    expect(componentLandedPercent(defenseComponent({ incoming_damage: 0, final_damage: 0 }))).toBe(0)
  })
})
