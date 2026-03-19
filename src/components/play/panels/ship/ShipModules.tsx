'use client'

import { useCallback } from 'react'
import {
  Cpu,
  Zap,
  Fuel,
  Wrench,
  X,
  ArrowDownToLine,
  Hammer,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import styles from '../ShipPanel.module.css'

function formatModuleId(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ShipModules() {
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

  const handleRefuel = useCallback(() => {
    sendCommand('refuel')
  }, [sendCommand])

  const handleRepair = useCallback(() => {
    sendCommand('repair')
  }, [sendCommand])

  if (!ship) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Wrench size={16} />
            </span>
            Modules
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.emptyState}>No ship data available</div>
        </div>
      </div>
    )
  }

  // ship.modules is string[] (module instance IDs from get_status).
  // Treat each entry as an opaque record to support both bare IDs and
  // enriched objects if the data source ever changes.
  const modules = (ship.modules ?? []) as unknown as Array<Record<string, unknown>>

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Wrench size={16} />
          </span>
          Modules
        </div>
      </div>

      <div className={styles.content}>
        {/* Module list */}
        <div>
          <div className={styles.sectionTitle}>
            Installed ({modules.length})
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
                          <span className={styles.moduleType}>
                            {slotType} / {modType}
                          </span>
                        )}
                        {size !== undefined && size > 0 && (
                          <span className={styles.moduleType}>S{size}</span>
                        )}
                        {quality !== undefined && (
                          <span className={styles.moduleQuality}>
                            Q{quality}%
                          </span>
                        )}
                        {powerBonus !== undefined && powerBonus > 0 && (
                          <span className={styles.moduleType}>
                            +{powerBonus} pwr
                          </span>
                        )}
                        {wear !== undefined && wear > 0 && (
                          <span className={styles.moduleWear}>
                            W{wear}%
                          </span>
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
        </div>

        {/* Action buttons */}
        <div className={styles.actionsRow}>
          <button
            className={styles.fuelBtn}
            onClick={handleRefuel}
            disabled={!isDocked}
            title={isDocked ? 'Refuel' : 'Dock to refuel'}
            type="button"
          >
            <Fuel size={14} />
            Refuel
          </button>
          <button
            className={styles.repairBtn}
            onClick={handleRepair}
            disabled={!isDocked}
            title={isDocked ? 'Repair' : 'Dock to repair'}
            type="button"
          >
            <Wrench size={14} />
            Repair
          </button>
        </div>
      </div>
    </div>
  )
}
