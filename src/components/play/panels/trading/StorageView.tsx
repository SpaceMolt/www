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
  useShip,
} from '@/lib/spacemolt'
import type { StorageResponse } from '@spacemolt/lib'
import type { UiState } from '@/lib/spacemolt'
import { usePlay, usePlayUi } from '../../PlayProvider'
import { Credits, ItemSelectList, shared, useAction, useStorageMove } from '../../shared'
import { normalizeCargo, selectAll, selectedItems, type Selection } from '../../shared/itemSelection'
import styles from './StorageView.module.css'
import { GiftForm, type GiftShip } from './GiftForm'
import { storageStationOptions, type StorageLocation } from './storageLocations'
import { timeAgoOrDate } from '@/lib/format'
import { formatItemId, getShip } from '@/data/catalog'
import { giftFromLog } from './tradingLogic'
import { useFittedModules, useStationServices } from '../../hooks/useGates'
import { useFactionService } from '../faction/useFactionService'

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

/** The personal storage view (station_id omitted), refetched after any storage change. */
export function usePersonalStorage({ enabled = true } = {}) {
  const dockedAt = useLocationState()?.docked_at
  const revision = usePlayUi(selectStorageRevision)
  return useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view()).structuredContent as PersonalStorageView | undefined,
    [dockedAt, revision],
    { enabled, refreshOnSections: ['cargo'] },
  )
}

