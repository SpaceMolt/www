'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CircuitBoard, Cpu, Crosshair, Plus, RotateCcw, Search, Shield, ShoppingCart, Wrench, X, Zap } from 'lucide-react'
import type { Account } from '@spacemolt/lib'
import {
  useAccountStore,
  useCargo,
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  useModules,
  usePendingAction,
  usePlayer,
  useShip,
} from '@/lib/spacemolt'
import { allItems, getItem, isModule, type RawCatalogItem } from '@/data/catalog'
import { usePlay, usePlayUi } from '../../PlayProvider'
import { ConfirmAction, Credits, errorMessage, shared } from '../../shared'
import { ItemName } from '../../ItemTooltip'
import { useFactionPermissions, useStationServices } from '../../hooks/useGates'
import { canRefit } from '../shipModules'
import { selectStorageRevision, usePersonalStorage } from '../trading/StorageView'
import {
  addedModules,
  assignSources,
  countBy,
  keptFlags,
  quantities,
  withoutMissing,
  type FitPreview,
  type FitPreviewStats,
  type FitSource,
  type Holdings,
  type Sourced,
} from './loadoutPlan'
import shipStyles from '../ShipPanel.module.css'
import styles from './BuilderView.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

type Slot = 'weapon' | 'defense' | 'utility'
const SLOTS: { slot: Slot; label: string; icon: React.ReactNode }[] = [
  { slot: 'weapon', label: 'Weapon', icon: <Crosshair size={12} /> },
  { slot: 'defense', label: 'Defense', icon: <Shield size={12} /> },
  { slot: 'utility', label: 'Utility', icon: <CircuitBoard size={12} /> },
]
const SOURCE_LABEL: Record<FitSource, string> = { cargo: 'Cargo', storage: 'Your storage', faction: 'Faction storage', market: 'Buy here' }
const SOURCE_BADGE: Record<FitSource, string> = { cargo: shared.badgeGreen, storage: shared.badgeCyan, faction: shared.badgePurple, market: shared.badgeOrange }

/** The slot install_mod charges a module to (gameserver moduleSlot): mining modules use utility slots. */
const slotOf = (item: RawCatalogItem | undefined): Slot | undefined =>
  item?.type === 'weapon' ? 'weapon' : item?.type === 'defense' ? 'defense' : item?.type === 'utility' || item?.type === 'mining' ? 'utility' : undefined

/** Run the server's fit_preview. A raw query, so it works before the published client library lists it. */
const fetchPreview = async (account: Account, modules: string[]) =>
  (await account.query('spacemolt_ship', 'fit_preview', { modules })).structuredContent as unknown as FitPreview

