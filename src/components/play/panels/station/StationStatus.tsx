'use client'

import type { GetBaseResponse } from '@spacemolt/lib'
import fac from '../facilities/facilities.module.css'
import styles from './station.module.css'
import { ItemChips, Notes, Stat, StatList, Tip, fillOf, type Tone } from '../../shared'
import { useAccountStore } from '@/lib/spacemolt'
import { formatItemId } from '@/data/catalog'
import { formatDuration, formatNumber, titleCase } from '@/lib/format'

const CONDITION_OK = new Set(['thriving', 'operational'])
// Station upkeep (power fuel, life support) is billed once per facility cycle.
const FACILITY_CYCLE_TICKS = 100
const ratio = (have: number, max: number) => `${formatNumber(have)}/${formatNumber(max)}`
const lowTone = (fill: number): Tone => (fill < 0.25 ? 'warn' : 'ok')

export function Row({ label, ok = true, title, children }: { label: string; ok?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <div className={fac.costRow} title={title}>
      <span className={fac.costLabel}>{label}</span>
      <span className={ok ? fac.costValue : styles.bad}>{children}</span>
    </div>
  )
}

const chipsOf = (items?: { item_id: string; name?: string; quantity_per_cycle: number }[], bad = false) =>
  items?.map((i) => ({ id: i.item_id, name: i.name ?? formatItemId(i.item_id), value: `×${formatNumber(i.quantity_per_cycle)}`, bad }))

