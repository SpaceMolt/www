'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Package,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Ship,
  Gift,
  ChevronDown,
  ChevronRight,
  Send,
  MapPin,
  Users,
  X,
} from 'lucide-react'
import {
  useCargo,
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  usePendingAction,
  usePlayer,
} from '@/lib/spacemolt'
import type { StorageResponse } from '@spacemolt/lib'
import type { UiState } from '@/lib/spacemolt'
import { usePlay, usePlayUi } from '../../PlayProvider'
import { Credits, ItemSelectList, errorMessage, shared, useStorageMove } from '../../shared'
import { normalizeCargo, selectAll, selectedItems, type Selection } from '../../shared/itemSelection'
import styles from './StorageView.module.css'
import { GiftForm, type GiftShip } from './GiftForm'
import { storageStationOptions, type StorageLocation } from './storageLocations'

// StorageResponse is one generated union across every branch of the unified
// storage action (self view, faction view, deposit/withdraw/gift results) —
// narrow to the branch view({target: 'self' | undefined}) actually returns.
// `locations` is served by the gameserver but is not in @spacemolt/lib's
// generated types yet, so it is added here (see ./storageLocations).
type PersonalStorageView = Extract<StorageResponse, { hint: string; ships: Array<unknown> }> & {
  locations?: StorageLocation[]
}
type StoredShip = PersonalStorageView['ships'][number] & { custom_name?: string }

const shipLabel = (ship: StoredShip): string => {
  const cls = ship.class_name || ship.class_id
  return ship.custom_name ? `${ship.custom_name} (${cls})` : cls
}
const giftShips = (ships: StoredShip[]): GiftShip[] => ships.map((s) => ({ ship_id: s.ship_id, label: shipLabel(s) }))

export const selectStorageRevision = (s: UiState) => s.storageRevision

/**
 * The personal storage view (station_id omitted), refetched after any storage change. A docked view
 * clears the server's pending gifts, so it hands what it returned to the ui store.
 */
export function usePersonalStorage({ enabled = true } = {}) {
  const { uiStore } = usePlay()
  const dockedAt = useLocationState()?.docked_at
  const revision = usePlayUi(selectStorageRevision)
  const query = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view()).structuredContent as PersonalStorageView | undefined,
    [dockedAt, revision],
    { enabled, refreshOnSections: ['cargo'] },
  )
  useEffect(() => {
    const gifts = query.data?.gifts ?? []
    if (gifts.length > 0) uiStore.dispatch({ type: 'gifts_received', gifts })
  }, [query.data, uiStore])
  return query
}
const selectGifts = (s: UiState) => s.gifts

