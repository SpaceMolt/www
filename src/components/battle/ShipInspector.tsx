'use client'

import styles from './BattleViewer.module.css'
import { useTranslation } from '@/i18n'
import { damageTypeColor } from '@/lib/battle/types'
import type { BattleTimeline } from '@/lib/battle/timeline'

interface Props {
  timeline: BattleTimeline
  participantId: string
  tickIndex: number
  onClose: () => void
}

/**
 * Detail drawer for the selected ship at the current playhead: status, HP,
 * fitted modules with ammo, and the most recent volley with its full hit
 * math (chance vs roll, crits, per-weapon damage).
 */
export default function ShipInspector({ timeline, participantId, tickIndex, onClose }: Props) {
  const { t } = useTranslation()
  const meta = timeline.participants.get(participantId)
  if (!meta) return null

  const snap =
    timeline.snapshotAt[tickIndex]?.get(participantId) ??
    timeline.snapshotAt[Math.min(meta.lastTickIndex, tickIndex)]?.get(participantId)

  // Most recent volley fired by this ship at or before the playhead.
  let lastAttack = null
  let lastAttackTick = -1
  for (let i = tickIndex; i >= 0 && i >= tickIndex - 20; i--) {
    const found = (timeline.entries[i].attacks ?? []).find(a => a.attacker_id === participantId && !a.splash)
    if (found) {
      lastAttack = found
      lastAttackTick = i
      break
    }
  }

  const statusBadges: { label: string; color: string }[] = []
  if (!meta.armed) statusBadges.push({ label: 'UNARMED', color: '#6b8fa3' })
  if (snap) {
    if ((snap.disruption_ticks ?? 0) > 0) statusBadges.push({ label: `⚡ disrupted ${snap.disruption_ticks}t`, color: '#9b59b6' })
    if ((snap.burn_ticks ?? 0) > 0) statusBadges.push({ label: `🔥 burning ${snap.burn_damage_per_tick}/t ×${snap.burn_ticks}`, color: '#ff9551' })
    if ((snap.armor_melt_ticks ?? 0) > 0) statusBadges.push({ label: `🫠 armor melt −${snap.armor_melt_pct}%`, color: '#e63946' })
  }

  return (
    <div className={styles.inspector} style={{ '--side-color': meta.color } as React.CSSProperties}>
      <div className={styles.inspectorHeader}>
        <div>
          <span className={styles.inspectorName}>{meta.name}</span>
          <span className={styles.inspectorClass}>
            {meta.shipClassName}
            {meta.shipClass ? ` · ${meta.shipClass}` : ''}
          </span>
        </div>
        <button className={styles.inspectorClose} onClick={onClose} aria-label="Close inspector">
          ✕
        </button>
      </div>

      {snap ? (
        <>
          <div className={styles.inspectorStats}>
            <span>
              {t('battles.zone')} <b>{snap.zone}</b>
            </span>
            <span>
              {t('battles.stance')} <b>{snap.stance}</b>
            </span>
            {snap.target_id && (
              <span>
                {t('battles.target')} <b>{timeline.names.get(snap.target_id) ?? snap.target_id.slice(0, 8)}</b>
              </span>
            )}
            <span>
              {t('battles.dealt')} <b>{snap.damage_dealt.toLocaleString()}</b>
            </span>
            <span>
              {t('battles.taken')} <b>{snap.damage_taken.toLocaleString()}</b>
            </span>
            {snap.kill_count > 0 && (
              <span>
                {t('battles.kills')} <b>{snap.kill_count}</b>
              </span>
            )}
          </div>

          {snap.max_shield > 0 && (
            <InspectorBar label="SHD" value={snap.shield} max={snap.max_shield} color="#4dabf7" />
          )}
          <InspectorBar
            label="HULL"
            value={snap.hull}
            max={snap.max_hull}
            color={snap.hull / snap.max_hull > 0.55 ? '#2dd4bf' : snap.hull / snap.max_hull > 0.25 ? '#ffd93d' : '#e63946'}
          />
          {snap.max_fuel > 0 && <InspectorBar label="FUEL" value={snap.fuel} max={snap.max_fuel} color="#a8c5d6" />}

          {statusBadges.length > 0 && (
            <div className={styles.inspectorBadges}>
              {statusBadges.map((b, i) => (
                <span key={i} className={styles.inspectorBadge} style={{ borderColor: b.color, color: b.color }}>
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {snap.modules && snap.modules.length > 0 && (
            <div className={styles.inspectorSection}>
              <div className={styles.inspectorSectionTitle}>{t('battles.loadout')}</div>
              {snap.modules.map((m, i) => (
                <div key={i} className={styles.moduleRow}>
                  <span className={styles.moduleName}>{m.name}</span>
                  {m.magazine_size ? (
                    <span className={styles.moduleAmmo}>
                      {m.loaded_ammo ? `${m.loaded_ammo} · ` : ''}
                      {m.current_ammo}/{m.magazine_size}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={styles.inspectorStats}>
          {meta.fate === 'destroyed' ? (meta.killedBy ? t('battles.destroyedBy', { killer: meta.killedBy }) : t('battles.destroyed')) : meta.fate === 'escaped' ? t('battles.escapedToWarp') : t('battles.onTheField')}
        </div>
      )}

      {lastAttack && (
        <div className={styles.inspectorSection}>
          <div className={styles.inspectorSectionTitle}>
            {t('battles.lastVolley')} · {t('battles.tickShort')} {lastAttackTick + 1} → {timeline.names.get(lastAttack.target_id) ?? '?'}
          </div>
          {lastAttack.weapons?.map((w, i) => (
            <div key={i} className={styles.moduleRow}>
              <span className={styles.moduleName}>
                <span className={styles.dot} style={{ background: damageTypeColor(w.damage_type) }} /> {w.name}
                {w.crit_fired ? ' ✦' : ''}
              </span>
              <span className={styles.moduleAmmo}>
                {w.damage} {w.damage_type}
                {w.ammo_used ? ` · ${w.ammo_used}` : ''}
              </span>
            </div>
          ))}
          <div className={styles.hitMath}>
            {lastAttack.hit_success ? (
              <>
                {t('battles.hit')} — {Math.round(lastAttack.hit_chance * 100)}% chance, rolled {Math.round(lastAttack.hit_roll * 100)} ·{' '}
                {lastAttack.final_damage} dmg ({lastAttack.shield_damage} shd / {lastAttack.hull_damage} hull)
              </>
            ) : (
              <>
                {t('battles.miss')} — {Math.round(lastAttack.hit_chance * 100)}% chance, rolled {Math.round(lastAttack.hit_roll * 100)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InspectorBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className={styles.inspectorBarRow}>
      <span className={styles.inspectorBarLabel}>{label}</span>
      <span className={styles.inspectorBarTrack}>
        <span style={{ width: `${frac * 100}%`, background: color }} />
      </span>
      <span className={styles.inspectorBarValue}>
        {value}/{max}
      </span>
    </div>
  )
}