/** Plan a full fit for the active ship, see its stats from the server's own math, then apply it. */
export function BuilderView() {
  const ship = useShip()
  const fittedModules = useModules() ?? []
  const fitted = useMemo(() => fittedModules.flatMap((m) => (m.type_id ? [m.type_id] : [])), [fittedModules])
  const fittedKey = fitted.join(',')
  const [plan, setPlan] = useState<string[]>(fitted)
  const [applying, setApplying] = useState(false)
  // A refit made elsewhere, or a finished Apply, restarts the plan from the new fit.
  useEffect(() => {
    if (!applying) setPlan(fittedKey ? fittedKey.split(',') : [])
  }, [fittedKey, applying])

  const [debouncedPlan, setDebouncedPlan] = useState(plan)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPlan(plan), 300)
    return () => clearTimeout(t)
  }, [plan])
  const { data: preview, errorCode, error: previewError } = useCommandQuery(
    (account) => fetchPreview(account, debouncedPlan),
    [debouncedPlan.join(','), fittedKey],
  )

  const holdings = useHoldings()
  const credits = usePlayer()?.credits ?? 0
  const added = addedModules(plan, fitted)
  const sourced = assignSources(added, holdings, credits)
  const missing = sourced.filter((s) => !s.source)

  if (!ship) return null
  if (errorCode === 'invalid_action' || errorCode === 'unknown_command') {
    return <div className={shared.emptyState}>The loadout builder needs a game server update that is not live yet.</div>
  }

  return (
    <div className={styles.builder}>
      <div className={styles.toolbar}>
        <span className={styles.hint}>Start from your current fit. Add modules from the list below, or remove them from a slot.</span>
        <button className={shared.subtleBtn} onClick={() => setPlan(fitted)} disabled={plan.join(',') === fittedKey} type="button">
          <RotateCcw size={10} /> Reset to current fit
        </button>
      </div>

      {previewError && <div className={shipStyles.modError}><AlertTriangle size={12} /> {errorMessage(previewError)}</div>}
      {preview && <StatsTable preview={preview.stats} />}
      {preview && preview.issues.length > 0 && (
        <ul className={styles.issues}>
          {preview.issues.map((issue) => <li key={issue.code + issue.message}><AlertTriangle size={11} /> {issue.message}</li>)}
        </ul>
      )}

      <PlannedSlots plan={plan} fitted={fitted} stats={preview?.stats} sourced={sourced} onRemove={(i) => setPlan(plan.filter((_, j) => j !== i))} />

      {preview && (
        <ApplyPlan plan={plan} fitted={fitted} preview={preview} sourced={sourced} stale={debouncedPlan.join(',') !== plan.join(',')} onApplying={setApplying} />
      )}
      {missing.length > 0 && <MissingOrders missing={missing} bids={holdings.bids} />}

      <ModulePicker stats={preview?.stats} plan={plan} holdings={holdings} onAdd={(id) => setPlan([...plan, id])} />
    </div>
  )
}

/** Cargo, your storage and faction storage here, and the market's asks: everything Apply can take modules from. */
function useHoldings(): Holdings & { bids: Record<string, number> } {
  const docked = useLocationState()?.docked_at
  const services = useStationServices()
  const hasStorage = services.includes('storage')
  const hasMarket = services.includes('market')
  const cargo = useCargo()
  const { data: storage } = usePersonalStorage({ enabled: hasStorage })
  const canUseFaction = useFactionPermissions({ enabled: hasStorage }).can('manage_treasury')
  const revision = usePlayUi(selectStorageRevision)
  const { data: faction } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view({ target: 'faction' })).structuredContent as { items?: { item_id: string; quantity: number }[] } | undefined,
    [docked, revision],
    { enabled: hasStorage && canUseFaction },
  )
  const { data: market } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_market.view_market()).structuredContent,
    [docked, revision],
    { enabled: hasMarket, refreshOnSections: ['cargo'] },
  )
  return useMemo(() => ({
    cargo: quantities(cargo ?? []),
    storage: hasStorage ? quantities(storage?.items) : {},
    faction: hasStorage && canUseFaction ? quantities(faction?.items) : {},
    asks: Object.fromEntries((hasMarket ? market?.items ?? [] : []).map((item) => [
      item.item_id,
      [...item.sell_orders].sort((a, b) => a.price_each - b.price_each).map((l) => ({ price: l.price_each, qty: l.quantity })),
    ])),
    bids: Object.fromEntries((hasMarket ? market?.items ?? [] : []).filter((item) => item.best_buy > 0).map((item) => [item.item_id, item.best_buy])),
  }), [cargo, storage, faction, market, hasStorage, hasMarket, canUseFaction])
}

type ShipState = NonNullable<ReturnType<typeof useShip>>
type StatRow = {
  label: string
  now: (s: ShipState) => number | undefined
  planned: (p: FitPreviewStats) => number
  /** Capacity the value is spent against, now and planned. */
  cap?: [(s: ShipState) => number | undefined, (p: FitPreviewStats) => number]
}
const STAT_ROWS: StatRow[] = [
  { label: 'Hull', now: (s) => s.max_hull, planned: (p) => p.max_hull },
  { label: 'Shield', now: (s) => s.max_shield, planned: (p) => p.max_shield },
  { label: 'Shield recharge', now: (s) => s.shield_recharge, planned: (p) => p.shield_recharge },
  { label: 'Armor', now: (s) => s.armor, planned: (p) => p.armor },
  { label: 'Speed', now: (s) => s.speed, planned: (p) => p.speed },
  { label: 'Fuel tank', now: (s) => s.max_fuel, planned: (p) => p.max_fuel },
  { label: 'Cargo', now: (s) => s.cargo_capacity, planned: (p) => p.cargo_capacity },
  { label: 'CPU used', now: (s) => s.cpu_used, planned: (p) => p.cpu_used, cap: [(s) => s.cpu_capacity, (p) => p.cpu_capacity] },
  { label: 'Power used', now: (s) => s.power_used, planned: (p) => p.power_used, cap: [(s) => s.power_capacity, (p) => p.power_capacity] },
  { label: 'Crew berths', now: (s) => s.effective_crew_capacity, planned: (p) => p.effective_crew_capacity },
  { label: 'Marine berths', now: (s) => s.effective_marine_capacity, planned: (p) => p.effective_marine_capacity },
]

