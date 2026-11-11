'use client'

import { useMemo, useState } from 'react'
import {
  Users,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Coins,
  Fuel,
  MapPin,
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
import { usePlay, usePlayUi } from '../../PlayProvider'
import { Credits, ItemSelectList, QtyButtons, shared, useAction, useStorageMove } from '../../shared'
import { normalizeCargo, selectedItems, type Selection } from '../../shared/itemSelection'
import { parseCreditAmount } from './giftValidation'
import { selectStorageRevision, usePersonalStorage } from './StorageView'
import { storageStationOptions } from './storageLocations'
import { isOwnStation, useFactionService } from '../faction/useFactionService'
import { useFactionPermissions } from '../../hooks/useGates'
import { treasuryBalance } from './treasuryBalance'
import styles from './StorageView.module.css'

// StorageResponse is one generated union across every branch of the unified
// storage action (self view, faction view, deposit/withdraw/gift results) —
// narrow to the branch each view() call here actually returns.
type FactionStorageResponse = Extract<StorageResponse, { hint: string; faction_id: string }>

/**
 * FactionStorageView shows the faction lockbox at the current base (or, undocked, at a chosen
 * station, read-only). The main store and each Storage Extension bucket are separate compartments.
 */
export function FactionStorageView() {
  const { uiStore } = usePlay()
  const location = useLocationState()
  const dockedAt = location?.docked_at
  const isDocked = Boolean(dockedAt)
  const player = usePlayer()
  const hasFaction = Boolean(player?.faction_id)
  const walletCredits = player?.credits ?? 0
  const shipFuel = useShip()?.fuel ?? 0
  const rawCargo = useCargo()
  const cargo = useMemo(() => normalizeCargo(rawCargo), [rawCargo])
  const actionPending = usePendingAction() !== null
  const mutate = useCommandMutation()
  const move = useStorageMove()
  const revision = usePlayUi(selectStorageRevision)

  const { run } = useAction()

  // Undocked: pick a station from the personal storage locations and view the faction store there.
  const [remoteStation, setRemoteStation] = useState('')
  const stationId = isDocked ? undefined : remoteStation || undefined

  const {
    data: lastFactionData,
    loading: factionLoading,
    error: factionError,
    errorCode: factionErrorCode,
    refetch: refetchFaction,
  } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view({ target: 'faction', station_id: stationId })).structuredContent as FactionStorageResponse | undefined,
    [dockedAt, hasFaction, stationId, revision],
    { enabled: hasFaction && (isDocked || Boolean(stationId)), refreshOnSections: ['cargo'] },
  )

  // Docked without a lockbox, the server still answers the view (with an agent-facing hint),
  // so read the faction's facilities here instead. Treasury credits need no lockbox; items do.
  const hasLockbox = useFactionService('faction_storage')
  const noLockbox = factionErrorCode === 'no_faction_storage' || (isDocked && hasLockbox === false)
  // A failed view keeps the last station's data; never offer actions on it.
  const treasuryData = factionError ? undefined : lastFactionData
  const factionData = noLockbox || (isDocked && hasLockbox === undefined) ? undefined : treasuryData

  // On the faction's own station, faction fuel goes into the station tank, not a bunker.
  const { data: baseData } = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_base()).structuredContent,
    [dockedAt, hasFaction, revision],
    { enabled: isDocked && hasFaction },
  )
  const ownBase = isOwnStation(baseData?.base, player?.faction_id, dockedAt) ? baseData?.base : undefined
  const fuel = ownBase
    ? { label: 'Station tank', reserve: ownBase.fuel ?? 0, capacity: ownBase.max_fuel ?? 0 }
    : { label: 'Fuel bunker', reserve: treasuryData?.faction_fuel_reserve ?? 0, capacity: treasuryData?.faction_fuel_capacity ?? 0 }

  const { data: personalData } = usePersonalStorage({ enabled: hasFaction })
  // Taking anything out of faction storage needs manage_treasury.
  const factionPerms = useFactionPermissions({ enabled: hasFaction })
  const canWithdraw = factionPerms.can('manage_treasury')
  // Credits move anywhere; undocked with no station picked, the balance comes from faction info.
  const treasury = treasuryBalance({ view: treasuryData, info: factionPerms.info })
  const personalStorage = isDocked ? personalData?.items ?? [] : []

  const [bucket, setBucket] = useState('')
  const [destBucket, setDestBucket] = useState('')
  const [factionSel, setFactionSel] = useState<Selection>({})
  const [cargoSel, setCargoSel] = useState<Selection>({})
  const [personalSel, setPersonalSel] = useState<Selection>({})
  const [treasuryAmount, setTreasuryAmount] = useState('')
  const [fuelAmount, setFuelAmount] = useState('')

  const changed = () => uiStore.dispatch({ type: 'storage_changed' })

  // Treasury credits: wallet <-> faction
  // Fuel comes from the ship's tank, not cargo. The server takes the exact amount or nothing.
  const handleTreasury = async (kind: 'deposit' | 'withdraw', quantity: number | null, item: 'credits' | 'fuel' = 'credits') => {
    if (actionPending || quantity === null) return
    await run(item, async () => {
      const args = { item_id: item, quantity, target: 'faction' }
      const label = `faction_${kind}_${item}`
      if (kind === 'deposit') await mutate((c) => c.spacemolt_storage.deposit(args), { label })
      else await mutate((c) => c.spacemolt_storage.withdraw(args), { label })
      if (item === 'fuel') setFuelAmount('')
      else { setTreasuryAmount(''); factionPerms.refetch() }
      changed()
    })
  }

  if (!hasFaction) {
    return <div className={shared.emptyState}>Join a faction to access faction storage.</div>
  }

  const stations = storageStationOptions(personalData)
  const buckets = factionData?.buckets ?? []
  const compartment = buckets.find((b) => b.id === bucket)
  const factionItems = (compartment ? compartment.items : factionData?.items) ?? []
  const bucketArg = bucket || undefined
  const factionPicked = selectedItems(factionItems, factionSel)
  const cargoPicked = selectedItems(cargo, cargoSel)
  const personalPicked = selectedItems(personalStorage, personalSel)
  const fuelQty = parseCreditAmount(fuelAmount, shipFuel)
  const compartmentName = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Main store'
  const pickBucket = (id: string) => { setBucket(id); setFactionSel({}) }
  const destOptions = ['', ...buckets.map((b) => b.id)].filter((id) => id !== bucket)
  const dest = destOptions.includes(destBucket) ? destBucket : destOptions[0]

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          {isDocked ? <Users size={12} /> : <MapPin size={12} />}
          {isDocked ? 'Faction Storage' : 'Remote Faction Storage'}
        </span>
        <button className={shared.refreshBtn} onClick={refetchFaction} title="Refresh faction storage" type="button" disabled={factionLoading}>
          <RefreshCw size={13} />
        </button>
      </div>

      {!isDocked && (
        <div className={styles.section}>
          {stations.length > 0 ? (
            <select className={shared.selectInput} value={remoteStation} onChange={(e) => { setRemoteStation(e.target.value); pickBucket('') }}>
              <option value="">Select a station...</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          ) : (
            <div className={shared.dockedOnly}>Dock at a base to use faction storage</div>
          )}
        </div>
      )}

      {factionLoading && !treasuryData && <div className={styles.loading}>Loading faction storage...</div>}

      {factionError && !noLockbox && !factionLoading && <div className={shared.emptyState}>{factionError}</div>}

      {treasury !== undefined && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Coins size={12} />
            Treasury: <Credits amount={treasury} />
          </div>
          <div className={styles.itemRow}>
            <div className={styles.itemInfo}>
              <span className={styles.itemQty}>Wallet: <Credits amount={walletCredits} /></span>
            </div>
            <div className={styles.itemAction}>
              <input className={styles.qtyInput} type="number" min={1} step={1} placeholder="cr" value={treasuryAmount} onChange={(e) => setTreasuryAmount(e.target.value)} />
              <QtyButtons max={canWithdraw ? Math.max(walletCredits, treasury) : walletCredits} current={treasuryAmount} onChange={setTreasuryAmount} />
              <button
                className={shared.confirmBtn}
                onClick={() => handleTreasury('deposit', parseCreditAmount(treasuryAmount, walletCredits))}
                disabled={actionPending || parseCreditAmount(treasuryAmount, walletCredits) === null}
                title="Deposit credits to the faction treasury"
                type="button"
              >
                <ArrowDownToLine size={10} /> Deposit
              </button>
              {canWithdraw && (
                <button
                  className={shared.accentBtn}
                  onClick={() => handleTreasury('withdraw', parseCreditAmount(treasuryAmount, treasury))}
                  disabled={actionPending || parseCreditAmount(treasuryAmount, treasury) === null}
                  title="Withdraw credits to your wallet"
                  type="button"
                >
                  <ArrowUpFromLine size={10} /> Withdraw
                </button>
              )}
            </div>
          </div>
          {treasuryData && isDocked && fuel.capacity > 0 && (
            <div className={styles.itemRow}>
              <div className={styles.itemInfo}>
                <Fuel size={11} />
                <span className={styles.itemQty}>
                  {fuel.label}: {fuel.reserve}/{fuel.capacity} · Ship tank: {shipFuel}
                </span>
              </div>
              <div className={styles.itemAction}>
                <input className={styles.qtyInput} type="number" min={1} step={1} placeholder="fuel" value={fuelAmount} onChange={(e) => setFuelAmount(e.target.value)} />
                <QtyButtons max={shipFuel} current={fuelAmount} onChange={setFuelAmount} />
                <button
                  className={shared.confirmBtn}
                  onClick={() => handleTreasury('deposit', fuelQty, 'fuel')}
                  disabled={actionPending || fuelQty === null}
                  title={`Move fuel from your ship's tank to the ${fuel.label.toLowerCase()}`}
                  type="button"
                >
                  <ArrowDownToLine size={10} /> Deposit Fuel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {noLockbox && <div className={shared.emptyState}>No Faction Lockbox here. Build one in the Facilities tab to store items.</div>}

      {factionData && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Box size={12} />
            Faction Items ({factionItems.length})
            {buckets.length > 0 && (
              <select className={shared.selectInput} value={bucket} onChange={(e) => pickBucket(e.target.value)} title="Storage compartment">
                <option value="">Main store</option>
                {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
          <ItemSelectList
            items={factionItems}
            selection={factionSel}
            onChange={setFactionSel}
            readOnly={!isDocked || !canWithdraw}
            empty="No items in this compartment"
            actions={
              <>
                <button
                  className={shared.accentBtn}
                  disabled={actionPending || factionPicked.length === 0}
                  onClick={async () => setFactionSel(await move('Withdrew', factionPicked, (c, items) => c.spacemolt_storage.withdraw({ items, target: 'faction', bucket: bucketArg }), 'from faction storage to cargo'))}
                  title="Withdraw to your cargo"
                  type="button"
                >
                  <ArrowUpFromLine size={10} /> To Cargo
                </button>
                <button
                  className={shared.subtleBtn}
                  disabled={actionPending || factionPicked.length === 0}
                  onClick={async () => setFactionSel(await move('Moved', factionPicked, (c, items) => c.spacemolt_storage.withdraw({ items, source: 'faction', target: 'self', bucket: bucketArg }), 'from faction storage to your storage'))}
                  title="Move to your personal storage here"
                  type="button"
                >
                  To Personal Storage
                </button>
                {buckets.length > 0 && (
                  <>
                    <select className={shared.selectInput} value={dest} onChange={(e) => setDestBucket(e.target.value)} title="Destination compartment">
                      {destOptions.map((id) => (
                        <option key={id} value={id}>{compartmentName(id)}</option>
                      ))}
                    </select>
                    <button
                      className={shared.subtleBtn}
                      disabled={actionPending || factionPicked.length === 0}
                      onClick={async () => setFactionSel(await move('Moved', factionPicked, (c, items) =>
                        c.spacemolt_storage.deposit({ items, source: 'faction', target: 'faction', bucket: bucketArg, dest_bucket: dest || undefined }), `to ${compartmentName(dest)}`))}
                      title="Move between compartments"
                      type="button"
                    >
                      Move to Compartment
                    </button>
                  </>
                )}
              </>
            }
          />
        </div>
      )}

      {factionData && isDocked && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Box size={12} />
            Deposit from Cargo to {compartmentName(bucket)} ({cargo.length})
          </div>
          <ItemSelectList
            items={cargo}
            selection={cargoSel}
            onChange={setCargoSel}
            empty="Cargo hold is empty"
            actions={
              <button
                className={shared.confirmBtn}
                disabled={actionPending || cargoPicked.length === 0}
                onClick={async () => setCargoSel(await move('Deposited', cargoPicked, (c, items) => c.spacemolt_storage.deposit({ items, target: 'faction', bucket: bucketArg }), 'from cargo to faction storage'))}
                type="button"
              >
                <ArrowDownToLine size={10} /> Deposit to Faction
              </button>
            }
          />
        </div>
      )}

      {factionData && personalStorage.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Box size={12} />
            Move from Personal Storage to {compartmentName(bucket)} ({personalStorage.length})
          </div>
          <ItemSelectList
            items={personalStorage}
            selection={personalSel}
            onChange={setPersonalSel}
            actions={
              <button
                className={shared.confirmBtn}
                disabled={actionPending || personalPicked.length === 0}
                onClick={async () => setPersonalSel(await move('Moved', personalPicked, (c, items) => c.spacemolt_storage.deposit({ items, source: 'storage', target: 'faction', bucket: bucketArg }), 'from your storage to faction storage'))}
                type="button"
              >
                <ArrowDownToLine size={10} /> Move to Faction
              </button>
            }
          />
        </div>
      )}
    </div>
  )
}
