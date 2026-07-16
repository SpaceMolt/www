'use client'

import { useCallback, useState } from 'react'
import {
  Rocket,
  Gauge,
  Shield,
  Crosshair,
  CircuitBoard,
  Package,
  Cpu,
  Zap,
  Hammer,
  Plus,
  ShieldPlus,
  Swords,
  ArrowDownToLine,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { useShip, useModules, useCargo, useLocationState, usePendingAction, useCommandMutation, useCatalog } from '@/lib/spacemolt'
import type { GameState } from '@spacemolt/lib'
import { usePlay } from '../PlayProvider'
import { ProgressBar } from '../ProgressBar'
import { Panel, Modal, shared } from '../shared'
import { ItemName } from '../ItemTooltip'
import { getItem as getCatalogRawItem, isModule } from '@/data/catalog'
import type { RawCatalogItem } from '@/data/catalog'
import styles from './ShipPanel.module.css'

type ModuleEntry = NonNullable<GameState['modules']>[number]
type CargoEntry = NonNullable<GameState['cargo']>[number]

interface ShipClassDetail {
  name: string
  description: string
  lore: string
  category: string
  class: string
  tier: number
  faction: string
}

type SlotType = 'weapon' | 'defense' | 'utility'

/** Read a numeric per-type module stat out of the loosely-typed `stats` bag. */
function statNum(stats: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = stats?.[key]
  return typeof v === 'number' ? v : undefined
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function ShipPanel() {
  const ship = useShip()
  const modules = useModules() ?? []
  const cargo = useCargo() ?? []
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const pendingAction = usePendingAction()
  const actionPending = pendingAction !== null
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const { data: catalog } = useCatalog()

  // Install modal
  const [installSlotType, setInstallSlotType] = useState<SlotType | null>(null)

  // Deposit controls (docked only) — per-item quantity + multi-select
  const [depositQtys, setDepositQtys] = useState<Record<string, string>>({})
  const [selectedCargo, setSelectedCargo] = useState<Record<string, boolean>>({})

  const classDetail: ShipClassDetail | null =
    ship?.class_id && catalog ? ((catalog.ship(ship.class_id) as unknown as ShipClassDetail) ?? null) : null

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorText(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
      uiStore.dispatch({ type: 'event', kind: 'danger', text })
    },
    [uiStore]
  )

  const handleUninstallModule = useCallback(
    (moduleId: string) => {
      mutate((c) => c.spacemolt.uninstall_mod({ id: moduleId }), { label: 'uninstall_mod' }).catch(reportError)
    },
    [mutate, reportError]
  )

  const handleRepairModule = useCallback(
    (moduleId: string) => {
      mutate((c) => c.spacemolt.repair_module({ id: moduleId }), { label: 'repair_module' }).catch(reportError)
    },
    [mutate, reportError]
  )

  const handleInstallModule = useCallback(
    (itemId: string) => {
      mutate((c) => c.spacemolt.install_mod({ id: itemId }), { label: 'install_mod' })
        .then(() => setInstallSlotType(null))
        .catch(reportError)
    },
    [mutate, reportError]
  )

  const handleDepositItem = useCallback(
    (itemId: string, maxQty: number) => {
      if (actionPending) return
      const qtyStr = depositQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      mutate((c) => c.spacemolt_storage.deposit({ item_id: itemId, quantity }), { label: 'deposit' }).catch(reportError)
      setDepositQtys((prev) => ({ ...prev, [itemId]: '' }))
      setSelectedCargo((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
    },
    [mutate, depositQtys, actionPending, reportError]
  )

  const handleDepositSelected = useCallback(() => {
    if (actionPending) return
    const items = cargo.flatMap((item) => {
      const itemId = item.item_id
      if (!itemId || !selectedCargo[itemId]) return []
      const maxQty = item.quantity ?? 0
      const qtyStr = depositQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return []
      return [{ item_id: itemId, quantity }]
    })
    if (items.length === 0) return
    mutate((c) => c.spacemolt_storage.deposit({ items }), { label: 'deposit' }).catch(reportError)
    setDepositQtys({})
    setSelectedCargo({})
  }, [mutate, cargo, selectedCargo, depositQtys, actionPending, reportError])

  if (!ship) {
    return (
      <Panel title="Ship" icon={<Rocket size={16} />}>
        <div className={shared.emptyState}>No ship data available</div>
      </Panel>
    )
  }

  // Sort modules into slot columns
  const weaponMods = modules.filter((m) => m.type === 'weapon')
  const defenseMods = modules.filter((m) => m.type === 'defense')
  const utilityMods = modules.filter((m) => m.type === 'mining' || m.type === 'utility')

  const weaponSlots = ship.weapon_slots ?? 0
  const defenseSlots = ship.defense_slots ?? 0
  const utilitySlots = ship.utility_slots ?? 0

  const emptyWeapon = Math.max(0, weaponSlots - weaponMods.length)
  const emptyDefense = Math.max(0, defenseSlots - defenseMods.length)
  const emptyUtility = Math.max(0, utilitySlots - utilityMods.length)

  const cpuCapacity = ship.cpu_capacity ?? 0
  const cpuUsed = ship.cpu_used ?? 0
  const powerCapacity = ship.power_capacity ?? 0
  const powerUsed = ship.power_used ?? 0

  // Get installable modules from cargo for a slot type
  const getInstallableModules = (slotType: SlotType): Array<{ item_id: string; name: string; quantity: number; catalogEntry?: RawCatalogItem }> =>
    cargo.flatMap((item) => {
      const itemId = item.item_id
      if (!itemId) return []
      const entry = getCatalogRawItem(itemId)
      if (!entry || !isModule(entry)) return []
      const modType = entry.type
      if (slotType === 'weapon' && modType !== 'weapon') return []
      if (slotType === 'defense' && modType !== 'defense') return []
      if (slotType === 'utility' && modType !== 'mining' && modType !== 'utility') return []
      return [{ item_id: itemId, name: item.item_name ?? itemId, quantity: item.quantity ?? 0, catalogEntry: entry }]
    })

  const renderModuleSlot = (mod: ModuleEntry, idx: number) => {
    const wear = mod.wear ?? 0
    const modInstanceId = mod.module_id ?? ''
    const damage = statNum(mod.stats, 'damage')
    const shieldBonus = statNum(mod.stats, 'shield_bonus')
    const miningPower = statNum(mod.stats, 'mining_power')
    const harvestPower = statNum(mod.stats, 'harvest_power')
    const scannerPower = statNum(mod.stats, 'scanner_power')
    const cargoBonus = statNum(mod.stats, 'cargo_bonus')
    const speedBonus = statNum(mod.stats, 'speed_bonus')
    return (
      <div key={modInstanceId || `mod-${idx}`} className={styles.slotFilled}>
        <div className={styles.slotModInfo}>
          <span className={styles.slotModName}><ItemName itemId={mod.type_id ?? ''}>{mod.name ?? ''}</ItemName></span>
          <div className={styles.slotModMeta}>
            {(mod.cpu_usage ?? 0) > 0 && <span className={styles.slotStat}><Cpu size={9} /> {mod.cpu_usage}</span>}
            {(mod.power_usage ?? 0) > 0 && <span className={styles.slotStat}><Zap size={9} /> {mod.power_usage}</span>}
            {damage && <span className={styles.slotStat}><Swords size={9} /> {damage}</span>}
            {shieldBonus && <span className={styles.slotStat}><ShieldPlus size={9} /> +{shieldBonus}</span>}
            {miningPower && <span className={styles.slotStat}>⛏ {miningPower}</span>}
            {harvestPower && <span className={styles.slotStat}>⛏ {harvestPower}</span>}
            {scannerPower && <span className={styles.slotStat}>📡 {scannerPower}</span>}
            {cargoBonus && <span className={styles.slotStat}><Package size={9} /> +{cargoBonus}</span>}
            {speedBonus && <span className={styles.slotStat}><Gauge size={9} /> +{speedBonus}</span>}
            {wear > 0 && <span className={styles.slotWear}>{mod.wear_status || `${Math.round(wear)}%`}</span>}
          </div>
        </div>
        <div className={styles.slotActions}>
          {isDocked && wear > 0 && (
            <button
              className={styles.repairModBtn}
              onClick={() => handleRepairModule(modInstanceId)}
              title="Repair module"
              type="button"
            >
              <Hammer size={11} />
            </button>
          )}
          {isDocked && (
            <button
              className={shared.dangerBtn}
              onClick={() => handleUninstallModule(modInstanceId)}
              title="Uninstall to cargo"
              type="button"
            >
              Uninstall
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderEmptySlot = (slotType: SlotType, idx: number) => (
    <div
      key={`empty-${slotType}-${idx}`}
      className={`${styles.slotEmpty} ${isDocked ? styles.slotClickable : ''}`}
      onClick={isDocked ? () => setInstallSlotType(slotType) : undefined}
      title={isDocked ? 'Click to install a module' : 'Dock to install modules'}
    >
      <Plus size={14} className={styles.slotEmptyIcon} />
    </div>
  )

  return (
    <Panel title="Ship" icon={<Rocket size={16} />}>
        {/* Ship overview */}
        <div className={styles.shipOverview}>
          <img
            src={`/images/ships/catalog/${ship.class_id ?? ''}.webp`}
            alt={ship.name ?? ''}
            className={styles.shipImage}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className={styles.shipOverviewText}>
            <div className={styles.shipNameRow}>
              <span className={styles.shipClass}>{ship.name}</span>
              {ship.custom_name && (
                <span className={styles.shipName}>&quot;{ship.custom_name}&quot;</span>
              )}
              {classDetail && (
                <>
                  {classDetail.faction && <span className={shared.badgePurple}>{classDetail.faction}</span>}
                  {classDetail.tier > 0 && <span className={shared.badgeCyan}>T{classDetail.tier}</span>}
                  {classDetail.category && <span className={shared.badgeGreen}>{classDetail.category}</span>}
                  {classDetail.class && <span className={shared.badgeGrey}>{classDetail.class}</span>}
                </>
              )}
              <span className={styles.overviewStat}><Gauge size={10} /> {ship.speed}</span>
              {(ship.armor ?? 0) > 0 && (
                <span className={styles.overviewStat}><Shield size={10} /> {ship.armor}</span>
              )}
              {(ship.shield_recharge ?? 0) > 0 && (
                <span className={styles.overviewStat}><ShieldPlus size={10} /> {ship.shield_recharge}/t</span>
              )}
            </div>
            {classDetail?.description && (
              <div className={styles.shipDescription}>{classDetail.description}</div>
            )}
          </div>
        </div>

        {/* Lore */}
        {classDetail?.lore && (
          <div className={styles.shipLore}>{classDetail.lore}</div>
        )}

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <ProgressBar value={ship.hull ?? 0} max={ship.max_hull ?? 0} label="Hull" color="green" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.shield ?? 0} max={ship.max_shield ?? 0} label="Shield" color="cyan" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={cpuUsed} max={cpuCapacity} label="CPU" color="purple" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={powerUsed} max={powerCapacity} label="Power" color="blue" size="sm" />
          </div>
        </div>

        {/* Module Slots — 3 columns */}
        <div className={shared.sectionTitle}>
          Modules
        </div>
        <div className={styles.slotGrid}>
          {/* Weapon column */}
          <div className={styles.slotColumn}>
            <div className={styles.slotColumnHeader}>
              <Crosshair size={12} /> Weapon ({weaponMods.length}/{weaponSlots})
            </div>
            {weaponMods.map((m, i) => renderModuleSlot(m, i))}
            {Array.from({ length: emptyWeapon }, (_, i) => renderEmptySlot('weapon', i))}
          </div>

          {/* Defense column */}
          <div className={styles.slotColumn}>
            <div className={styles.slotColumnHeader}>
              <Shield size={12} /> Defense ({defenseMods.length}/{defenseSlots})
            </div>
            {defenseMods.map((m, i) => renderModuleSlot(m, i))}
            {Array.from({ length: emptyDefense }, (_, i) => renderEmptySlot('defense', i))}
          </div>

          {/* Utility column */}
          <div className={styles.slotColumn}>
            <div className={styles.slotColumnHeader}>
              <CircuitBoard size={12} /> Utility ({utilityMods.length}/{utilitySlots})
            </div>
            {utilityMods.map((m, i) => renderModuleSlot(m, i))}
            {Array.from({ length: emptyUtility }, (_, i) => renderEmptySlot('utility', i))}
          </div>
        </div>

        {/* Cargo Hold */}
        <div className={shared.sectionTitle}>
          <Package size={12} />
          Cargo Hold ({ship.cargo_used ?? 0}/{ship.cargo_capacity ?? 0})
        </div>
        {cargo.length > 0 ? (
          <>
            <div className={styles.cargoList}>
              {cargo.map((item: CargoEntry, idx) => {
                const itemId = item.item_id ?? `cargo-${idx}`
                const quantity = item.quantity ?? 0
                const rawItem = item.item_id ? getCatalogRawItem(item.item_id) : undefined
                const modEntry = rawItem && isModule(rawItem) ? rawItem : null
                let compatStatus: { ok: boolean; reason?: string } | null = null
                if (modEntry && isDocked) {
                  const cpuFree = cpuCapacity - cpuUsed
                  const powerFree = powerCapacity - powerUsed
                  const slotType = modEntry.type
                  let slotsUsed = 0
                  let slotsTotal = 0
                  if (slotType === 'weapon') {
                    slotsUsed = weaponMods.length
                    slotsTotal = weaponSlots
                  } else if (slotType === 'defense') {
                    slotsUsed = defenseMods.length
                    slotsTotal = defenseSlots
                  } else {
                    slotsUsed = utilityMods.length
                    slotsTotal = utilitySlots
                  }
                  const cpu = modEntry.cpu_usage ?? 0
                  const power = modEntry.power_usage ?? 0
                  if (cpu > cpuFree) {
                    compatStatus = { ok: false, reason: `Needs ${cpu} CPU, ${cpuFree} free` }
                  } else if (power > powerFree) {
                    compatStatus = { ok: false, reason: `Needs ${power} power, ${powerFree} free` }
                  } else if (slotsUsed >= slotsTotal) {
                    const label = slotType === 'mining' || slotType === 'utility' ? 'utility' : slotType
                    compatStatus = { ok: false, reason: `No ${label} slots free` }
                  } else {
                    compatStatus = { ok: true }
                  }
                }
                const qtyStr = depositQtys[itemId] ?? String(quantity)
                const qtyNum = parseInt(qtyStr, 10)
                const qtyValid = !isNaN(qtyNum) && qtyNum >= 1 && qtyNum <= quantity
                const checked = !!selectedCargo[itemId]
                return (
                  <div key={itemId} className={styles.cargoItem}>
                    <div className={styles.cargoNameWrap}>
                      {isDocked && (
                        <input
                          type="checkbox"
                          className={styles.cargoSelect}
                          checked={checked}
                          onChange={(e) =>
                            setSelectedCargo((prev) => ({
                              ...prev,
                              [itemId]: e.target.checked,
                            }))
                          }
                          title="Select for Move Selected"
                        />
                      )}
                      <span className={styles.cargoName}>
                        <ItemName itemId={item.item_id ?? ''}>{item.item_name ?? item.item_id ?? ''}</ItemName>
                      </span>
                    </div>
                    <span className={styles.cargoMeta}>
                      {compatStatus && (
                        compatStatus.ok ? (
                          <span className={styles.compatOk} title="Can install"><Check size={10} /></span>
                        ) : (
                          <span className={styles.compatNo} title={compatStatus.reason}><AlertTriangle size={10} /> {compatStatus.reason}</span>
                        )
                      )}
                      <span className={styles.cargoQty}>x{quantity}</span>
                      <span className={styles.cargoSize}>{quantity * (item.size ?? 0)}u</span>
                      {isDocked && (
                        <span className={styles.cargoDepositAction}>
                          <input
                            className={styles.cargoQtyInput}
                            type="number"
                            min={1}
                            max={quantity}
                            value={qtyStr}
                            onChange={(e) =>
                              setDepositQtys((prev) => ({
                                ...prev,
                                [itemId]: e.target.value,
                              }))
                            }
                            title="Quantity to move to storage"
                          />
                          <button
                            className={shared.confirmBtn}
                            onClick={() => handleDepositItem(itemId, quantity)}
                            disabled={actionPending || !qtyValid}
                            title={actionPending ? 'Another action is pending' : 'Move to station storage'}
                            type="button"
                          >
                            <ArrowDownToLine size={10} />
                          </button>
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
            {isDocked && (
              <div className={styles.cargoBulkRow}>
                <span className={styles.cargoBulkHint}>
                  {Object.values(selectedCargo).filter(Boolean).length} selected
                </span>
                <button
                  className={shared.confirmBtn}
                  onClick={handleDepositSelected}
                  disabled={
                    actionPending ||
                    Object.values(selectedCargo).filter(Boolean).length === 0
                  }
                  title={
                    actionPending
                      ? 'Another action is pending'
                      : 'Move all selected items to station storage'
                  }
                  type="button"
                >
                  <ArrowDownToLine size={10} /> Move Selected to Storage
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={shared.emptyState}>Cargo hold is empty</div>
        )}

      {/* Install module modal */}
      {installSlotType && (
        <InstallModuleModal
          slotType={installSlotType}
          modules={getInstallableModules(installSlotType)}
          onInstall={handleInstallModule}
          onClose={() => setInstallSlotType(null)}
          cpuAvailable={cpuCapacity - cpuUsed}
          powerAvailable={powerCapacity - powerUsed}
        />
      )}
    </Panel>
  )
}

function InstallModuleModal({ slotType, modules, onInstall, onClose, cpuAvailable, powerAvailable }: {
  slotType: SlotType
  modules: Array<{ item_id: string; name: string; quantity: number; catalogEntry?: RawCatalogItem }>
  onInstall: (itemId: string) => void
  onClose: () => void
  cpuAvailable: number
  powerAvailable: number
}) {
  const slotLabel = slotType === 'utility' ? 'Utility / Mining' : slotType.charAt(0).toUpperCase() + slotType.slice(1)

  return (
    <Modal title={`Install ${slotLabel} Module`} onClose={onClose}>
      <div className={styles.modalCapacity}>
        <span><Cpu size={11} /> CPU: {cpuAvailable} free</span>
        <span><Zap size={11} /> Power: {powerAvailable} free</span>
      </div>
      {modules.length === 0 ? (
        <div className={shared.emptyState}>
          No compatible modules in cargo
        </div>
      ) : (
        <div className={styles.installList}>
          {modules.map((mod) => {
            const cat = mod.catalogEntry
            const fitsResources = cat
              ? ((cat.cpu_usage ?? 0) <= cpuAvailable && (cat.power_usage ?? 0) <= powerAvailable)
              : true
            return (
              <div key={mod.item_id} className={styles.installItem}>
                <div className={styles.installInfo}>
                  <span className={styles.installName}>{mod.name}</span>
                  <div className={styles.installMeta}>
                    <span className={styles.installQty}>x{mod.quantity}</span>
                    {cat && (
                      <>
                        <span className={styles.slotStat}><Cpu size={9} /> {cat.cpu_usage}</span>
                        <span className={styles.slotStat}><Zap size={9} /> {cat.power_usage}</span>
                        {cat.damage && <span className={styles.slotStat}><Swords size={9} /> {cat.damage}</span>}
                        {cat.shield_bonus && <span className={styles.slotStat}><ShieldPlus size={9} /> +{cat.shield_bonus}</span>}
                        {cat.mining_power && <span className={styles.slotStat}>⛏ {cat.mining_power}</span>}
                      </>
                    )}
                  </div>
                  {!fitsResources && (
                    <span className={styles.installWarning}>Insufficient CPU or power</span>
                  )}
                </div>
                <button
                  className={shared.actionBtn}
                  onClick={() => onInstall(mod.item_id)}
                  disabled={!fitsResources}
                  type="button"
                >
                  <Plus size={12} /> Install
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
