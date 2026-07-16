'use client'

import { useState, useCallback } from 'react'
import {
  ArrowUpCircle,
  ArrowRightLeft,
  Paintbrush,
  Loader2,
  ListOrdered,
  Tag,
} from 'lucide-react'
import { useAccountStore, useCommandMutation } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Modal, shared } from '../../shared'
import type { FacilityListResponse, Facility } from '../../types'
import { FacilityCard } from './FacilityCard'
import { UpgradeModal, fetchUpgradeOptions, type UpgradeOption } from './UpgradeModal'
import { FacilityQueueModal } from './FacilityQueueModal'
import styles from './facilities.module.css'

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err))

interface OwnedViewProps {
  facilityData: FacilityListResponse
  onRefresh: () => void
}

export function OwnedView({ facilityData, onRefresh }: OwnedViewProps) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()

  const [upgradeModal, setUpgradeModal] = useState<{ facility: Facility; options: UpgradeOption[] } | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [transferring, setTransferring] = useState<string | null>(null)
  const [decorateModal, setDecorateModal] = useState<Facility | null>(null)
  const [decorateDesc, setDecorateDesc] = useState('')
  const [decorateAccess, setDecorateAccess] = useState<'private' | 'public'>('private')
  const [decorating, setDecorating] = useState(false)
  const [queueModal, setQueueModal] = useState<Facility | null>(null)
  const [pricingId, setPricingId] = useState<string | null>(null)

  const reportError = useCallback((err: unknown) => {
    const text = describeError(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    uiStore.dispatch({ type: 'event', kind: 'danger', text })
  }, [uiStore])

  // Server pre-filters player_facilities to only the requesting player's own
  // facilities, so we can render the list directly without further filtering.
  const myFacilities = facilityData.player_facilities

  const handleShowUpgrades = useCallback(async (facility: Facility) => {
    setUpgradeLoading(true)
    const options = await fetchUpgradeOptions(store.account.commands, facility)
    setUpgradeModal({ facility, options })
    setUpgradeLoading(false)
  }, [store])

  const handleUpgrade = useCallback(async (facilityId: string, facilityType: string) => {
    setUpgrading(true)
    try {
      await mutate((c) => c.spacemolt_facility.upgrade({ facility_id: facilityId, facility_type: facilityType }), { label: 'facility_upgrade' })
      setUpgradeModal(null)
      onRefresh()
    } catch (err) {
      reportError(err)
    }
    setUpgrading(false)
  }, [mutate, onRefresh, reportError])

  const handleTransfer = useCallback(async (facilityId: string) => {
    setTransferring(facilityId)
    try {
      await mutate((c) => c.spacemolt_facility.transfer({ facility_id: facilityId, direction: 'to_faction' }), { label: 'facility_transfer' })
      onRefresh()
    } catch (err) {
      reportError(err)
    }
    setTransferring(null)
  }, [mutate, onRefresh, reportError])

  const handleToggleAccess = useCallback(async (facility: Facility) => {
    const nextAccess = facility.production?.public ? 'private' : 'public'
    try {
      await mutate((c) => c.spacemolt_facility.set_access({ facility_id: facility.facility_id, access: nextAccess }), { label: 'facility_set_access' })
      onRefresh()
    } catch (err) {
      reportError(err)
    }
  }, [mutate, onRefresh, reportError])

  const handleSetOutputPrice = useCallback(async (facilityId: string, price: string) => {
    const parsed = Number(price)
    if (!Number.isFinite(parsed) || parsed < 0) return
    try {
      await mutate((c) => c.spacemolt_facility.set_output_price({ facility_id: facilityId, price: parsed }), { label: 'facility_set_output_price' })
      onRefresh()
    } catch (err) {
      reportError(err)
    }
    setPricingId(null)
  }, [mutate, onRefresh, reportError])

  const handleDecorate = useCallback(async () => {
    if (!decorateModal) return
    setDecorating(true)
    try {
      await mutate((c) => c.spacemolt_facility.personal_decorate({
        description: decorateDesc,
        access: decorateAccess,
      }), { label: 'facility_personal_decorate' })
      setDecorateModal(null)
      onRefresh()
    } catch (err) {
      reportError(err)
    }
    setDecorating(false)
  }, [mutate, decorateModal, decorateDesc, decorateAccess, onRefresh, reportError])

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
              {f.category === 'production' && (
                <button
                  className={shared.actionBtn}
                  onClick={() => setQueueModal(f)}
                  type="button"
                >
                  <ListOrdered size={11} /> Queue
                </button>
              )}
              {f.category === 'production' && (
                <button
                  className={shared.subtleBtn}
                  onClick={() => handleToggleAccess(f)}
                  type="button"
                  title="Toggle whether other players can rent this facility's spare capacity"
                >
                  <Tag size={11} /> {f.production?.public ? 'Public' : 'Private'}
                </button>
              )}
              {f.category === 'production' && f.production?.public && (
                pricingId === f.facility_id ? (
                  <input
                    className={shared.textInput}
                    type="number"
                    min={0}
                    step="0.01"
                    autoFocus
                    defaultValue={f.production?.rental_fee_per_run ?? 0}
                    onBlur={(e) => handleSetOutputPrice(f.facility_id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSetOutputPrice(f.facility_id, (e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setPricingId(null)
                    }}
                    style={{ width: '5rem' }}
                  />
                ) : (
                  <button
                    className={shared.subtleBtn}
                    onClick={() => setPricingId(f.facility_id)}
                    type="button"
                  >
                    {(f.production?.rental_fee_per_run ?? 0).toLocaleString()} cr/run
                  </button>
                )
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
                  onChange={e => setDecorateAccess(e.target.value === 'public' ? 'public' : 'private')}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </label>
            </div>
          </div>
        </Modal>
      )}

      {queueModal && (
        <FacilityQueueModal facility={queueModal} onClose={() => setQueueModal(null)} />
      )}
    </>
  )
}
