'use client'

import type { GetBaseResponse } from '@spacemolt/lib'
import { Info } from 'lucide-react'
import fac from '../facilities/facilities.module.css'
import styles from './station.module.css'
import { formatItemId } from '@/data/catalog'
import { titleCase } from '@/lib/format'

const CONDITION_OK = new Set(['thriving', 'operational'])
const fmt = (n: number) => n.toLocaleString()
const ratio = (have: number, max: number) => `${fmt(have)}/${fmt(max)}`
const ticks = (n?: number) => (n != null ? ` · ${fmt(n)}t` : '')

export function Row({ label, ok = true, title, children }: { label: string; ok?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <div className={fac.costRow} title={title}>
      <span className={fac.costLabel}>{label}</span>
      <span className={ok ? fac.costValue : styles.bad}>{children}</span>
    </div>
  )
}

/** Advice text from the server, one short note per line. */
function Notes({ notes }: { notes: (string | undefined)[] }) {
  const shown = notes.filter(Boolean)
  if (!shown.length) return null
  return (
    <div className={styles.notes}>
      {shown.map((n) => <div key={n} className={styles.note}><Info size={11} />{n}</div>)}
    </div>
  )
}

/** Item chips with a count, for per-cycle inputs and repair materials. */
function Chips({ title, items, ok = true }: { title: string; items?: { id: string; name: string; value: string; ok?: boolean }[]; ok?: boolean }) {
  if (!items?.length) return null
  return (
    <div className={styles.chipBlock}>
      <span className={styles.chipTitle}>{title}</span>
      <div className={styles.chips}>
        {items.map((i) => (
          <span key={i.id} className={`${styles.chip} ${(i.ok ?? ok) ? '' : styles.chipBad}`}>
            {i.name}<b>{i.value}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

const perCycle = (items?: { item_id: string; name?: string; quantity_per_cycle: number }[]) =>
  items?.map((i) => ({ id: i.item_id, name: i.name ?? formatItemId(i.item_id), value: `×${fmt(i.quantity_per_cycle)}` }))

/** Hull, shield, condition, power, life support, repair bill and construction for the docked base. */
export function StationStatus({ data }: { data: GetBaseResponse }) {
  const { base, condition, power, life_support: life, repairs, construction } = data
  const building = [...(construction?.under_construction ?? []), ...(construction?.pending ?? [])]
  const powerOk = !power || power.supply >= power.current_draw

  return (
    <>
      <div className={fac.costBreakdown}>
        <Row label="Hull" ok={!base.wrecked && base.hull >= base.max_hull}>
          {base.wrecked ? 'Wrecked' : ratio(base.hull, base.max_hull)}
        </Row>
        {base.max_shield > 0 && <Row label="Shield" ok={base.shield >= base.max_shield}>{ratio(base.shield, base.max_shield)}</Row>}
        {base.armor > 0 && <Row label="Armor">{fmt(base.armor)}</Row>}
        {base.weapon_dps > 0 && <Row label="Defenses">{fmt(base.weapon_dps)} dps · reach {base.weapon_reach}</Row>}
        <Row label="Condition" ok={CONDITION_OK.has(condition.condition)}>
          {titleCase(condition.condition)} · {condition.satisfied_count}/{condition.total_service_infra} supplied
        </Row>
        {/* get_base omits power and life_support while they are all zero, e.g. on a new station. */}
        {power && (
          <>
            <Row label="Power draw" ok={powerOk}>{ratio(power.current_draw, power.supply)}</Row>
            <Row label="Battery">{ratio(power.battery_stored, power.battery_capacity)}</Row>
            <Row label="Efficiency">{Math.round(power.efficiency * 100)}%</Row>
          </>
        )}
        {life && (
          <Row label="Life support" ok={life.supply >= life.demand && !life.starved?.length}>
            {ratio(life.demand, life.supply)} · {life.plants} plant{life.plants === 1 ? '' : 's'}
          </Row>
        )}
        {data.faction_fuel_capacity != null && (
          <Row label="Fuel bunker">{ratio(data.faction_fuel_reserve ?? 0, data.faction_fuel_capacity)}</Row>
        )}
      </div>

      <Notes notes={[condition.condition_text, power?.remediation, life?.remediation]} />
      <Chips title="Power fuel / cycle" items={perCycle(power?.fuel_inputs)} ok={powerOk} />
      <Chips title="Life support starved / cycle" items={perCycle(life?.starved)} ok={false} />
      <Chips title="Life support upkeep / cycle" items={perCycle(life?.maintenance)} />

      {repairs && (repairs.damaged_count > 0 || repairs.wrecked) && (
        <div className={fac.section}>
          <div className={fac.sectionHeader}>
            Repairs
            <span className={fac.sectionCount}>
              ({repairs.damaged_count} damaged, {repairs.repairing_count} repairing, {repairs.waiting_count} waiting)
            </span>
          </div>
          <Notes notes={[repairs.remediation]} />
          {repairs.hull_missing != null && repairs.hull_missing > 0 && (
            <Row label="Hull to rebuild" ok={false}>{fmt(repairs.hull_missing)} of {repairs.hull_required != null ? fmt(repairs.hull_required) : '?'}</Row>
          )}
          <Chips
            title="Materials in faction storage"
            items={repairs.materials?.map((m) => ({
              id: m.item_id, name: m.name ?? formatItemId(m.item_id), value: ratio(m.quantity_in_storage, m.quantity_required), ok: !m.quantity_missing,
            }))}
          />
          {(repairs.facilities ?? []).map((f) => (
            <Row key={f.instance_id} label={f.name} ok={f.status !== 'waiting'}>
              {titleCase(f.status)}{ticks(f.ticks_until_complete)}
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
            // reason is the manager's build motive (production, power_capacity, ...), not a fault.
            <Row
              key={`${b.definition_id}-${b.status}`}
              label={b.name}
              ok={b.status !== 'waiting_for_materials'}
              title={b.reason ? `Built for ${titleCase(b.reason).toLowerCase()}` : undefined}
            >
              {titleCase(b.status)}{ticks(b.ticks_until_complete)}
            </Row>
          ))}
        </div>
      )}
    </>
  )
}
