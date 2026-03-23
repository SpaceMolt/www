'use client'

import { useState, useCallback } from 'react'
import {
  ArrowUpCircle,
  Loader2,
} from 'lucide-react'
import { Credits, Modal, shared } from '../../shared'
import type { Facility } from '@/lib/gameTypes'
import type { GameApi } from '@/lib/gameApi'
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

/** Fetch upgrade options for a facility */
export async function fetchUpgradeOptions(
  api: GameApi,
  facility: Facility
): Promise<UpgradeOption[]> {
  try {
    const resp = await api.callStructured<{ upgrades: UpgradeOption[] }>('spacemolt_facility', 'upgrades', {})
    return (resp?.upgrades || []).filter(u => u.type_id !== facility.type)
  } catch {
    return []
  }
}
