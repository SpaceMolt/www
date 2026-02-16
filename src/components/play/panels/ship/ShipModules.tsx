'use client'

import { useCallback } from 'react'
import {
  Cpu,
  Zap,
  Fuel,
  Wrench,
  X,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import styles from '../ShipPanel.module.css'

export function ShipModules() {
  const { state, sendCommand } = useGame()
  const ship = state.ship
  const isDocked = state.isDocked

  const handleUninstallModule = useCallback(
    (instanceId: string) => {
      sendCommand('uninstall_module', { instance_id: instanceId })
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
            Installed ({ship.modules.length})
          </div>
          {ship.modules.length > 0 ? (
            <div className={styles.modulesList}>
              {ship.modules.map((mod, idx) => (
                <div
                  key={mod.instance_id || `${mod.module_id}-${idx}`}
                  className={styles.moduleItem}
                >
                  <div className={styles.moduleLeft}>
                    <span className={styles.moduleName}>{mod.name}</span>
                    <div className={styles.moduleMeta}>
                      <span className={styles.moduleType}>
                        {mod.slot_type} / {mod.type}
                      </span>
                      {mod.quality !== undefined && (
                        <span className={styles.moduleQuality}>
                          Q{mod.quality}%
                        </span>
                      )}
                      {mod.wear !== undefined && mod.wear > 0 && (
                        <span className={styles.moduleWear}>
                          W{mod.wear}%
                        </span>
                      )}
                      <span className={styles.moduleType}>
                        <Cpu size={10} /> {mod.cpu_cost}{' '}
                        <Zap size={10} /> {mod.power_cost}
                      </span>
                    </div>
                  </div>
                  <div className={styles.moduleActions}>
                    {mod.instance_id && isDocked && (
                      <button
                        className={styles.uninstallBtn}
                        onClick={() =>
                          handleUninstallModule(mod.instance_id!)
                        }
                        title="Uninstall module"
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