export function StorageView() {
  const { uiStore } = usePlay()
  const location = useLocationState()
  const dockedAt = location?.docked_at
  const isDocked = Boolean(dockedAt)
  const hasFaction = Boolean(usePlayer()?.faction_id)
  const rawCargo = useCargo()
  const cargo = useMemo(() => normalizeCargo(rawCargo), [rawCargo])
  const actionPending = usePendingAction() !== null
  const mutate = useCommandMutation()
  const move = useStorageMove()
  const revision = usePlayUi(selectStorageRevision)

  // Docked it is this station's storage; undocked it lists every station where the player stores something.
  const { data: storageData, error: storageError, refetch: refetchStorage } = usePersonalStorage()
  const locationsData = isDocked ? undefined : storageData
  const remoteStations = storageStationOptions(locationsData)
  const [selectedStation, setSelectedStation] = useState('')
  const { data: remoteData, loading: remoteLoading, refetch: refetchRemote } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view({ station_id: selectedStation })).structuredContent as PersonalStorageView | undefined,
    [selectedStation, revision],
    { enabled: !isDocked && Boolean(selectedStation) },
  )

  const [storedSel, setStoredSel] = useState<Selection>({})
  const [cargoSel, setCargoSel] = useState<Selection>({})
  const [showSendGift, setShowSendGift] = useState(false)

  const shipAction = async (label: string, args: { item_id: string; target?: string }) => {
    try {
      await mutate((c) => c.spacemolt_storage.deposit(args), { label })
      uiStore.dispatch({ type: 'storage_changed' })
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    }
  }

  // --- Undocked: remote station viewer ---
  if (!isDocked) {
    const viewShips = (remoteData?.ships ?? []) as StoredShip[]
    return (
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <span className={styles.sectionLabel}>
            <MapPin size={12} />
            Remote Storage View
          </span>
          {selectedStation && (
            <button className={shared.refreshBtn} onClick={refetchRemote} title="Refresh" type="button">
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        <GiftsReceived />
        <SendGiftSection open={showSendGift} onToggle={() => setShowSendGift(!showSendGift)}>
          <GiftForm cargo={[]} stored={[]} ships={giftShips(viewShips)} isDocked={false} />
        </SendGiftSection>

        {storageError ? (
          <div className={shared.emptyState}>{storageError}</div>
        ) : remoteStations.length > 0 ? (
          <div className={styles.section}>
            <select className={shared.selectInput} value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)}>
              <option value="">Select a station...</option>
              {remoteStations.map((station) => (
                <option key={station.id} value={station.id}>{station.label}</option>
              ))}
            </select>
          </div>
        ) : (
          locationsData && <div className={shared.emptyState}>Nothing stored at any station</div>
        )}

        {remoteLoading && <div className={styles.loading}>Loading storage...</div>}

        {selectedStation && !remoteLoading && remoteData && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Box size={12} />
                Stored Items ({remoteData.items.length})
              </div>
              <ItemSelectList items={remoteData.items} selection={{}} onChange={() => {}} readOnly empty="No items at this station" />
            </div>
            <StoredShips ships={viewShips} />
          </>
        )}
      </div>
    )
  }

  // --- Docked: full storage with controls ---
  if (!storageData) {
    if (storageError) return <div className={shared.emptyState}>{storageError}</div>
    return <div className={styles.loading}>Loading storage data...</div>
  }

  const storedItems = storageData.items || []
  const storedShips = (storageData.ships || []) as StoredShip[]
  const storedPicked = selectedItems(storedItems, storedSel)
  const cargoPicked = selectedItems(cargo, cargoSel)

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          <Package size={12} />
          Station Storage
        </span>
        <button className={shared.refreshBtn} onClick={refetchStorage} title="Refresh storage" type="button">
          <RefreshCw size={13} />
        </button>
      </div>

      <GiftsReceived />
      <SendGiftSection open={showSendGift} onToggle={() => setShowSendGift(!showSendGift)}>
        <GiftForm cargo={cargo} stored={storedItems} ships={giftShips(storedShips)} isDocked />
      </SendGiftSection>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Box size={12} />
          Stored Items ({storedItems.length})
        </div>
        <ItemSelectList
          items={storedItems}
          selection={storedSel}
          onChange={setStoredSel}
          empty="No items in storage"
          actions={
            <>
              <button
                className={shared.accentBtn}
                disabled={actionPending || storedPicked.length === 0}
                onClick={async () => setStoredSel(await move('Withdrew', storedPicked, (c, items) => c.spacemolt_storage.withdraw({ items })))}
                type="button"
              >
                <ArrowUpFromLine size={10} /> Withdraw to Cargo
              </button>
              {hasFaction && (
                <button
                  className={shared.subtleBtn}
                  disabled={actionPending || storedPicked.length === 0}
                  onClick={async () => setStoredSel(await move('Moved', storedPicked, (c, items) => c.spacemolt_storage.deposit({ items, source: 'storage', target: 'faction' })))}
                  type="button"
                >
                  <Users size={10} /> To Faction
                </button>
              )}
            </>
          }
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Package size={12} />
          Ship Cargo ({cargo.length})
        </div>
        <ItemSelectList
          items={cargo}
          selection={cargoSel}
          onChange={setCargoSel}
          empty="Cargo hold is empty"
          actions={
            <>
              <button
                className={shared.confirmBtn}
                disabled={actionPending || cargoPicked.length === 0}
                onClick={async () => setCargoSel(await move('Deposited', cargoPicked, (c, items) => c.spacemolt_storage.deposit({ items })))}
                type="button"
              >
                <ArrowDownToLine size={10} /> Deposit Selected
              </button>
              <button
                className={shared.subtleBtn}
                disabled={actionPending}
                onClick={async () => setCargoSel(await move('Deposited', selectedItems(cargo, selectAll(cargo)), (c, items) => c.spacemolt_storage.deposit({ items })))}
                type="button"
              >
                Deposit All Cargo
              </button>
              {hasFaction && (
                <button
                  className={shared.subtleBtn}
                  disabled={actionPending || cargoPicked.length === 0}
                  onClick={async () => setCargoSel(await move('Deposited', cargoPicked, (c, items) => c.spacemolt_storage.deposit({ items, target: 'faction' })))}
                  type="button"
                >
                  <Users size={10} /> To Faction
                </button>
              )}
            </>
          }
        />
      </div>

      <StoredShips
        ships={storedShips}
        renderActions={(ship) => (
          <>
            <button
              className={shared.subtleBtn}
              disabled={actionPending}
              onClick={() => shipAction('load_ship', { item_id: ship.ship_id })}
              title="Load into your carrier's bay, or attach to your tow rig"
              type="button"
            >
              Load / Tow
            </button>
            {hasFaction && (
              <button
                className={shared.subtleBtn}
                disabled={actionPending}
                onClick={() => shipAction('faction_garage', { item_id: ship.ship_id, target: 'faction' })}
                title="Park in the faction ship garage at this station"
                type="button"
              >
                <Users size={10} /> Faction Garage
              </button>
            )}
          </>
        )}
      />
    </div>
  )
}

