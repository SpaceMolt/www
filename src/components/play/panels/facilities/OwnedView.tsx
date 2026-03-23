'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Power,
  ArrowUpCircle,
  ArrowRightLeft,
  Paintbrush,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Modal, shared } from '../../shared'
import type { FacilityListResponse, Facility } from '@/lib/gameTypes'
import { FacilityCard } from './FacilityCard'
import { UpgradeModal, fetchUpgradeOptions, type UpgradeOption } from './UpgradeModal'
import styles from './facilities.module.css'

interface OwnedViewProps {
  facilityData: FacilityListResponse
  onRefresh: () => void
}

export function OwnedView({ facilityData, onRefresh }: OwnedViewProps) {
  const { sendCommand, api } = useGame()

  const [toggling, setToggling] = useState<string | null>(null)
  const [upgradeModal, setUpgradeModal] = useState<{ facility: Facility; options: UpgradeOption[] } | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [transferring, setTransferring] = useState<string | null>(null)
  const [decorateModal, setDecorateModal] = useState<Facility | null>(null)
  const [decorateDesc, setDecorateDesc] = useState('')
  const [decorateAccess, setDecorateAccess] = useState('private')
  const [decorating, setDecorating] = useState(false)
  const [showOthers, setShowOthers] = useState(false)

  const myFacilities = useMemo(
    () => facilityData.player_facilities.filter(f => f.yours),
    [facilityData.player_facilities]
  )
  const otherFacilities = useMemo(
    () => facilityData.player_facilities.filter(f => !f.yours),
    [facilityData.player_facilities]
  )

  const handleToggle = useCallback(async (facilityId: string) => {
    setToggling(facilityId)
    try {
      await sendCommand('facility_toggle', { facility_id: facilityId })
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
      await sendCommand('facility_upgrade', { facility_id: facilityId, facility_type: facilityType })
      setUpgradeModal(null)
      onRefresh()
    } catch { /* handled by event log */ }
    setUpgrading(false)
  }, [sendCommand, onRefresh])

  const handleTransfer = useCallback(async (facilityId: string) => {
    setTransferring(facilityId)
    try {
      await sendCommand('facility_transfer', { facility_id: facilityId, direction: 'to_faction' })
      onRefresh()
    } catch { /* handled by event log */ }
    setTransferring(null)
  }, [sendCommand, onRefresh])

  const handleDecorate = useCallback(async () => {
    if (!decorateModal) return
    setDecorating(true)
    try {
      await sendCommand('facility_personal_decorate', {
        facility_id: decorateModal.facility_id,
        description: decorateDesc,
        access: decorateAccess,
      })
      setDecorateModal(null)
      onRefresh()
    } catch { /* handled by event log */ }
    setDecorating(false)
  }, [sendCommand, decorateModal, decorateDesc, decorateAccess, onRefresh])

  const openDecorate = useCallback((facility: Facility) => {
    setDecorateDesc('')
    setDecorateAccess('private')
    setDecorateModal(facility)
  }, [])

  return (
    <>
      {myFacilities.length === 0 ? (
        <div className={shared.emptyState}>
          You don&apos;t own any facilities at this station. Visit the Build tab to construct one.
        </div>
      ) : (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            Your Facilities
            <span className={styles.sectionCount}>({myFacilities.length})</span>
          </div>
          {myFacilities.map(f => (
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
                  onClick={() => handleTransfer(f.facility_id)}
                  disabled={transferring === f.facility_id}
                  type="button"
                >
                  {transferring === f.facility_id
                    ? <Loader2 size={11} className={shared.spinner} />
                    : <ArrowRightLeft size={11} />}
                  To Faction
                </button>
              )}
              {f.personal_service === 'quarters' && (
                <button
                  className={shared.subtleBtn}
                  onClick={() => openDecorate(f)}
                  type="button"
                >
                  <Paintbrush size={11} /> Decorate
                </button>
              )}
            </FacilityCard>
          ))}
        </div>
      )}

      {otherFacilities.length > 0 && (
        <div className={styles.section}>
          <button
            className={styles.collapsibleHeader}
            onClick={() => setShowOthers(prev => !prev)}
            type="button"
          >
            {showOthers ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Other Players&apos; Facilities
            <span className={styles.sectionCount}>({otherFacilities.length})</span>
          </button>
          {showOthers && otherFacilities.map(f => (
            <FacilityCard key={f.facility_id} facility={f} />
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

      {decorateModal && (
        <Modal
          title="Decorate Quarters"
          icon={<Paintbrush size={14} />}
          onClose={() => setDecorateModal(null)}
          actions={
            <>
              <button
                className={shared.confirmBtn}
                onClick={handleDecorate}
                disabled={decorating}
                type="button"
              >
                {decorating ? <Loader2 size={11} className={shared.spinner} /> : <Paintbrush size={11} />}
                Save
              </button>
              <button className={shared.subtleBtn} onClick={() => setDecorateModal(null)} type="button">
                Cancel
              </button>
            </>
          }
        >
          <div className={styles.decorateFields}>
            <div className={styles.decorateField}>
              <label>
                Description
                <textarea
                  className={shared.textInput}
                  rows={3}
                  value={decorateDesc}
                  onChange={e => setDecorateDesc(e.target.value)}
                  placeholder="Describe your quarters..."
                  style={{ resize: 'vertical' }}
                />
              </label>
            </div>
            <div className={styles.decorateField}>
              <label>
                Access
                <select
                  className={shared.textInput}
                  value={decorateAccess}
                  onChange={e => setDecorateAccess(e.target.value)}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </label>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
