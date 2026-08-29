'use client'

import { Activity, ArrowRight, Crosshair, ShieldCheck, Sparkles } from 'lucide-react'
import { combatEffectBadges, componentLandedPercent } from '@/lib/battle/combatTelemetry'
import { damageTypeColor, type AttackLogEntry } from '@/lib/battle/types'
import { useTranslation } from '@/i18n'
import styles from './BattleViewer.module.css'

interface Props {
  attack: AttackLogEntry
  compact?: boolean
}

export default function AttackTelemetry({ attack, compact = false }: Props) {
  const { t } = useTranslation()
  const effects = combatEffectBadges(attack)
  const components = attack.defense_components ?? []

  return (
    <div className={`${styles.attackTelemetry} ${compact ? styles.attackTelemetryCompact : ''}`}>
      <div className={styles.telemetryMetrics}>
        <span title={t('battles.telemetry.chanceTitle')}>
          <Crosshair size={11} aria-hidden /> {Math.round(attack.hit_chance * 100)}%
          <small> {t('battles.telemetry.roll')} {Math.round(attack.hit_roll * 100)}</small>
        </span>
        {attack.hit_success && (
          <>
            <span title={t('battles.telemetry.damageFlowTitle')}>
              <Activity size={11} aria-hidden />
              {attack.pre_hit_damage > 0 ? (
                <>
                  {attack.raw_damage > 0 && attack.raw_damage !== attack.pre_hit_damage ? (
                    <>{attack.raw_damage}<small>{t('battles.telemetry.raw')}</small><ArrowRight size={10} aria-hidden /></>
                  ) : null}
                  {attack.pre_hit_damage}<small>{t('battles.telemetry.preHit')}</small>
                  <ArrowRight size={10} aria-hidden />
                  <b>{attack.final_damage} {t('battles.telemetry.final')}</b>
                </>
              ) : (
                <b>{attack.final_damage} {t('battles.telemetry.final')}</b>
              )}
            </span>
            <span title={t('battles.telemetry.shieldHullTitle')}>
              <ShieldCheck size={11} aria-hidden /> {attack.shield_damage} {t('battles.telemetry.shieldShort')} / {attack.hull_damage} {t('battles.telemetry.hull')}
            </span>
          </>
        )}
      </div>

      <AttackModifiers attack={attack} hasComponents={components.length > 0} />

      {effects.length > 0 && (
        <div className={styles.effectBadges} aria-label={t('battles.telemetry.effectsAria')}>
          {effects.map(effect => (
            <span key={effect.key} className={`${styles.effectBadge} ${styles[`effectTone${capitalize(effect.tone)}`]}`}>
              <Sparkles size={9} aria-hidden /> {t(`battles.telemetry.effect.${effect.translationKey}`, effect.params)}
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
                  {weapon.crit_fired && <b className={styles.criticalTag}>{t('battles.telemetry.critical')}</b>}
                </span>
                <span>
                  {weapon.base_damage !== weapon.damage ? `${weapon.base_damage} → ` : ''}
                  <b>{weapon.damage}</b> {weapon.damage_type}
                  {weapon.ammo_used ? ` · ${weapon.ammo_used}` : ''}
                </span>
              </div>
              {(weapon.after_disruption !== weapon.base_damage || weapon.type_bonus_pct !== 0 || weapon.crit_chance > 0 || (weapon.ammo_mod !== undefined && weapon.ammo_mod !== 1)) && (
                <div className={styles.telemetryWeaponMeta}>
                  {weapon.after_disruption !== weapon.base_damage && <span>{t('battles.telemetry.weaponDisruption')} {weapon.base_damage} → {weapon.after_disruption}</span>}
                  {weapon.type_bonus_pct !== 0 && <span>{t('battles.telemetry.typeBonus')} {signedPercent(weapon.type_bonus_pct)}</span>}
                  {weapon.crit_chance > 0 && <span>{t('battles.telemetry.criticalRoll', { chance: Math.round(weapon.crit_chance * 100), roll: Math.round(weapon.crit_roll * 100) })}</span>}
                  {weapon.ammo_mod !== undefined && weapon.ammo_mod !== 1 && <span>{t('battles.telemetry.ammoMultiplier')} ×{weapon.ammo_mod.toFixed(2)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {components.length > 0 && (
        <div className={styles.mitigationStack}>
          <div className={styles.mitigationHeading}>{t('battles.telemetry.mitigationHeading')}</div>
          {components.map((component, index) => (
            <div key={component.weapon_instance_id || `${component.weapon_name}-${index}`} className={styles.mitigationRow}>
              <div className={styles.mitigationIdentity}>
                <i style={{ background: damageTypeColor(component.damage_type) }} />
                <span>{component.weapon_name}</span>
                <b>{componentLandedPercent(component)}% {t('battles.telemetry.landed')}</b>
              </div>
              <div className={styles.mitigationPipeline}>
                <span>{component.incoming_damage}<small>{t('battles.telemetry.incomingShort')}</small></span>
                <ArrowRight size={9} aria-hidden />
                <span>{component.after_shield_resist}<small>{t('battles.telemetry.shieldShort')} {component.shield_resist_pct}%</small></span>
                <ArrowRight size={9} aria-hidden />
                <span>{component.after_type_resist}<small>{component.damage_type.toUpperCase()} {component.type_resist_pct}%</small></span>
                <ArrowRight size={9} aria-hidden />
                <span>{component.after_flat_reduction}<small>{t('battles.telemetry.flatShort')} {component.flat_reduction_pct}%</small></span>
                <ArrowRight size={9} aria-hidden />
                <span className={styles.mitigationFinal}>{component.final_damage}<small>{t('battles.telemetry.final')}</small></span>
              </div>
              {(component.shield_bypass_pct > 0 || component.armor_bypass_pct > 0 || (component.ignored_resistance_pct ?? 0) > 0 || component.ignore_all_defense) && (
                <div className={styles.mitigationFlags}>
                  {component.ignore_all_defense && <span>{t('battles.telemetry.defensesIgnored')}</span>}
                  {component.shield_bypass_pct > 0 && <span>{t('battles.telemetry.shieldBypass', { percent: component.shield_bypass_pct })}</span>}
                  {component.armor_bypass_pct > 0 && <span>{t('battles.telemetry.armorBypass', { percent: component.armor_bypass_pct })}</span>}
                  {(component.ignored_resistance_pct ?? 0) > 0 && <span>{t('battles.telemetry.resistanceBypass', { percent: component.ignored_resistance_pct ?? 0 })}</span>}
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
  const { t } = useTranslation()
  const modifiers = [
    attack.weapon_skill_pct ? t('battles.telemetry.weaponSkill', { value: signedPercent(attack.weapon_skill_pct) }) : '',
    attack.capital_bonus_pct ? t('battles.telemetry.capitalBonus', { value: signedPercent(attack.capital_bonus_pct) }) : '',
    attack.off_buff_pct ? t('battles.telemetry.offense', { value: signedPercent(attack.off_buff_pct) }) : '',
    attack.stance_mult && attack.stance_mult !== 1 ? t('battles.telemetry.stanceMultiplier', { value: attack.stance_mult.toFixed(2) }) : '',
    attack.def_buff_pct ? t('battles.telemetry.defenseBuff', { value: attack.def_buff_pct }) : '',
    !hasComponents && attack.shield_resist_pct ? t('battles.telemetry.shieldResist', { value: attack.shield_resist_pct }) : '',
    !hasComponents && attack.type_resist_pct ? t('battles.telemetry.typeResist', { value: attack.type_resist_pct }) : '',
    !hasComponents && attack.flat_reduction_pct ? t('battles.telemetry.flatReduction', { value: attack.flat_reduction_pct }) : '',
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
