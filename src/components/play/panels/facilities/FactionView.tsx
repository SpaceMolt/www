'use client'

import { useState, useCallback } from 'react'
import {
  Power,
  ArrowUpCircle,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { shared } from '../../shared'
import type { FacilityListResponse, Facility } from '@/lib/gameTypes'
import { FacilityCard } from './FacilityCard'
import { UpgradeModal, fetchUpgradeOptions, type UpgradeOption } from './UpgradeModal'
import styles from './facilities.module.css'

interface FactionViewProps {
  facilityData: FacilityListResponse
  onRefresh: () => void
}

export function FactionView({ facilityData, onRefresh }: FactionViewProps) {
  const { sendCommand, api } = useGame()

  const [toggling, setToggling] = useState<string | null>(null)
  const [upgradeModal, setUpgradeModal] = useState<{ facility: Facility; options: UpgradeOption[] } | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [transferring, setTransferring] = useState<string | null>(null)

  const factionFacilities = facilityData.faction_facilities

  const handleToggle = useCallback(async (facilityId: string) => {
    setToggling(facilityId)
    try {
      await sendCommand('facility_faction_toggle', { facility_id: facilityId })
      onRefresh()
    } catch { /* handled by event log */ }
    setToggling(null)
  }, [sendCommand, onRefresh])

  const handleShowUpgrades = useCallback(async (facility: Facility) => {
    if (!api) return
    setUpgradeLoading(true)
    const options = await fetchUpgradeOptions(api, facility)
    setUpgradeModal({ facility, options })
    setUpgradeLoading(false)
  }, [api])

  const handleUpgrade = useCallback(async (facilityId: string, facilityType: string) => {
    setUpgrading(true)
    try {
      await sendCommand('facility_faction_upgrade', { facility_id: facilityId, facility_type: facilityType })
      setUpgradeModal(null)
      onRefresh()
    } catch { /* handled by event log */ }
    setUpgrading(false)
  }, [sendCommand, onRefresh])

  const handleTransferToPlayer = useCallback(async (facilityId: string) => {
    setTransferring(facilityId)
    try {
      await sendCommand('facility_transfer', { facility_id: facilityId, direction: 'to_player' })
      onRefresh()
    } catch { /* handled by event log */ }
    setTransferring(null)
  }, [sendCommand, onRefresh])

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
            {f.category === 'production' && (
              <button
                className={f.active ? shared.warningBtn : shared.confirmBtn}
                onClick={() => handleToggle(f.facility_id)}
                disabled={toggling === f.facility_id}
                type="button"
              >
                {toggling === f.facility_id
                  ? <Loader2 size={11} className={shared.spinner} />
                  : <Power size={11} />}
                {f.active ? 'Disable' : 'Enable'}
              </button>
            )}
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
