'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Rocket,
  Gauge,
  Shield,
  Crosshair,
  CircuitBoard,
  Package,
  Cpu,
  Zap,
  Plus,
  ShieldPlus,
  Swords,
  ArrowDownToLine,
  Check,
  AlertTriangle,
  Pickaxe,
  Radar,
  FlaskConical,
  Trash2,
} from 'lucide-react'
import { useShip, useModules, useCargo, useLocationState, usePendingAction, useCommandMutation, useCatalog } from '@/lib/spacemolt'
import type { GameState } from '@spacemolt/lib'
import { usePlay } from '../PlayProvider'
import { ProgressBar } from '../ProgressBar'
import { Panel, Modal, ConfirmAction, ItemSelectList, QtyButtons, errorMessage, shared, useStorageMove } from '../shared'
import { normalizeCargo, selectAll, selectedItems, type SelectableItem, type Selection } from '../shared/itemSelection'
import { ItemName } from '../ItemTooltip'
import { getItem as getCatalogRawItem, isModule } from '@/data/catalog'
import type { RawCatalogItem } from '@/data/catalog'
import styles from './ShipPanel.module.css'
import { imageUrl } from '@/data/images'
import { canRefit, isUsableConsumable, usesQuantity, useItemResultText } from './shipModules'

type ModuleEntry = NonNullable<GameState['modules']>[number]

type SlotType = 'weapon' | 'defense' | 'utility'

