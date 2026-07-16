'use client'

import { useState, useCallback } from 'react'
import {
  ArrowUpCircle,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react'
import { useAccountStore, useCommandMutation } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { shared } from '../../shared'
import type { FacilityListResponse, Facility } from '../../types'
import { FacilityCard } from './FacilityCard'
import { UpgradeModal, fetchUpgradeOptions, type UpgradeOption } from './UpgradeModal'
import styles from './facilities.module.css'

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err))

interface FactionViewProps {
  facilityData: FacilityListResponse
  onRefresh: () => void
}

export function FactionView({ facilityData, onRefresh }: FactionViewProps) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()

  const [upgradeModal, setUpgradeModal] = useState<{ facility: Facility; options: UpgradeOption[] } | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [transferring, setTransferring] = useState<string | null>(null)

  const reportError = useCallback((err: unknown) => {
    const text = describeError(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    uiStore.dispatch({ type: 'event', kind: 'danger', text })
  }, [uiStore])

  const factionFacilities = facilityData.faction_facilities

  const handleShowUpgrades = useCallback(async (facility: Facility) => {
    setUpgradeLoading(true)
    const options = await fetchUpgradeOptions(store.account.commands, facility)
    setUpgradeModal({ facility, options })
    setUpgradeLoading(false)
  }, [store])

  const handleUpgrade = useCallback(async (facilityId: string, facilityType: string) => {
    setUpgrading(true)
    try {
      await mutate((c) => c.spacemolt_facility.faction_upgrade({ facility_id: facilityId, facility_type: facilityType }), { label: 'facility_faction_upgrade' })
      setUpgradeModal(null)
      onRefresh()
    } catch (err) {
      reportError(err)
    }
    setUpgrading(false)
  }, [mutate, onRefresh, reportError])

  const handleTransferToPlayer = useCallback(async (facilityId: string) => {
    setTransferring(facilityId)
    try {
      await mutate((c) => c.spacemolt_facility.transfer({ facility_id: facilityId, direction: 'to_player' }), { label: 'facility_transfer' })
      onRefresh()
    } catch (err) {
      reportError(err)
    }
    setTransferring(null)
  }, [mutate, onRefresh, reportError])

  if (factionFacilities.length === 0) {
    return (
      <div className={shared.emptyState}>
        Your faction has no facilities at this station. Build one from the Build tab.
      </div>
    )
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          Faction Facilities
          <span className={styles.sectionCount}>({factionFacilities.length})</span>
        </div>
        {factionFacilities.map(f => (
          <FacilityCard key={f.facility_id} facility={f}>
            <button
              className={shared.actionBtn}
              onClick={() => handleShowUpgrades(f)}
              disabled={upgradeLoading}
              type="button"
            >
              <ArrowUpCircle size={11} /> Upgrade
            </button>
            {f.category === 'production' && (
              <button
                className={shared.subtleBtn}
                onClick={() => handleTransferToPlayer(f.facility_id)}
                disabled={transferring === f.facility_id}
                type="button"
              >
                {transferring === f.facility_id
                  ? <Loader2 size={11} className={shared.spinner} />
                  : <ArrowRightLeft size={11} />}
                To Player
              </button>
            )}
          </FacilityCard>
        ))}
      </div>

      {upgradeModal && (
        <UpgradeModal
          facility={upgradeModal.facility}
          options={upgradeModal.options}
          onUpgrade={handleUpgrade}
          upgrading={upgrading}
          onClose={() => setUpgradeModal(null)}
        />
      )}
    </>
  )
}
