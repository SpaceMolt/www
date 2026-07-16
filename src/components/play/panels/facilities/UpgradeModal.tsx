'use client'

import { ArrowUpCircle, Loader2 } from 'lucide-react'
import type { Commands, FacilityResponse } from '@spacemolt/lib'
import { Credits, Modal, shared } from '../../shared'
import type { Facility } from '../../types'
import styles from './facilities.module.css'

export interface UpgradeOption {
  type_id: string
  name: string
  description: string
  category: string
  level: number
  build_cost: number
  build_time: number
  build_materials: { item_id: string; name: string; quantity: number }[]
  labor_cost: number
  rent_per_cycle: number
  recipe?: {
    id: string
    name: string
    crafting_time: number
    inputs: { item_id: string; name: string; quantity: number }[]
    outputs: { item_id: string; name: string; quantity: number }[]
  }
  upgrades_to?: string
  upgrades_to_name?: string
}

interface UpgradeModalProps {
  facility: Facility
  options: UpgradeOption[]
  onUpgrade: (facilityId: string, facilityType: string) => void
  upgrading: boolean
  onClose: () => void
}

export function UpgradeModal({ facility, options, onUpgrade, upgrading, onClose }: UpgradeModalProps) {
  return (
    <Modal
      title={`Upgrade ${facility.name}`}
      icon={<ArrowUpCircle size={14} />}
      onClose={onClose}
    >
      {options.length === 0 ? (
        <div className={shared.emptyState}>No upgrades available for this facility.</div>
      ) : (
        options.map(opt => (
          <div key={opt.type_id} className={styles.typeDetail}>
            <div className={styles.typeName}>{opt.name} (L{opt.level})</div>
            <div className={styles.cardDescription}>{opt.description}</div>
            <div className={styles.costBreakdown}>
              <div className={styles.costRow}>
                <span className={styles.costLabel}>Cost</span>
                <span className={styles.costValue}><Credits amount={opt.build_cost} /></span>
              </div>
              <div className={styles.costRow}>
                <span className={styles.costLabel}>Build Time</span>
                <span className={styles.costValue}>{opt.build_time} ticks</span>
              </div>
              <div className={styles.costRow}>
                <span className={styles.costLabel}>Rent</span>
                <span className={styles.costValue}><Credits amount={opt.rent_per_cycle} /> /cycle</span>
              </div>
              {opt.build_materials.length > 0 && (
                <div className={styles.costRow}>
                  <span className={styles.costLabel}>Materials</span>
                  <span className={styles.costValue}>
                    {opt.build_materials.map(m => `${m.name} x${m.quantity}`).join(', ')}
                  </span>
                </div>
              )}
            </div>
            <button
              className={shared.confirmBtn}
              onClick={() => onUpgrade(facility.facility_id, opt.type_id)}
              disabled={upgrading}
              type="button"
            >
              {upgrading ? <Loader2 size={11} className={shared.spinner} /> : <ArrowUpCircle size={11} />}
              Upgrade to {opt.name}
            </button>
          </div>
        ))
      )}
    </Modal>
  )
}

// `upgrades()` (no params) now returns upgrade options for every facility the
// player (or their faction) owns at the current station in one shot, each
// tagged with `your_facility_id` — a shape change from the old per-facility
// query. `{ upgrades: unknown }` is a unique top-level discriminator across
// the FacilityResponse union (grepped node_modules/@spacemolt/lib).
type FacilityUpgradesResponse = Extract<FacilityResponse, { upgrades: unknown }>
type UpgradeEntry = FacilityUpgradesResponse['upgrades'][number]
// `{ type_id: unknown }` uniquely identifies the single-facility-type detail
// variant (used by the `types({ facility_type })` fallback below). Extract
// requires the discriminator field to be REQUIRED (not `?`) on the target
// member — `build_materials` is optional there, which resolves to `never`.
type FacilityTypeDetail = Extract<FacilityResponse, { type_id: unknown }>

function toUpgradeOption(upgradeTo: UpgradeEntry['upgrade_to']): UpgradeOption {
  return {
    type_id: upgradeTo.type_id,
    name: upgradeTo.name,
    description: upgradeTo.description,
    category: upgradeTo.category,
    level: upgradeTo.level,
    build_cost: upgradeTo.build_cost,
    build_time: upgradeTo.build_time,
    build_materials: (upgradeTo.build_materials ?? []).map(m => ({ item_id: m.item_id, name: m.name, quantity: m.quantity })),
    labor_cost: upgradeTo.labor_cost,
    rent_per_cycle: upgradeTo.rent_per_cycle,
  }
}

function detailToUpgradeOption(detail: FacilityTypeDetail): UpgradeOption {
  return {
    type_id: detail.type_id,
    name: detail.name,
    description: detail.description,
    category: detail.category,
    level: detail.level,
    build_cost: detail.build_cost,
    build_time: detail.build_time,
    build_materials: (detail.build_materials ?? []).map(m => ({ item_id: m.item_id, name: m.name, quantity: m.quantity })),
    labor_cost: detail.labor_cost,
    rent_per_cycle: detail.rent_per_cycle,
    recipe: detail.recipe,
    upgrades_to: detail.upgrades_to,
    upgrades_to_name: detail.upgrades_to_name,
  }
}

/** Fetch upgrade options for a facility */
export async function fetchUpgradeOptions(
  commands: Commands,
  facility: Facility,
): Promise<UpgradeOption[]> {
  try {
    const resp = await commands.spacemolt_facility.upgrades()
    const data = resp.structuredContent as FacilityUpgradesResponse | undefined
    const fromEntries = (entries?: UpgradeEntry[]) =>
      (entries ?? [])
        .filter(e => e.your_facility_id === facility.facility_id)
        .map(e => toUpgradeOption(e.upgrade_to))
        .filter(u => u.type_id !== facility.type)

    const own = fromEntries(data?.upgrades)
    if (own.length > 0) return own
    const factionOwn = fromEntries(data?.faction_upgrades)
    if (factionOwn.length > 0) return factionOwn

    // Fallback: if the upgrades() query didn't surface anything for this
    // facility, look up the facility type's upgrades_to chain via the
    // discovery endpoint so the modal at least surfaces the next tier (the
    // gameserver already accepts `facility upgrade facility_id=...` for
    // faction facilities — see Discord thread 1501373272296652890).
    try {
      const detailResp = await commands.spacemolt_facility.types({ facility_type: facility.type })
      const detail = detailResp.structuredContent as FacilityTypeDetail | undefined
      const upgradesToId = detail?.upgrades_to
      if (!upgradesToId) return []
      const nextResp = await commands.spacemolt_facility.types({ facility_type: upgradesToId })
      const next = nextResp.structuredContent as FacilityTypeDetail | undefined
      if (!next?.type_id) return []
      return [detailToUpgradeOption(next)]
    } catch {
      return []
    }
  } catch {
    return []
  }
}