/** Read a numeric per-type module stat out of the loosely-typed `stats` bag. */
function statNum(stats: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = stats?.[key]
  return typeof v === 'number' ? v : undefined
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
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null)
  const [modError, setModError] = useState<string | null>(null)
  const [useQtys, setUseQtys] = useState<Record<string, string>>({})

  // Cargo multi-select: deposit to storage when docked, jettison when undocked
  const cargoRows = useMemo(() => normalizeCargo(cargo), [cargo])
  const [cargoSel, setCargoSel] = useState<Selection>({})
  const [confirmJettison, setConfirmJettison] = useState(false)
  const move = useStorageMove()
  const deposit = async (items: Parameters<typeof move>[1]) =>
    setCargoSel(await move('Deposited', items, (c, picked) => c.spacemolt_storage.deposit({ items: picked }), 'from cargo to storage'))

  const classDetail = ship?.class_id ? catalog?.ship(ship.class_id) : undefined

  const handleUninstallModule = useCallback(
    async (moduleId: string) => {
      setConfirmUninstall(null)
      setModError(null)
      try {
        await mutate((c) => c.spacemolt.uninstall_mod({ id: moduleId }), { label: 'uninstall_mod' })
      } catch (err) {
        setModError(errorMessage(err))
      }
    },
    [mutate]
  )

  const handleInstallModule = useCallback(
    async (itemId: string) => {
      setModError(null)
      try {
        await mutate((c) => c.spacemolt.install_mod({ id: itemId }), { label: 'install_mod' })
        setInstallSlotType(null)
      } catch (err) {
        setModError(errorMessage(err))
      }
    },
    [mutate]
  )

  const handleUseItem = useCallback(
    async (itemId: string, quantity: number) => {
      setModError(null)
      try {
        const res = await mutate((c) => c.spacemolt.use_item({ id: itemId, quantity }), { label: 'use_item' })
        setUseQtys((prev) => ({ ...prev, [itemId]: '' }))
        if (res.delta.details) uiStore.dispatch({ type: 'toast', kind: 'success', text: useItemResultText(res.delta.details) })
      } catch (err) {
        setModError(errorMessage(err))
      }
    },
    [mutate, uiStore]
  )

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
  const refitOk = canRefit(isDocked, modules)
  const consumables = cargo.filter((item) => item.item_id && isUsableConsumable(getCatalogRawItem(item.item_id)))

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

  const cargoPicked = selectedItems(cargoRows, cargoSel)

  /** Whether a module in cargo fits a free slot, CPU and power. Null for non-modules. */
  const moduleCompat = (item: SelectableItem): { ok: boolean; reason?: string } | null => {
    const rawItem = getCatalogRawItem(item.item_id)
    const modEntry = rawItem && isModule(rawItem) ? rawItem : null
    if (!modEntry) return null
    const slotType = modEntry.type
    const [slotsUsed, slotsTotal] = slotType === 'weapon'
      ? [weaponMods.length, weaponSlots]
      : slotType === 'defense'
        ? [defenseMods.length, defenseSlots]
        : [utilityMods.length, utilitySlots]
    const cpu = modEntry.cpu_usage ?? 0
    const power = modEntry.power_usage ?? 0
    const cpuFree = cpuCapacity - cpuUsed
    const powerFree = powerCapacity - powerUsed
    if (cpu > cpuFree) return { ok: false, reason: `Needs ${cpu} CPU, ${cpuFree} free` }
    if (power > powerFree) return { ok: false, reason: `Needs ${power} power, ${powerFree} free` }
    if (slotsUsed >= slotsTotal) return { ok: false, reason: `No ${slotType === 'mining' || slotType === 'utility' ? 'utility' : slotType} slots free` }
    return { ok: true }
  }

  const renderModuleSlot = (mod: ModuleEntry, idx: number) => {
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
            {miningPower && <span className={styles.slotStat}><Pickaxe size={9} /> {miningPower}</span>}
            {harvestPower && <span className={styles.slotStat}><Pickaxe size={9} /> {harvestPower}</span>}
            {scannerPower && <span className={styles.slotStat}><Radar size={9} /> {scannerPower}</span>}
            {cargoBonus && <span className={styles.slotStat}><Package size={9} /> +{cargoBonus}</span>}
            {speedBonus && <span className={styles.slotStat}><Gauge size={9} /> +{speedBonus}</span>}
          </div>
        </div>
        <div className={styles.slotActions}>
          {refitOk && (confirmUninstall === modInstanceId ? (
            <ConfirmAction
              message={`Uninstall ${mod.name ?? 'module'} to cargo?`}
              onConfirm={() => handleUninstallModule(modInstanceId)}
              onCancel={() => setConfirmUninstall(null)}
              confirmDisabled={actionPending}
            />
          ) : (
            <button
              className={shared.dangerBtn}
              onClick={() => setConfirmUninstall(modInstanceId)}
              disabled={actionPending}
              title="Uninstall to cargo"
              type="button"
            >
              Uninstall
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderEmptySlot = (slotType: SlotType, idx: number) => (
    <div
      key={`empty-${slotType}-${idx}`}
      className={`${styles.slotEmpty} ${refitOk ? styles.slotClickable : ''}`}
      onClick={refitOk ? () => setInstallSlotType(slotType) : undefined}
      title={refitOk ? 'Click to install a module' : 'Dock or fit a Ship Maintenance Bay to install modules'}
    >
      <Plus size={14} className={styles.slotEmptyIcon} />
    </div>
  )

  return (
    <Panel title="Ship" icon={<Rocket size={16} />}>
        {/* Ship overview */}
        <div className={styles.shipOverview}>
          <img
            src={imageUrl(`ships/catalog/${ship.class_id ?? ''}.webp`)}
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
                  {(classDetail.tier ?? 0) > 0 && <span className={shared.badgeCyan}>T{classDetail.tier}</span>}
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
        {modError && !installSlotType && (
          <div className={styles.modError}>
            <AlertTriangle size={12} /> {modError}
          </div>
        )}

        {/* Consumables: use_item works docked or undocked */}
        {consumables.length > 0 && (
          <>
            <div className={shared.sectionTitle}>
              <FlaskConical size={12} /> Consumables
            </div>
            <div className={styles.cargoList}>
              {consumables.map((item) => {
                const itemId = item.item_id ?? ''
                const held = item.quantity ?? 0
                const hasQty = usesQuantity(getCatalogRawItem(itemId))
                const qtyStr = useQtys[itemId] || '1'
                const qty = parseInt(qtyStr, 10)
                const qtyValid = !hasQty || (qty >= 1 && qty <= held)
                return (
                  <div key={itemId} className={styles.cargoItem}>
                    <span className={styles.cargoName}><ItemName itemId={itemId}>{item.item_name ?? itemId}</ItemName></span>
                    <span className={styles.cargoMeta}>
                      <span className={styles.cargoQty}>x{held}</span>
                      {hasQty && (
                        <>
                          <input
                            className={styles.cargoQtyInput}
                            type="number"
                            min={1}
                            max={held}
                            value={qtyStr}
                            onChange={(e) => setUseQtys((prev) => ({ ...prev, [itemId]: e.target.value }))}
                            title="Quantity to use"
                          />
                          <QtyButtons max={held} current={qtyStr} onChange={(v) => setUseQtys((prev) => ({ ...prev, [itemId]: v }))} />
                        </>
                      )}
                      <button
                        className={shared.confirmBtn}
                        onClick={() => handleUseItem(itemId, hasQty ? qty : 1)}
                        disabled={actionPending || !qtyValid}
                        title={actionPending ? 'Another action is pending' : 'Use item'}
                        type="button"
                      >
                        Use
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Cargo Hold */}
        <div className={shared.sectionTitle}>
          <Package size={12} />
          Cargo Hold ({ship.cargo_used ?? 0}/{ship.cargo_capacity ?? 0})
        </div>
        <ItemSelectList
          items={cargoRows}
          selection={cargoSel}
          onChange={setCargoSel}
          empty="Cargo hold is empty"
          renderExtra={(item) => <CompatBadge status={refitOk ? moduleCompat(item) : null} />}
          actions={isDocked ? (
            <>
              <button
                className={shared.confirmBtn}
                onClick={() => deposit(cargoPicked)}
                disabled={actionPending || cargoPicked.length === 0}
                title={actionPending ? 'Another action is pending' : 'Move the selected items to station storage'}
                type="button"
              >
                <ArrowDownToLine size={10} /> Move Selected to Storage
              </button>
              <button
                className={shared.subtleBtn}
                onClick={() => deposit(selectedItems(cargoRows, selectAll(cargoRows)))}
                disabled={actionPending}
                type="button"
              >
                Deposit All Cargo
              </button>
            </>
          ) : confirmJettison ? (
            <ConfirmAction
              message={`Dump ${cargoPicked.length} item${cargoPicked.length === 1 ? '' : 's'} into space?`}
              icon={<AlertTriangle size={12} />}
              onConfirm={async () => {
                setConfirmJettison(false)
                setCargoSel(await move('Jettisoned', cargoPicked, (c, items) => c.spacemolt_storage.jettison({ items })))
              }}
              onCancel={() => setConfirmJettison(false)}
              confirmLabel="Jettison"
            />
          ) : (
            <button
              className={shared.dangerBtn}
              onClick={() => setConfirmJettison(true)}
              disabled={actionPending || cargoPicked.length === 0}
              title="Dump the selected items into a container in space"
              type="button"
            >
              <Trash2 size={10} /> Jettison Selected
            </button>
          )}
        />

      {/* Install module modal */}
      {installSlotType && (
        <InstallModuleModal
          slotType={installSlotType}
          modules={getInstallableModules(installSlotType)}
          onInstall={handleInstallModule}
          onClose={() => { setInstallSlotType(null); setModError(null) }}
          error={modError}
          cpuAvailable={cpuCapacity - cpuUsed}
          powerAvailable={powerCapacity - powerUsed}
        />
      )}
    </Panel>
  )
}

function CompatBadge({ status }: { status: { ok: boolean; reason?: string } | null }) {
  if (!status) return null
  return status.ok
    ? <span className={styles.compatOk} title="Can install"><Check size={10} /></span>
    : <span className={styles.compatNo} title={status.reason}><AlertTriangle size={10} /> {status.reason}</span>
}

function InstallModuleModal({ slotType, modules, onInstall, onClose, cpuAvailable, powerAvailable, error }: {
  slotType: SlotType
  modules: Array<{ item_id: string; name: string; quantity: number; catalogEntry?: RawCatalogItem }>
  onInstall: (itemId: string) => void
  onClose: () => void
  cpuAvailable: number
  powerAvailable: number
  error: string | null
}) {
  const slotLabel = slotType === 'utility' ? 'Utility / Mining' : slotType.charAt(0).toUpperCase() + slotType.slice(1)

  return (
    <Modal title={`Install ${slotLabel} Module`} onClose={onClose}>
      <div className={styles.modalCapacity}>
        <span><Cpu size={11} /> CPU: {cpuAvailable} free</span>
        <span><Zap size={11} /> Power: {powerAvailable} free</span>
      </div>
      {error && (
        <div className={styles.modError}>
          <AlertTriangle size={12} /> {error}
        </div>
      )}
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
                        {cat.mining_power && <span className={styles.slotStat}><Pickaxe size={9} /> {cat.mining_power}</span>}
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
