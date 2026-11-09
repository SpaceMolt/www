'use client'

import type { GetBaseResponse } from '@spacemolt/lib'
import fac from '../facilities/facilities.module.css'
import styles from './station.module.css'

const CONDITION_OK = new Set(['thriving', 'operational'])

function Row({ label, ok = true, title, children }: { label: string; ok?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <div className={fac.costRow} title={title}>
      <span className={fac.costLabel}>{label}</span>
      <span className={ok ? fac.costValue : fac.materialMissing}>{children}</span>
    </div>
  )
}

/** Hull, shield, condition, power, life support, repair bill and construction for the docked base. */
export function StationStatus({ data }: { data: GetBaseResponse }) {
  const { base, condition, power, life_support: life, repairs, construction } = data
  const building = [...(construction?.under_construction ?? []), ...(construction?.pending ?? [])]

  return (
    <>
      <div className={fac.costBreakdown}>
        <Row label="Hull" ok={!base.wrecked && base.hull >= base.max_hull}>
          {base.wrecked ? 'WRECKED' : `${base.hull}/${base.max_hull}`}
        </Row>
        {base.max_shield > 0 && <Row label="Shield" ok={base.shield >= base.max_shield}>{base.shield}/{base.max_shield}</Row>}
        {base.armor > 0 && <Row label="Armor">{base.armor}</Row>}
        {base.weapon_dps > 0 && <Row label="Defenses">{base.weapon_dps} dps, reach {base.weapon_reach}</Row>}
        <Row label="Condition" ok={CONDITION_OK.has(condition.condition)} title={condition.condition_text}>
          {condition.condition} ({condition.satisfied_count}/{condition.total_service_infra} supplied, {condition.satisfaction_pct}%)
        </Row>
        {power && (
          <Row label="Power" ok={power.supply >= power.current_draw} title={power.remediation}>
            draw {power.current_draw}/{power.supply}, battery {power.battery_stored}/{power.battery_capacity}, {Math.round(power.efficiency * 100)}% efficiency
          </Row>
        )}
        {life && (
          <Row label="Life Support" ok={life.supply >= life.demand && !life.starved?.length} title={life.remediation}>
            demand {life.demand}/{life.supply}, {life.plants} plant{life.plants === 1 ? '' : 's'}
          </Row>
        )}
        {data.faction_fuel_capacity != null && (
          <Row label="Fuel bunker">{data.faction_fuel_reserve ?? 0}/{data.faction_fuel_capacity}</Row>
        )}
      </div>

      {condition.condition_text && <div className={styles.hint}>{condition.condition_text}</div>}
      {power?.remediation && <div className={styles.hint}>{power.remediation}</div>}
      {life?.remediation && <div className={styles.hint}>{life.remediation}</div>}

      {repairs && (repairs.damaged_count > 0 || repairs.wrecked) && (
        <div className={fac.section}>
          <div className={fac.sectionHeader}>
            Repairs
            <span className={fac.sectionCount}>
              ({repairs.damaged_count} damaged, {repairs.repairing_count} repairing, {repairs.waiting_count} waiting)
            </span>
          </div>
          {repairs.remediation && <div className={styles.hint}>{repairs.remediation}</div>}
          {repairs.hull_missing != null && repairs.hull_missing > 0 && (
            <Row label="Hull to rebuild" ok={false}>{repairs.hull_missing} (needs {repairs.hull_required ?? '?'})</Row>
          )}
          {(repairs.materials ?? []).map((m) => (
            <Row key={m.item_id} label={m.name ?? m.item_id} ok={!m.quantity_missing}>
              {m.quantity_in_storage}/{m.quantity_required} in faction storage
            </Row>
          ))}
          {(repairs.facilities ?? []).map((f) => (
            <Row key={f.instance_id} label={f.name} ok={f.status !== 'waiting'}>
              {f.status}{f.ticks_until_complete != null ? `, ${f.ticks_until_complete} ticks` : ''}
            </Row>
          ))}
        </div>
      )}

      {building.length > 0 && (
        <div className={fac.section}>
          <div className={fac.sectionHeader}>
            Construction <span className={fac.sectionCount}>({building.length})</span>
          </div>
          {building.map((b) => (
            <Row key={`${b.definition_id}-${b.status}`} label={b.name} ok={!b.reason} title={b.reason}>
              {b.status}{b.ticks_until_complete != null ? `, ${b.ticks_until_complete} ticks` : ''}{b.reason ? ` (${b.reason})` : ''}
            </Row>
          ))}
        </div>
      )}
    </>
  )
}