export function StorageView() {
  const { uiStore } = usePlay()
  const location = useLocationState()
  const dockedAt = location?.docked_at
  const isDocked = Boolean(dockedAt)
  const hasStorage = useStationServices().includes('storage')
  const hasLockbox = useFactionService('faction_storage')
  const hasFactionGarage = useFactionService('faction_ship_garage')
  // gameserver storageV2LoadShip: a carrier bay on the active hull, or a fitted tow rig.
  const shipClassId = useShip()?.class_id
  const hasTowRig = useFittedModules().some((m) => (m.tow_speed_penalty ?? 0) > 0)
  const canLoadShip = hasTowRig ||
    Boolean(shipClassId && getShip(shipClassId)?.inherent_capabilities?.some((c) => c.type === 'ship_bay_capacity' && c.value > 0))
  const rawCargo = useCargo()
  const cargo = useMemo(() => normalizeCargo(rawCargo), [rawCargo])
  const actionPending = usePendingAction() !== null
  const mutate = useCommandMutation()
  const { run } = useAction()
  const move = useStorageMove()
  const revision = usePlayUi(selectStorageRevision)

  // Docked it is this station's storage; undocked it lists every station where the player stores something.
  const { data: storageData, error: storageError, refetch: refetchStorage } = usePersonalStorage({ enabled: !isDocked || hasStorage })
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

  const shipAction = (label: string, args: { item_id: string; target?: string }) =>
    run(label, async () => {
      await mutate((c) => c.spacemolt_storage.deposit(args), { label })
      uiStore.dispatch({ type: 'storage_changed' })
    })

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
          <GiftForm cargo={[]} stored={[]} ships={giftShips(viewShips)} hasStorage={false} />
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

  // --- Docked without a storage service: only gifts of credits and ships ---
  if (!hasStorage) {
    return (
      <div className={styles.container}>
        <GiftsReceived />
        <SendGiftSection open={showSendGift} onToggle={() => setShowSendGift(!showSendGift)}>
          <GiftForm cargo={[]} stored={[]} ships={[]} hasStorage={false} />
        </SendGiftSection>
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
        <GiftForm cargo={cargo} stored={storedItems} ships={giftShips(storedShips)} hasStorage />
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
                onClick={async () => setStoredSel(await move('Withdrew', storedPicked, (c, items) => c.spacemolt_storage.withdraw({ items }), 'from storage to cargo'))}
                type="button"
              >
                <ArrowUpFromLine size={10} /> Withdraw to Cargo
              </button>
              {hasLockbox && (
                <button
                  className={shared.subtleBtn}
                  disabled={actionPending || storedPicked.length === 0}
                  onClick={async () => setStoredSel(await move('Moved', storedPicked, (c, items) => c.spacemolt_storage.deposit({ items, source: 'storage', target: 'faction' }), 'from storage to faction storage'))}
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
                onClick={async () => setCargoSel(await move('Deposited', cargoPicked, (c, items) => c.spacemolt_storage.deposit({ items }), 'from cargo to storage'))}
                type="button"
              >
                <ArrowDownToLine size={10} /> Deposit Selected
              </button>
              <button
                className={shared.subtleBtn}
                disabled={actionPending}
                onClick={async () => setCargoSel(await move('Deposited', selectedItems(cargo, selectAll(cargo)), (c, items) => c.spacemolt_storage.deposit({ items }), 'from cargo to storage'))}
                type="button"
              >
                Deposit All Cargo
              </button>
              {hasLockbox && (
                <button
                  className={shared.subtleBtn}
                  disabled={actionPending || cargoPicked.length === 0}
                  onClick={async () => setCargoSel(await move('Deposited', cargoPicked, (c, items) => c.spacemolt_storage.deposit({ items, target: 'faction' }), 'from cargo to faction storage'))}
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
            {canLoadShip && (
              <button
                className={shared.subtleBtn}
                disabled={actionPending}
                onClick={() => shipAction('load_ship', { item_id: ship.ship_id })}
                title="Load into your carrier's bay, or attach to your tow rig"
                type="button"
              >
                Load / Tow
              </button>
            )}
            {hasFactionGarage && (
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

const GIFT_WINDOW_MS = 7 * 86400_000
const GIFT_EVENTS = ['trading.gift_received', 'ship.gift_received']

/**
 * Gifts from the action log (the durable record; the server's pending-gift list empties on dock).
 * Refetched on the gift_received push. Clear hides what is listed now, per player, in this browser.
 */
function GiftsReceived() {
  const playerId = usePlayer()?.id
  const seenKey = `spacemolt.play.giftsSeen.${playerId}`
  const [seen, setSeen] = useState(() => { try { return Number(localStorage.getItem(seenKey)) || 0 } catch { return 0 } })
  const [open, setOpen] = useState(true)
  const { data } = useCommandQuery(
    // The server takes an event_type array; the lib's param type lists only a string.
    async (account) => (await account.commands.spacemolt_social.get_action_log({ event_type: GIFT_EVENTS as unknown as string, page_size: 20 })).structuredContent,
    [],
    { refreshOnEvents: ['gift_received'] },
  )
  const gifts = (data?.entries ?? [])
    .filter((e) => e.id > seen && Date.now() - Date.parse(e.created_at) < GIFT_WINDOW_MS)
    .map(giftFromLog)
  if (gifts.length === 0) return null
  const clear = () => {
    const newest = Math.max(...gifts.map((g) => g.id))
    setSeen(newest)
    try { localStorage.setItem(seenKey, String(newest)) } catch { /* storage blocked */ }
  }
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
            <div key={gift.id} className={styles.giftCard}>
              <div className={styles.giftHeader}>
                <span className={styles.giftSender}>From: {gift.sender}</span>
                <span className={styles.giftTime} title={gift.at}>{timeAgoOrDate(gift.at)}</span>
              </div>
              <div className={styles.giftContents}>
                {gift.items.length > 0 && (
                  <span className={styles.giftItems}>{gift.items.map((i) => `${formatItemId(i.item_id)} x${i.quantity}`).join(', ')}</span>
                )}
                {gift.shipClass && <span className={styles.giftShips}>{getShip(gift.shipClass)?.name ?? formatItemId(gift.shipClass)}</span>}
                {gift.credits > 0 && <span className={styles.giftCredits}><Credits amount={gift.credits} /></span>}
              </div>
            </div>
          ))}
          <button className={shared.subtleBtn} onClick={clear} type="button">
            <X size={10} /> Clear
          </button>
        </div>
      )}
    </div>
  )
}
