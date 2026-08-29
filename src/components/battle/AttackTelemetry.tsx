'use client'

import { Activity, ArrowRight, Crosshair, ShieldCheck, Sparkles } from 'lucide-react'
import { combatEffectBadges, componentLandedPercent } from '@/lib/battle/combatTelemetry'
import { damageTypeColor, type AttackLogEntry } from '@/lib/battle/types'
import styles from './BattleViewer.module.css'

interface Props {
  attack: AttackLogEntry
  compact?: boolean
}

export default function AttackTelemetry({ attack, compact = false }: Props) {
  const effects = combatEffectBadges(attack)
  const components = attack.defense_components ?? []

  return (
    <div className={`${styles.attackTelemetry} ${compact ? styles.attackTelemetryCompact : ''}`}>
      <div className={styles.telemetryMetrics}>
        <span title="Chance to hit and server roll">
          <Crosshair size={11} aria-hidden /> {Math.round(attack.hit_chance * 100)}%
          <small> roll {Math.round(attack.hit_roll * 100)}</small>
        </span>
        {attack.hit_success && (
          <>
            <span title="Raw volley, pre-hit volley, and authoritative final damage">
              <Activity size={11} aria-hidden />
              {attack.pre_hit_damage > 0 ? (
                <>
                  {attack.raw_damage > 0 && attack.raw_damage !== attack.pre_hit_damage ? (
                    <>{attack.raw_damage}<small>raw</small><ArrowRight size={10} aria-hidden /></>
                  ) : null}
                  {attack.pre_hit_damage}<small>pre-hit</small>
                  <ArrowRight size={10} aria-hidden />
                  <b>{attack.final_damage} final</b>
                </>
              ) : (
                <b>{attack.final_damage} final</b>
              )}
            </span>
            <span title="Shield and hull damage">
              <ShieldCheck size={11} aria-hidden /> {attack.shield_damage} shd / {attack.hull_damage} hull
            </span>
          </>
        )}
      </div>

      <AttackModifiers attack={attack} hasComponents={components.length > 0} />

      {effects.length > 0 && (
        <div className={styles.effectBadges} aria-label="Triggered combat effects">
          {effects.map(effect => (
            <span key={effect.key} className={`${styles.effectBadge} ${styles[`effectTone${capitalize(effect.tone)}`]}`}>
              <Sparkles size={9} aria-hidden /> {effect.label}
            </span>
          ))}
        </div>
      )}

      {!compact && attack.weapons?.length > 0 && (
        <div className={styles.telemetryWeapons}>
          {attack.weapons.map(weapon => (
            <div key={weapon.instance_id || `${weapon.name}-${weapon.damage_type}`} className={styles.telemetryWeaponRow}>
              <div className={styles.telemetryWeaponMain}>
                <span>
                  <i style={{ background: damageTypeColor(weapon.damage_type) }} />
                  {weapon.name}
                  {weapon.crit_fired && <b className={styles.criticalTag}>CRIT</b>}
                </span>
                <span>
                  {weapon.base_damage !== weapon.damage ? `${weapon.base_damage} → ` : ''}
                  <b>{weapon.damage}</b> {weapon.damage_type}
                  {weapon.ammo_used ? ` · ${weapon.ammo_used}` : ''}
                </span>
              </div>
              {(weapon.after_disruption !== weapon.base_damage || weapon.type_bonus_pct !== 0 || weapon.crit_chance > 0 || (weapon.ammo_mod !== undefined && weapon.ammo_mod !== 1)) && (
                <div className={styles.telemetryWeaponMeta}>
                  {weapon.after_disruption !== weapon.base_damage && <span>disruption {weapon.base_damage} → {weapon.after_disruption}</span>}
                  {weapon.type_bonus_pct !== 0 && <span>type bonus {signedPercent(weapon.type_bonus_pct)}</span>}
                  {weapon.crit_chance > 0 && <span>crit {Math.round(weapon.crit_chance * 100)}% / roll {Math.round(weapon.crit_roll * 100)}</span>}
                  {weapon.ammo_mod !== undefined && weapon.ammo_mod !== 1 && <span>ammo ×{weapon.ammo_mod.toFixed(2)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {components.length > 0 && (
        <div className={styles.mitigationStack}>
          <div className={styles.mitigationHeading}>TARGET MITIGATION · SERVER RESOLVED</div>
          {components.map((component, index) => (
            <div key={component.weapon_instance_id || `${component.weapon_name}-${index}`} className={styles.mitigationRow}>
              <div className={styles.mitigationIdentity}>
                <i style={{ background: damageTypeColor(component.damage_type) }} />
                <span>{component.weapon_name}</span>
                <b>{componentLandedPercent(component)}% landed</b>
              </div>
              <div className={styles.mitigationPipeline}>
                <span>{component.incoming_damage}<small>IN</small></span>
                <ArrowRight size={9} aria-hidden />
                <span>{component.after_shield_resist}<small>SHD {component.shield_resist_pct}%</small></span>
                <ArrowRight size={9} aria-hidden />
                <span>{component.after_type_resist}<small>{component.damage_type.toUpperCase()} {component.type_resist_pct}%</small></span>
                <ArrowRight size={9} aria-hidden />
                <span>{component.after_flat_reduction}<small>FLAT {component.flat_reduction_pct}%</small></span>
                <ArrowRight size={9} aria-hidden />
                <span className={styles.mitigationFinal}>{component.final_damage}<small>FINAL</small></span>
              </div>
              {(component.shield_bypass_pct > 0 || component.armor_bypass_pct > 0 || (component.ignored_resistance_pct ?? 0) > 0 || component.ignore_all_defense) && (
                <div className={styles.mitigationFlags}>
                  {component.ignore_all_defense && <span>defenses ignored</span>}
                  {component.shield_bypass_pct > 0 && <span>{component.shield_bypass_pct}% shield bypass</span>}
                  {component.armor_bypass_pct > 0 && <span>{component.armor_bypass_pct}% armor bypass</span>}
                  {(component.ignored_resistance_pct ?? 0) > 0 && <span>{component.ignored_resistance_pct}% resist bypass</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AttackModifiers({ attack, hasComponents }: { attack: AttackLogEntry; hasComponents: boolean }) {
  const modifiers = [
    attack.weapon_skill_pct ? `weapon skill ${signedPercent(attack.weapon_skill_pct)}` : '',
    attack.capital_bonus_pct ? `capital ${signedPercent(attack.capital_bonus_pct)}` : '',
    attack.off_buff_pct ? `offense ${signedPercent(attack.off_buff_pct)}` : '',
    attack.stance_mult && attack.stance_mult !== 1 ? `stance ×${attack.stance_mult.toFixed(2)}` : '',
    attack.def_buff_pct ? `defense buff −${attack.def_buff_pct}%` : '',
    !hasComponents && attack.shield_resist_pct ? `shield resist ${attack.shield_resist_pct}%` : '',
    !hasComponents && attack.type_resist_pct ? `type resist ${attack.type_resist_pct}%` : '',
    !hasComponents && attack.flat_reduction_pct ? `flat reduction ${attack.flat_reduction_pct}%` : '',
  ].filter(Boolean)

  if (modifiers.length === 0) return null
  return <div className={styles.telemetryModifiers}>{modifiers.map(modifier => <span key={modifier}>{modifier}</span>)}</div>
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`
}
