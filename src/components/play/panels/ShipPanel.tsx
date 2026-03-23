'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  X,
  Plus,
  ShieldPlus,
  Swords,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ProgressBar } from '../ProgressBar'
import { Panel, Modal, shared } from '../shared'
import type { ModuleCatalogEntry, EnrichedShipModule } from '../types'
import styles from './ShipPanel.module.css'

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

export function ShipPanel() {
  const { state, sendCommand, api } = useGame()
  const ship = state.ship
  const isDocked = state.isDocked
  const moduleCatalog = state.moduleCatalog

  // Ship class details (description, lore)
  const [classDetail, setClassDetail] = useState<ShipClassDetail | null>(null)
  const fetchedClassId = useRef<string | null>(null)

  // Install modal
  const [installSlotType, setInstallSlotType] = useState<SlotType | null>(null)

  // Fetch ship class details from catalog
  useEffect(() => {
    if (!ship?.class_id || !api) return
    if (fetchedClassId.current === ship.class_id) return

    fetchedClassId.current = ship.class_id
    api.command('catalog', { type: 'ships', id: ship.class_id }).then((result) => {
      const r = result as Record<string, unknown>
      const items = (r.items || []) as Array<Record<string, unknown>>
      if (items.length > 0) {
        setClassDetail(items[0] as unknown as ShipClassDetail)
      }
    }).catch(() => { fetchedClassId.current = null })
  }, [ship?.class_id, api])

  const handleUninstallModule = useCallback(
    (moduleId: string) => {
      sendCommand('uninstall_mod', { module_id: moduleId })
    },
    [sendCommand]
  )

  const handleRepairModule = useCallback(
    (moduleId: string) => {
      sendCommand('repair_module', { module_id: moduleId })
    },
    [sendCommand]
  )

  const handleInstallModule = useCallback(
    (itemId: string) => {
      sendCommand('install_mod', { module_id: itemId }).then(() => {
        setInstallSlotType(null)
      })
    },
    [sendCommand]
  )

  if (!ship) {
    return (
      <Panel title="Ship" icon={<Rocket size={16} />}>
        <div className={shared.emptyState}>No ship data available</div>
      </Panel>
    )
  }

  const modules = state.shipModules

  // Sort modules into slot columns
  const weaponMods = modules.filter(m => m.type === 'weapon')
  const defenseMods = modules.filter(m => m.type === 'defense')
  const utilityMods = modules.filter(m => m.type === 'mining' || m.type === 'utility')

  const weaponSlots = ship.weapon_slots ?? 0
  const defenseSlots = ship.defense_slots ?? 0
  const utilitySlots = ship.utility_slots ?? 0

  const emptyWeapon = Math.max(0, weaponSlots - weaponMods.length)
  const emptyDefense = Math.max(0, defenseSlots - defenseMods.length)
  const emptyUtility = Math.max(0, utilitySlots - utilityMods.length)

  // Get installable modules from cargo for a slot type
  const getInstallableModules = (slotType: SlotType): Array<{ item_id: string; name: string; quantity: number; catalogEntry?: ModuleCatalogEntry }> => {
    if (!ship.cargo || !moduleCatalog) return []

    return ship.cargo
      .filter(item => {
        const entry = moduleCatalog[item.item_id]
        if (!entry) return false
        if (slotType === 'weapon') return entry.type === 'weapon'
        if (slotType === 'defense') return entry.type === 'defense'
        return entry.type === 'mining' || entry.type === 'utility'
      })
      .map(item => ({
        item_id: item.item_id,
        name: item.name ?? item.item_id,
        quantity: item.quantity,
        catalogEntry: moduleCatalog[item.item_id],
      }))
  }

  const renderModuleSlot = (mod: EnrichedShipModule, idx: number) => {
    const wear = mod.wear ?? 0
    return (
      <div key={mod.id || `mod-${idx}`} className={styles.slotFilled}>
        <div className={styles.slotModInfo}>
          <span className={styles.slotModName}>{mod.name}</span>
          <div className={styles.slotModMeta}>
            {mod.cpu_usage > 0 && <span className={styles.slotStat}><Cpu size={9} /> {mod.cpu_usage}</span>}
            {mod.power_usage > 0 && <span className={styles.slotStat}><Zap size={9} /> {mod.power_usage}</span>}
            {mod.damage && <span className={styles.slotStat}><Swords size={9} /> {mod.damage}</span>}
            {mod.shield_bonus && <span className={styles.slotStat}><ShieldPlus size={9} /> +{mod.shield_bonus}</span>}
            {mod.mining_power && <span className={styles.slotStat}>⛏ {mod.mining_power}</span>}
            {mod.harvest_power && <span className={styles.slotStat}>⛏ {mod.harvest_power}</span>}
            {mod.scanner_power && <span className={styles.slotStat}>📡 {mod.scanner_power}</span>}
            {mod.cargo_bonus && <span className={styles.slotStat}><Package size={9} /> +{mod.cargo_bonus}</span>}
            {mod.speed_bonus && <span className={styles.slotStat}><Gauge size={9} /> +{mod.speed_bonus}</span>}
            {wear > 0 && <span className={styles.slotWear}>{mod.wear_status || `${Math.round(wear)}%`}</span>}
          </div>
        </div>
        <div className={styles.slotActions}>
          {isDocked && wear > 0 && (
            <button
              className={styles.repairModBtn}
              onClick={() => handleRepairModule(mod.id)}
              title="Repair module"
              type="button"
            >
              <Hammer size={11} />
            </button>
          )}
          {isDocked && (
            <button
              className={shared.dangerBtn}
              onClick={() => handleUninstallModule(mod.id)}
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
            src={`/images/ships/catalog/${ship.class_id}.webp`}
            alt={ship.name}
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
            <ProgressBar value={ship.hull} max={ship.max_hull} label="Hull" color="green" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.shield ?? 0} max={ship.max_shield ?? 0} label="Shield" color="cyan" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.cpu_used ?? 0} max={ship.cpu_capacity ?? 0} label="CPU" color="purple" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.power_used ?? 0} max={ship.power_capacity ?? 0} label="Power" color="blue" size="sm" />
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
          Cargo Hold ({ship.cargo_used ?? 0}/{ship.cargo_capacity})
        </div>
        {ship.cargo && ship.cargo.length > 0 ? (
          <div className={styles.cargoList}>
            {ship.cargo.map((item) => (
              <div key={item.item_id} className={styles.cargoItem}>
                <span className={styles.cargoName}>{item.name ?? item.item_id}</span>
                <span className={styles.cargoMeta}>
                  <span className={styles.cargoQty}>x{item.quantity}</span>
                  <span className={styles.cargoSize}>{item.quantity * (item.size ?? 0)}u</span>
                </span>
              </div>
            ))}
          </div>
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
          cpuAvailable={(ship.cpu_capacity ?? 0) - (ship.cpu_used ?? 0)}
          powerAvailable={(ship.power_capacity ?? 0) - (ship.power_used ?? 0)}
        />
      )}
    </Panel>
  )
}

function InstallModuleModal({ slotType, modules, onInstall, onClose, cpuAvailable, powerAvailable }: {
  slotType: SlotType
  modules: Array<{ item_id: string; name: string; quantity: number; catalogEntry?: ModuleCatalogEntry }>
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
              ? (cat.cpu_usage <= cpuAvailable && cat.power_usage <= powerAvailable)
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