function SendGiftSection({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <button className={styles.giftToggle} onClick={onToggle} type="button">
        <Send size={12} />
        Send Gift
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && children}
    </div>
  )
}

function StoredShips({ ships, renderActions }: { ships: StoredShip[]; renderActions?: (ship: StoredShip) => ReactNode }) {
  if (ships.length === 0) return null
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <Ship size={12} />
        Stored Ships ({ships.length})
      </div>
      <div className={styles.shipList}>
        {ships.map((ship) => (
          <div key={ship.ship_id} className={styles.shipCard}>
            <span className={styles.shipName}>{shipLabel(ship)}</span>
            <div className={styles.shipMeta}>
              <span className={styles.shipStat}>Modules: {ship.modules}</span>
              <span className={styles.shipStat}>Cargo: {ship.cargo_used}</span>
              {renderActions?.(ship)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Gifts kept in the ui store: from the gift_received push, the dock result, and docked storage views. */
function GiftsReceived() {
  const { uiStore } = usePlay()
  const gifts = usePlayUi(selectGifts)
  const [open, setOpen] = useState(true)
  if (gifts.length === 0) return null
  return (
    <div className={styles.giftsSection}>
      <button className={styles.giftToggle} onClick={() => setOpen(!open)} type="button">
        <Gift size={12} />
        <span className={styles.giftBadge}>{gifts.length}</span>
        Gifts Received
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className={styles.giftList}>
          {gifts.map((gift) => (
            <div key={`${gift.sender_id}-${gift.timestamp}`} className={styles.giftCard}>
              <div className={styles.giftHeader}>
                <span className={styles.giftSender}>From: {gift.sender}</span>
                <span className={styles.giftTime}>{gift.timestamp}</span>
              </div>
              {gift.message && <div className={styles.giftMessage}>{gift.message}</div>}
              <div className={styles.giftContents}>
                {gift.items && gift.items.length > 0 && (
                  <span className={styles.giftItems}>{gift.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}</span>
                )}
                {gift.ships && gift.ships.length > 0 && (
                  <span className={styles.giftShips}>{gift.ships.map((s) => s.class_name || s.class_id).join(', ')}</span>
                )}
                {gift.credits != null && gift.credits > 0 && (
                  <span className={styles.giftCredits}><Credits amount={gift.credits} /></span>
                )}
              </div>
            </div>
          ))}
          <button className={shared.subtleBtn} onClick={() => uiStore.dispatch({ type: 'gifts_dismissed' })} type="button">
            <X size={10} /> Clear
          </button>
        </div>
      )}
    </div>
  )
}
