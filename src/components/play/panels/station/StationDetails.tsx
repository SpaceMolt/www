'use client'

import type { GetBaseResponse } from '@spacemolt/lib'
import { ItemChips, Notes, Stat, StatList, type Chip } from '../../shared'
import { formatItemId } from '@/data/catalog'
import { useCatalog } from '@/lib/spacemolt'
import { formatNumber, titleCase } from '@/lib/format'

type Material = { item_id: string; name?: string; quantity_in_storage: number; quantity_required: number; quantity_missing?: number }

const materialChips = <M extends Material>(items: M[] | undefined, tip?: (m: M) => string): Chip[] | undefined =>
  items?.map((m) => ({
    id: m.item_id,
    name: m.name ?? formatItemId(m.item_id),
    value: `${formatNumber(m.quantity_in_storage)}/${formatNumber(m.quantity_required)}`,
    bad: Boolean(m.quantity_missing),
    tip: tip?.(m),
  }))

/** What the station asks for: build materials, sovereign mint inputs, a pirate replacement hull. */
export function StationNeeds({ data }: { data: GetBaseResponse }) {
  const { construction, sovereign_mint: mint, pirate_recovery: pirate } = data
  const builds = [...(construction?.under_construction ?? []), ...(construction?.pending ?? [])].filter((b) => b.materials?.length)
  if (!builds.length && !mint && !pirate) return <Notes notes={['This station reports no material needs.']} />

  return (
    <>
      {builds.map((b) => (
        <ItemChips
          key={`${b.definition_id}-${b.status}`}
          title={`${b.name}${b.reason ? `, built for ${titleCase(b.reason).toLowerCase()}` : ''} (${titleCase(b.status).toLowerCase()})`}
          items={materialChips(b.materials)}
        />
      ))}
      {mint && (
        <>
          <ItemChips
            title={`${mint.output_name ?? formatItemId(mint.output_item_id)} mint inputs (${titleCase(mint.status).toLowerCase()})`}
            items={materialChips(mint.shortages, (s) => (s.buy_order_available ? 'The station has a buy order for this input.' : 'The station has no buy order for this input.'))}
          />
          <ItemChips
            title="Mint inputs priced above the station's bid"
            items={mint.price_limits?.map((p) => ({
              id: p.item_id,
              name: p.name,
              value: `bid ${formatNumber(p.station_buy_price)} / ask ${formatNumber(p.lowest_sell_price)} cr`,
            }))}
          />
          <Notes warn notes={[mint.remediation, ...(mint.internal_blockers ?? []).map((x) => x.remediation)]} />
        </>
      )}
      {pirate && (
        <ItemChips
          title={`${pirate.ship_name} replacement hull (${titleCase(pirate.status).toLowerCase()})`}
          items={materialChips(pirate.materials, (p) => `${formatNumber(p.quantity_incoming)} incoming. Station bids ${formatNumber(p.bid_price)} cr for ${formatNumber(p.bid_quantity)}.`)}
        />
      )}
    </>
  )
}

/** Prices, access rules, contraband and visitor appeal for the docked base. */
export function StationTerms({ data }: { data: GetBaseResponse }) {
  const { base, services } = data
  const contraband = base.contraband_items ?? []
  return (
    <>
      <StatList>
        {data.fuel_price_all_in != null && (
          <Stat
            label="Fuel"
            tip={data.fuel_tax_per_unit ? `${formatNumber(data.fuel_price ?? 0)} cr plus ${formatNumber(data.fuel_tax_per_unit)} cr empire tax` : undefined}
          >
            {formatNumber(data.fuel_price_all_in)} cr/unit
          </Stat>
        )}
        {base.repair_price_per_hull != null && <Stat label="Repair">{formatNumber(base.repair_price_per_hull)} cr/hull</Stat>}
        {base.market_fee_bps != null && <Stat label="Market fee">{base.market_fee_bps / 100}%</Stat>}
        <Stat label="Docking">{base.public_access ? 'Public' : 'Restricted'}</Stat>
        {(base.pirate_rep_required ?? 0) > 0 && <Stat label="Pirate rep needed">{formatNumber(base.pirate_rep_required ?? 0)}</Stat>}
        {base.faction_id && <Stat label="Outsider facilities">{base.allow_outsider_facilities ? 'Allowed' : 'Not allowed'}</Stat>}
        <Stat label="Contraband rules">{titleCase(base.contraband_mode)}</Stat>
        {data.dining_points != null && <Stat label="Dining appeal">{formatNumber(data.dining_points)}</Stat>}
        {data.leisure_points != null && <Stat label="Leisure appeal">{formatNumber(data.leisure_points)}</Stat>}
        {data.tourism_revenue != null && <Stat label="Tourism revenue">{formatNumber(data.tourism_revenue)} cr</Stat>}
      </StatList>
      <ItemChips
        title="Services"
        items={services.map((s) => ({ id: s, name: titleCase(s), value: base.service_access?.[s] ? titleCase(base.service_access[s]) : '' }))}
      />
      <ItemChips title="Contraband here" items={contraband.map((id) => ({ id, name: formatItemId(id), value: '' }))} />
    </>
  )
}

/** Installed facility definitions, grouped by category, duplicates counted. */
export function StationFacilities({ ids }: { ids: string[] }) {
  const { data: catalog } = useCatalog()
  const def = (id: string) => catalog?.facility(id)
  const counts = ids.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<string, number>())
  const groups = Object.entries(Object.groupBy([...counts], ([id]) => def(id)?.category ?? 'other'))
    .sort(([a], [b]) => a.localeCompare(b))
  return (
    <>
      {groups.map(([category, entries = []]) => (
        <ItemChips
          key={category}
          title={`${titleCase(category)} (${entries.length})`}
          items={entries
            .map(([id, n]) => ({ id, name: def(id)?.name ?? formatItemId(id), value: n > 1 ? `×${n}` : '', tip: def(id)?.description }))
            .sort((a, b) => a.name.localeCompare(b.name))}
        />
      ))}
    </>
  )
}