/** Hull, shield, condition, power, life support, repair bill and construction for the docked base. */
export function StationStatus({ data }: { data: GetBaseResponse }) {
  const { base, condition, power, life_support: life, repairs, construction } = data
  const tickRate = useAccountStore().account.welcome?.tick_rate || 10
  const building = [...(construction?.under_construction ?? []), ...(construction?.pending ?? [])]
  const cycleTicks = life?.maintenance_cycle_ticks || FACILITY_CYCLE_TICKS
  const every = (
    <Tip content={`Station upkeep runs every ${cycleTicks} ticks.`}>every {formatDuration(cycleTicks * tickRate)}</Tip>
  )
  const eta = (n?: number) => (n != null ? ` · ${formatDuration(n * tickRate)}` : '')
  const tickTip = (n?: number) => (n != null ? `${formatNumber(n)} ticks left` : undefined)
  const hullFill = fillOf(base.hull, base.max_hull)
  const drawFill = power ? fillOf(power.current_draw, power.supply) : 0
  const lifeFill = life ? fillOf(life.demand, life.supply) : 0

  return (
    <div className={styles.status}>
      <StatList>
        <Stat label="Hull" tone={base.wrecked ? 'bad' : lowTone(hullFill)} fill={base.wrecked ? 0 : hullFill}>
          {base.wrecked ? 'Wrecked' : ratio(base.hull, base.max_hull)}
        </Stat>
        {base.max_shield > 0 && (
          <Stat label="Shield" fill={fillOf(base.shield, base.max_shield)}>{ratio(base.shield, base.max_shield)}</Stat>
        )}
        {base.armor > 0 && <Stat label="Armor">{formatNumber(base.armor)}</Stat>}
        {base.weapon_dps > 0 && <Stat label="Defenses">{formatNumber(base.weapon_dps)} dps · reach {base.weapon_reach}</Stat>}
        <Stat
          label="Condition"
          tone={CONDITION_OK.has(condition.condition) ? 'ok' : 'warn'}
          fill={fillOf(condition.satisfied_count, condition.total_service_infra)}
          tip={`${condition.satisfied_count} of ${condition.total_service_infra} services supplied (${condition.satisfaction_pct}%)`}
        >
          {titleCase(condition.condition)} <span className={styles.sub}>{condition.satisfied_count}/{condition.total_service_infra}</span>
        </Stat>
        {/* get_base omits power and life_support while they are all zero, e.g. on a new station. */}
        {power && (
          <>
            <Stat label="Power draw" tone={drawFill > 1 ? 'bad' : 'ok'} fill={drawFill}>{ratio(power.current_draw, power.supply)}</Stat>
            <Stat label="Battery" tone={lowTone(fillOf(power.battery_stored, power.battery_capacity))} fill={fillOf(power.battery_stored, power.battery_capacity)}>
              {ratio(power.battery_stored, power.battery_capacity)}
            </Stat>
            <Stat label="Efficiency" tone={power.efficiency < 1 ? 'warn' : 'ok'}>{Math.round(power.efficiency * 100)}%</Stat>
          </>
        )}
        {life && (
          <Stat
            label="Life support"
            tone={lifeFill > 1 || life.starved?.length ? 'bad' : 'ok'}
            fill={lifeFill}
            tip={`Demand ${formatNumber(life.demand)} of ${formatNumber(life.supply)} supply, ${life.plants} plant${life.plants === 1 ? '' : 's'}`}
          >
            {ratio(life.demand, life.supply)}
          </Stat>
        )}
        {data.faction_fuel_capacity != null && (
          <Stat label="Fuel bunker" fill={fillOf(data.faction_fuel_reserve ?? 0, data.faction_fuel_capacity)}>
            {ratio(data.faction_fuel_reserve ?? 0, data.faction_fuel_capacity)}
          </Stat>
        )}
      </StatList>

      <Notes notes={[condition.condition_text]} />
      <Notes warn notes={[power?.remediation, life?.remediation]} />
      <ItemChips title={<>Power fuel, {every}</>} items={chipsOf(power?.fuel_inputs, drawFill > 1)} />
      <ItemChips title={<>Life support starved, {every}</>} items={chipsOf(life?.starved, true)} />
      <ItemChips title={<>Life support upkeep, {every}</>} items={chipsOf(life?.maintenance)} />

      {repairs && (repairs.damaged_count > 0 || repairs.wrecked) && (
        <div className={fac.section}>
          <div className={fac.sectionHeader}>
            Repairs
            <span className={fac.sectionCount}>
              ({repairs.damaged_count} damaged, {repairs.repairing_count} repairing, {repairs.waiting_count} waiting)
            </span>
          </div>
          <Notes warn notes={[repairs.remediation]} />
          {(repairs.hull_missing ?? 0) > 0 || repairs.facilities?.length ? (
            <StatList>
              {repairs.hull_missing != null && repairs.hull_missing > 0 && (
                <Stat label="Hull to rebuild" tone="bad">
                  {formatNumber(repairs.hull_missing)}{repairs.hull_required != null && <span className={styles.sub}> of {formatNumber(repairs.hull_required)}</span>}
                </Stat>
              )}
              {(repairs.facilities ?? []).map((f) => (
                <Stat key={f.instance_id} label={f.name} tone={f.status === 'waiting' ? 'warn' : 'ok'} tip={tickTip(f.ticks_until_complete)}>
                  {titleCase(f.status)}{eta(f.ticks_until_complete)}
                </Stat>
              ))}
            </StatList>
          ) : null}
          <ItemChips
            title="Materials in faction storage"
            items={repairs.materials?.map((m) => ({
              id: m.item_id,
              name: m.name ?? formatItemId(m.item_id),
              value: ratio(m.quantity_in_storage, m.quantity_required),
              bad: Boolean(m.quantity_missing),
            }))}
          />
        </div>
      )}

      {building.length > 0 && (
        <div className={fac.section}>
          <div className={fac.sectionHeader}>
            Construction <span className={fac.sectionCount}>({building.length})</span>
          </div>
          <StatList>
            {building.map((b) => (
              // reason is the manager's build motive (production, power_capacity, ...), not a fault.
              <Stat
                key={`${b.definition_id}-${b.status}`}
                label={b.name}
                tone={b.status === 'waiting_for_materials' ? 'warn' : 'ok'}
                tip={[b.reason && `Built for ${titleCase(b.reason).toLowerCase()}.`, tickTip(b.ticks_until_complete)].filter(Boolean).join(' ') || undefined}
              >
                {titleCase(b.status)}{eta(b.ticks_until_complete)}
              </Stat>
            ))}
          </StatList>
        </div>
      )}
    </div>
  )
}