/** Current ship stats beside the planned fit's. CPU and power are after your Engineering bonus. */
function StatsTable({ preview }: { preview: FitPreviewStats }) {
  const ship = useShip()
  if (!ship) return null
  return (
    <table className={styles.stats}>
      <thead><tr><th>Stat</th><th>Now</th><th>Planned</th></tr></thead>
      <tbody>
        {STAT_ROWS.map(({ label, now, planned, cap }) => {
          const before = now(ship) ?? 0
          const after = planned(preview)
          const fmt = (v: number, c?: number) => (c === undefined ? v.toLocaleString() : `${v} / ${c}`)
          const over = cap && after > cap[1](preview)
          const changed = after !== before || (cap && cap[0](ship) !== cap[1](preview))
          return (
            <tr key={label} className={over ? styles.over : changed ? styles.changed : undefined}>
              <td>{label}</td>
              <td>{fmt(before, cap?.[0](ship))}</td>
              <td>{fmt(after, cap?.[1](preview))}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** The planned fit by slot. Modules already fitted say so; added ones show where Apply gets them. */
function PlannedSlots({ plan, fitted, stats, sourced, onRemove }: {
  plan: string[]
  fitted: string[]
  stats?: FitPreviewStats
  sourced: Sourced[]
  onRemove: (index: number) => void
}) {
  const kept = keptFlags(plan, fitted)
  // Sources line up with the plan's added modules in order.
  const sourceAt = new Map<number, Sourced>()
  plan.forEach((_, i) => { if (!kept[i]) sourceAt.set(i, sourced[sourceAt.size]) })
  return (
    <div className={shipStyles.slotGrid}>
      {SLOTS.map(({ slot, label, icon }) => {
        const entries = plan.map((id, i) => ({ id, i })).filter(({ id }) => (slotOf(getItem(id)) ?? 'utility') === slot)
        const total = stats?.[`${slot}_slots`]
        return (
          <div key={slot} className={shipStyles.slotColumn}>
            <div className={shipStyles.slotColumnHeader}>
              {icon} {label} ({entries.length}/{total ?? '?'})
            </div>
            {entries.map(({ id, i }) => {
              const src = sourceAt.get(i)
              return (
                <div key={i} className={shipStyles.slotFilled}>
                  <div className={styles.plannedRow}>
                    <span className={shipStyles.slotModName}><ItemName itemId={id}>{getItem(id)?.name ?? id}</ItemName></span>
                    <button className={shared.iconBtn} onClick={() => onRemove(i)} title="Remove from the plan" type="button"><X size={11} /></button>
                  </div>
                  <div className={shipStyles.slotModMeta}>
                    {kept[i] ? <span className={shared.badgeGrey}>Fitted</span>
                      : src?.source ? <span className={SOURCE_BADGE[src.source]}>{SOURCE_LABEL[src.source]}{src.price !== undefined && <> <Credits amount={src.price} /></>}</span>
                        : <span className={shared.badgeRed}>Not available here</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Apply runs the server's step order, one action per tick: before each install it takes the module from cargo,
 * else withdraws or buys it. Modules the plan removes go to station storage at the end. It stops on the first error.
 */
function ApplyPlan({ plan, fitted, preview, sourced, stale, onApplying }: {
  plan: string[]
  fitted: string[]
  preview: FitPreview
  sourced: Sourced[]
  stale: boolean
  onApplying: (applying: boolean) => void
}) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const busy = usePendingAction() !== null
  const isDocked = Boolean(useLocationState()?.docked_at)
  const hasStorage = useStationServices().includes('storage')
  const refitOk = canRefit(isDocked, useModules() ?? [])
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const missing = sourced.filter((s) => !s.source).length
  const changes = addedModules(plan, fitted).length + addedModules(fitted, plan).length
  if (changes === 0 || !refitOk) return null
  const ready = preview.valid && !stale && missing < changes

  const apply = async () => {
    setConfirming(false)
    setError(null)
    onApplying(true)
    try {
      const target = missing > 0 ? withoutMissing(plan, fitted, sourced) : plan
      const { valid, issues, steps } = missing > 0 ? await fetchPreview(store.account, target) : preview
      if (!valid) throw new Error(`Without the missing modules the fit is refused: ${issues.map((i) => i.message).join(' ')}`)
      const queue = sourced.filter((s) => s.source && s.source !== 'cargo')
      const inCargo = (id: string) => quantities(store.getSection('cargo') ?? [])[id] ?? 0
      const items = (id: string) => [{ item_id: id, quantity: 1 }]
      for (const [n, step] of steps.entries()) {
        setProgress(`Step ${n + 1} of ${steps.length}: ${step.action === 'install_mod' ? 'fit' : 'unfit'} ${step.name}`)
        if (step.action === 'uninstall_mod') {
          await mutate((c) => c.spacemolt.uninstall_mod({ id: step.module_id }), { label: 'uninstall_mod' })
          continue
        }
        if (inCargo(step.type_id) === 0) {
          const i = queue.findIndex((s) => s.typeId === step.type_id)
          // A module unfitted for a moment lands in storage when the hold is full.
          const source = i >= 0 ? queue.splice(i, 1)[0].source : 'storage'
          if (source === 'market') await mutate((c) => c.spacemolt.buy({ id: step.type_id, quantity: 1, deliver_to: 'cargo' }), { label: 'buy' })
          else await mutate((c) => c.spacemolt_storage.withdraw(source === 'faction' ? { items: items(step.type_id), target: 'faction' } : { items: items(step.type_id) }), { label: 'Withdrawing' })
          uiStore.dispatch({ type: 'storage_changed' })
        }
        await mutate((c) => c.spacemolt.install_mod({ id: step.type_id }), { label: 'install_mod' })
      }
      const removed = countBy(steps.filter((s) => s.action === 'uninstall_mod' && !s.temporary).map((s) => s.type_id))
      const toStore = Object.entries(removed).map(([id, qty]) => ({ item_id: id, quantity: Math.min(qty, inCargo(id)) })).filter((i) => i.quantity > 0)
      if (hasStorage && toStore.length > 0) {
        setProgress('Moving removed modules to storage')
        await mutate((c) => c.spacemolt_storage.deposit({ items: toStore }), { label: 'Depositing' })
        uiStore.dispatch({ type: 'storage_changed' })
      }
      uiStore.dispatch({ type: 'toast', kind: 'success', text: 'Loadout applied' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setProgress(null)
      onApplying(false)
    }
  }

  return (
    <div className={styles.apply}>
      {progress && <div className={styles.progress}><Wrench size={11} /> {progress}</div>}
      {error && <div className={shipStyles.modError}><AlertTriangle size={12} /> Stopped: {error}</div>}
      {ready && !progress && (
        <ol className={styles.steps}>
          {preview.steps.map((s, i) => (
            <li key={i}>{s.action === 'install_mod' ? 'Fit' : 'Unfit'} {s.name}{s.temporary && ' (fitted again later)'}</li>
          ))}
        </ol>
      )}
      {!progress && (confirming ? (
        <ConfirmAction
          message={missing > 0 ? `Apply without the ${missing} module${missing === 1 ? '' : 's'} not available here?` : 'Apply this loadout? Each step takes one tick.'}
          onConfirm={apply}
          onCancel={() => setConfirming(false)}
          confirmDisabled={busy}
        />
      ) : ready && (
        <button className={shared.confirmBtn} onClick={() => setConfirming(true)} disabled={busy} type="button">
          <Wrench size={10} /> {missing > 0 ? 'Apply what is available' : 'Apply loadout'}
        </button>
      ))}
    </div>
  )
}

/** The last price this module traded at: here first, else anywhere. Undefined when it has not traded in a week. */
async function lastFill(itemId: string, station: string): Promise<number | undefined> {
  for (const where of [`&station=${encodeURIComponent(station)}`, '']) {
    const res = await fetch(`${API_BASE}/api/market/fills?item=${encodeURIComponent(itemId)}${where}&hours=168&limit=1`)
    if (!res.ok) return undefined
    const price = ((await res.json()) as { fills?: { price_each: number }[] }).fills?.[0]?.price_each
    if (price) return price
  }
  return undefined
}

/** One buy order per module Apply could not get, prefilled at the best bid here or the last fill. */
function MissingOrders({ missing, bids }: { missing: Sourced[]; bids: Record<string, number> }) {
  const docked = useLocationState()?.docked_at
  const hasMarket = useStationServices().includes('market')
  const counts = countBy(missing.map((s) => s.typeId))
  return (
    <div className={styles.missing}>
      <div className={shared.sectionTitle}><ShoppingCart size={12} /> Not available here</div>
      {Object.entries(counts).map(([id, qty]) => (
        <BuyOrderRow key={id} itemId={id} quantity={qty} bid={bids[id]} station={(hasMarket && docked) || undefined} />
      ))}
    </div>
  )
}

function BuyOrderRow({ itemId, quantity, bid, station }: { itemId: string; quantity: number; bid?: number; station?: string }) {
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const busy = usePendingAction() !== null
  const [price, setPrice] = useState(bid ? String(bid) : '')
  const [confirming, setConfirming] = useState(false)
  const [placed, setPlaced] = useState(false)
  useEffect(() => {
    if (bid || !station) return
    let cancelled = false
    lastFill(itemId, station).then((p) => { if (!cancelled && p) setPrice((cur) => cur || String(p)) }, () => {})
    return () => { cancelled = true }
  }, [itemId, bid, station])

  const priceEach = parseInt(price, 10)
  const place = async () => {
    setConfirming(false)
    try {
      await mutate((c) => c.spacemolt_market.create_buy_order({ item_id: itemId, quantity, price_each: priceEach }), { label: 'create_buy_order' })
      setPlaced(true)
      uiStore.dispatch({ type: 'toast', kind: 'success', text: `Buy order placed for ${quantity} ${getItem(itemId)?.name ?? itemId}` })
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    }
  }

  return (
    <div className={shipStyles.cargoItem}>
      <span className={shipStyles.cargoName}><ItemName itemId={itemId}>{getItem(itemId)?.name ?? itemId}</ItemName> x{quantity}</span>
      {station && !placed && (
        <span className={shipStyles.cargoMeta}>
          <input className={shipStyles.cargoQtyInput} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} title="Price each" placeholder="cr each" />
          {confirming ? (
            <ConfirmAction
              message={`Post a buy order: ${quantity} at ${priceEach.toLocaleString()} cr each?`}
              onConfirm={place}
              onCancel={() => setConfirming(false)}
              confirmDisabled={busy}
            />
          ) : (
            <button className={shared.actionBtn} onClick={() => setConfirming(true)} disabled={busy || !(priceEach > 0)} type="button">
              Buy order
            </button>
          )}
        </span>
      )}
      {placed && <span className={shared.badgeGreen}>Order placed</span>}
    </div>
  )
}

type SourceFilter = 'any' | FitSource

/** The full module catalog, searchable and filtered by slot, what still fits, and where it can come from. */
function ModulePicker({ stats, plan, holdings, onAdd }: { stats?: FitPreviewStats; plan: string[]; holdings: Holdings; onAdd: (id: string) => void }) {
  const [search, setSearch] = useState('')
  const [slot, setSlot] = useState<'all' | Slot>('all')
  const [fitsOnly, setFitsOnly] = useState(false)
  const [source, setSource] = useState<SourceFilter>('any')
  const modules = useMemo(() => allItems().filter(isModule).sort((a, b) => a.name.localeCompare(b.name)), [])
  const planned = countBy(plan)
  const available = (m: RawCatalogItem): Record<FitSource, number> => ({
    cargo: holdings.cargo[m.id] ?? 0,
    storage: holdings.storage[m.id] ?? 0,
    faction: holdings.faction[m.id] ?? 0,
    market: (holdings.asks[m.id] ?? []).reduce((n, l) => n + l.qty, 0),
  })
  const fits = (m: RawCatalogItem) => {
    if (!stats) return true
    const s = slotOf(m)
    const slotFree = !s || stats[`${s}_slots_used`] < stats[`${s}_slots`]
    return slotFree && (m.cpu_usage ?? 0) <= stats.cpu_capacity - stats.cpu_used && (m.power_usage ?? 0) <= stats.power_capacity - stats.power_used
  }
  const q = search.trim().toLowerCase()
  const shown = modules.filter((m) =>
    (!q || m.name.toLowerCase().includes(q) || m.id.includes(q))
    && (slot === 'all' || slotOf(m) === slot)
    && (!fitsOnly || fits(m))
    && (source === 'any' || available(m)[source] > 0))

  return (
    <div className={styles.picker}>
      <div className={shared.sectionTitle}>Modules</div>
      <div className={styles.filters}>
        <span className={styles.search}><Search size={11} /><input className={shared.textInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search modules" /></span>
        <select className={shared.selectInput} value={slot} onChange={(e) => setSlot(e.target.value as 'all' | Slot)} title="Slot">
          <option value="all">All slots</option>
          {SLOTS.map(({ slot: s, label }) => <option key={s} value={s}>{label}</option>)}
        </select>
        <select className={shared.selectInput} value={source} onChange={(e) => setSource(e.target.value as SourceFilter)} title="Where it comes from">
          <option value="any">Any source</option>
          <option value="cargo">In cargo</option>
          <option value="storage">Your storage here</option>
          <option value="faction">Faction storage here</option>
          <option value="market">For sale here</option>
        </select>
        <label className={styles.check}><input type="checkbox" checked={fitsOnly} onChange={(e) => setFitsOnly(e.target.checked)} /> Fits free CPU, power and slots</label>
      </div>
      <div className={shipStyles.installList}>
        {shown.length === 0 && <div className={shared.emptyState}>No modules match</div>}
        {shown.slice(0, 100).map((m) => {
          const have = available(m)
          const cheapest = holdings.asks[m.id]?.find((l) => l.qty > 0)?.price
          return (
            <div key={m.id} className={shipStyles.installItem}>
              <div className={shipStyles.installInfo}>
                <span className={shipStyles.installName}><ItemName itemId={m.id}>{m.name}</ItemName></span>
                <div className={shipStyles.installMeta}>
                  <span className={shared.badgeGrey}>{slotOf(m) ?? m.type}</span>
                  <span className={shipStyles.slotStat}><Cpu size={9} /> {m.cpu_usage ?? 0}</span>
                  <span className={shipStyles.slotStat}><Zap size={9} /> {m.power_usage ?? 0}</span>
                  {(['cargo', 'storage', 'faction'] as const).filter((s) => have[s] > 0).map((s) => (
                    <span key={s} className={SOURCE_BADGE[s]}>{SOURCE_LABEL[s]} x{have[s]}</span>
                  ))}
                  {cheapest !== undefined && <span className={SOURCE_BADGE.market}>For sale <Credits amount={cheapest} /></span>}
                  {planned[m.id] > 0 && <span className={shared.badgeGrey}>Planned x{planned[m.id]}</span>}
                </div>
              </div>
              <button className={shared.actionBtn} onClick={() => onAdd(m.id)} type="button" title="Add to the plan">
                <Plus size={12} /> Add
              </button>
            </div>
          )
        })}
        {shown.length > 100 && <div className={shared.emptyState}>Showing 100 of {shown.length}. Search or filter to narrow the list.</div>}
      </div>
    </div>
  )
}
