'use client'

import { useCallback } from 'react'
import {
  Rocket,
  Gauge,
  Shield,
  Crosshair,
  CircuitBoard,
  Package,
  Cpu,
  Zap,
  Wrench,
  X,
  ArrowDownToLine,
  Hammer,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ProgressBar } from '../ProgressBar'
import styles from './ShipPanel.module.css'

function formatModuleId(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ShipPanel() {
  const { state, sendCommand } = useGame()
  const ship = state.ship
  const isDocked = state.isDocked

  const handleUninstallModule = useCallback(
    (moduleId: string) => {
      sendCommand('uninstall_mod', { module_id: moduleId })
    },
    [sendCommand]
  )

  const handleDepositModule = useCallback(
    async (moduleId: string, moduleTypeId: string) => {
      await sendCommand('uninstall_mod', { module_id: moduleId })
      sendCommand('deposit_items', { item_id: moduleTypeId, quantity: 1 })
    },
    [sendCommand]
  )

  const handleRepairModule = useCallback(
    (moduleId: string) => {
      sendCommand('repair_module', { module_id: moduleId })
    },
    [sendCommand]
  )

  if (!ship) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Rocket size={16} />
            </span>
            Ship
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.emptyState}>No ship data available</div>
        </div>
      </div>
    )
  }

  const modules = (ship.modules ?? []) as unknown as Array<Record<string, unknown>>

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Rocket size={16} />
          </span>
          Ship
        </div>
      </div>

      <div className={styles.content}>
        {/* Ship overview */}
        <div className={styles.shipOverview}>
          <img
            src={`/images/ships/catalog/${ship.class_id}.webp`}
            alt={ship.name}
            className={styles.shipImage}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div>
            <div className={styles.shipClass}>{ship.name}</div>
            {ship.name && ship.name !== ship.class_id && (
              <div className={styles.shipName}>&quot;{ship.name}&quot;</div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <ProgressBar value={ship.hull} max={ship.max_hull} label="Hull" color="green" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.shield ?? 0} max={ship.max_shield ?? 0} label="Shield" color="cyan" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.fuel} max={ship.max_fuel} label="Fuel" color="orange" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.cargo_used ?? 0} max={ship.cargo_capacity} label="Cargo" color="yellow" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.cpu_used ?? 0} max={ship.cpu_capacity ?? 0} label="CPU" color="purple" size="sm" />
          </div>
          <div className={styles.statCard}>
            <ProgressBar value={ship.power_used ?? 0} max={ship.power_capacity ?? 0} label="Power" color="blue" size="sm" />
          </div>
        </div>

        {/* Speed + Slots */}
        <div className={styles.speedStat}>
          <span className={styles.speedIcon}><Gauge size={14} /></span>
          <span className={styles.speedLabel}>Speed</span>
          <span className={styles.speedValue}>{ship.speed}</span>
        </div>

        <div className={styles.slotRow}>
          <div className={styles.slotItem}>
            <span className={styles.slotIcon}><Crosshair size={12} /></span>
            <span className={styles.slotLabel}>Wpn:</span>
            <span className={styles.slotValue}>{ship.weapon_slots}</span>
          </div>
          <div className={styles.slotItem}>
            <span className={styles.slotIcon}><Shield size={12} /></span>
            <span className={styles.slotLabel}>Def:</span>
            <span className={styles.slotValue}>{ship.defense_slots}</span>
          </div>
          <div className={styles.slotItem}>
            <span className={styles.slotIcon}><CircuitBoard size={12} /></span>
            <span className={styles.slotLabel}>Util:</span>
            <span className={styles.slotValue}>{ship.utility_slots}</span>
          </div>
        </div>

        {/* Modules */}
        <div className={styles.sectionTitle}>
          Modules ({modules.length})
        </div>
        {modules.length > 0 ? (
          <div className={styles.modulesList}>
            {modules.map((mod, idx) => {
              const instanceId = (mod.instance_id as string | undefined) ?? String(mod)
              const moduleId = (mod.module_id as string | undefined) ?? String(mod)
              const displayName = (mod.name as string | undefined) ?? (mod.module_id as string | undefined) ?? formatModuleId(String(mod))
              const slotType = mod.slot_type as string | undefined
              const modType = mod.type as string | undefined
              const quality = mod.quality as number | undefined
              const wear = mod.wear as number | undefined
              const cpuCost = mod.cpu_cost as number | undefined
              const powerCost = mod.power_cost as number | undefined
              const powerBonus = mod.power_bonus as number | undefined
              const size = mod.size as number | undefined
              const hasInstanceId = !!mod.instance_id

              return (
                <div
                  key={hasInstanceId ? instanceId : `${moduleId}-${idx}`}
                  className={styles.moduleItem}
                  title={`${displayName}${modType ? ` — ${modType}` : ''}${slotType ? ` (${slotType} slot)` : ''}${cpuCost !== undefined ? `\nCPU: ${cpuCost}` : ''}${powerCost !== undefined ? ` | Power: ${powerCost}` : ''}${quality !== undefined ? ` | Quality: ${quality}%` : ''}${wear !== undefined && wear > 0 ? ` | Wear: ${wear}%` : ''}`}
                >
                  <div className={styles.moduleLeft}>
                    <span className={styles.moduleName}>{displayName}</span>
                    <div className={styles.moduleMeta}>
                      {slotType && modType && (
                        <span className={styles.moduleType}>{slotType} / {modType}</span>
                      )}
                      {size !== undefined && size > 0 && (
                        <span className={styles.moduleType}>S{size}</span>
                      )}
                      {quality !== undefined && (
                        <span className={styles.moduleQuality}>Q{quality}%</span>
                      )}
                      {powerBonus !== undefined && powerBonus > 0 && (
                        <span className={styles.moduleType}>+{powerBonus} pwr</span>
                      )}
                      {wear !== undefined && wear > 0 && (
                        <span className={styles.moduleWear}>W{wear}%</span>
                      )}
                      {(cpuCost !== undefined || powerCost !== undefined) && (
                        <span className={styles.moduleType}>
                          <Cpu size={10} /> {cpuCost ?? '?'}{' '}
                          <Zap size={10} /> {powerCost ?? '?'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.moduleActions}>
                    {hasInstanceId && isDocked && wear !== undefined && wear > 0 && (
                      <button
                        className={styles.repairModBtn}
                        onClick={() => handleRepairModule(instanceId)}
                        title={`Repair module (${wear}% wear) - requires repair_kit`}
                        type="button"
                      >
                        <Hammer size={12} />
                      </button>
                    )}
                    {hasInstanceId && isDocked && (
                      <>
                        <button
                          className={styles.storeBtn}
                          onClick={() => handleDepositModule(instanceId, moduleId)}
                          title="Uninstall and store at station"
                          type="button"
                        >
                          <ArrowDownToLine size={12} />
                        </button>
                        <button
                          className={styles.uninstallBtn}
                          onClick={() => handleUninstallModule(instanceId)}
                          title="Uninstall to cargo"
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>No modules installed</div>
        )}

        {/* Cargo Hold */}
        <div className={styles.sectionTitle}>
          <Package size={12} />
          Cargo Hold
        </div>
        {ship.cargo && ship.cargo.length > 0 ? (
          <div className={styles.modulesList}>
            {ship.cargo.map((item) => (
              <div key={item.item_id} className={styles.moduleItem}>
                <span className={styles.moduleName}>{item.name ?? item.item_id}</span>
                <span className={styles.moduleMeta}>
                  <span className={styles.moduleType}>x{item.quantity}</span>
                  <span className={styles.moduleType}>{item.quantity * (item.size ?? 0)}u</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Cargo hold is empty</div>
        )}
      </div>
    </div>
  )
}
