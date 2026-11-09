'use client'

import { useState, useCallback } from 'react'
import {
  ArrowUpCircle,
  ArrowRightLeft,
  Loader2,
  PawPrint,
} from 'lucide-react'
import { useAccountStore, useCommandMutation, useCommandQuery } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Credits, errorMessage, shared } from '../../shared'
import type { FacilityListResponse, Facility } from '../../types'
import { FacilityCard } from './FacilityCard'
import { FacilityManageActions } from './FacilityManageActions'
import { RanchModal } from './RanchModal'
import { UpgradeModal, fetchUpgradeOptions, type UpgradeOption } from './UpgradeModal'
import styles from './facilities.module.css'

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
  const [ranchId, setRanchId] = useState<string | null>(null)

  // faction_list adds the faction's rent and storage summary for this station.
  const { data: summary, refetch: refetchSummary } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.faction_list()).structuredContent,
    [facilityData.base_id],
  )
  const refresh = useCallback(() => { onRefresh(); refetchSummary() }, [onRefresh, refetchSummary])

  const reportError = useCallback((err: unknown) => {
    uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
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
      refresh()
    } catch (err) {
      reportError(err)
    }
    setUpgrading(false)
  }, [mutate, refresh, reportError])

  const handleTransferToPlayer = useCallback(async (facilityId: string) => {
    setTransferring(facilityId)
    try {
      await mutate((c) => c.spacemolt_facility.transfer({ facility_id: facilityId, direction: 'to_player' }), { label: 'facility_transfer' })
      refresh()
    } catch (err) {
      reportError(err)
    }
    setTransferring(null)
  }, [mutate, refresh, reportError])

  const rent = summary?.faction_rent ?? facilityData.faction_rent
  const storage = summary?.faction_storage

  return (
    <>
      {(rent || storage) && (
        <div className={styles.cardMeta}>
          {rent && (
            <span className={styles.metaItem}>
              Faction rent here <Credits amount={rent.total_rent_per_cycle} />/cycle
              {(rent.arrears_owed ?? 0) > 0 && <> (owed <Credits amount={rent.arrears_owed ?? 0} />)</>}
            </span>
          )}
          {storage && (
            <span className={styles.metaItem}>
              Faction storage: <Credits amount={storage.credits} />, {storage.item_types} item types
            </span>
          )}
        </div>
      )}

      {factionFacilities.length === 0 ? (
        <div className={shared.emptyState}>
          Your faction has no facilities at this station. Build one from the Build tab.
        </div>
      ) : (
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
              {f.category === 'ranch' && (
                <button className={shared.actionBtn} onClick={() => setRanchId(f.facility_id)} type="button">
                  <PawPrint size={11} /> Herd
                </button>
              )}
              {(() => {
                const left = summary?.faction_facilities.find((e) => e.facility_id === f.facility_id && e.status === 'under_construction')?.ticks_until_complete
                return left != null && <span className={styles.costValue}>{left} ticks to build</span>
              })()}
              <FacilityManageActions facility={f} scope="faction" onRefresh={refresh} />
            </FacilityCard>
          ))}
        </div>
      )}

      {upgradeModal && (
        <UpgradeModal
          facility={upgradeModal.facility}
          options={upgradeModal.options}
          onUpgrade={handleUpgrade}
          upgrading={upgrading}
          onClose={() => setUpgradeModal(null)}
        />
      )}

      {ranchId && <RanchModal facilityId={ranchId} onClose={() => setRanchId(null)} />}
    </>
  )
}
