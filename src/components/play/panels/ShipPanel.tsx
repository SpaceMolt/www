'use client'

import { useCallback } from 'react'
import {
  Rocket,
  Wrench,
  Fuel,
  Shield,
  Cpu,
  Zap,
  Gauge,
  Package,
  Crosshair,
  CircuitBoard,
  Layers,
  X,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ProgressBar } from '../ProgressBar'
import styles from './ShipPanel.module.css'

export function ShipPanel() {
  const { state, sendCommand } = useGame()

  const handleRefuel = useCallback(() => {
    sendCommand('refuel')
  }, [sendCommand])

  const handleRepair = useCallback(() => {
    sendCommand('repair')
  }, [sendCommand])

  const handleBrowseShips = useCallback(() => {
    sendCommand('get_ships')
  }, [sendCommand])

  const handleListShips = useCallback(() => {
    sendCommand('list_ships')
  }, [sendCommand])

  const handleUninstallModule = useCallback(
    (instanceId: string) => {
      sendCommand('uninstall_module', { instance_id: instanceId })
    },
    [sendCommand]
  )

  const ship = state.ship
  const isDocked = state.isDocked

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
          <div className={styles.shipClass}>{ship.class}</div>
          {ship.name && ship.name !== ship.class && (
            <div className={styles.shipName}>&quot;{ship.name}&quot;</div>
          )}
        </div>

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <ProgressBar
              value={ship.hull}
              max={ship.max_hull}
              label="Hull"
              color="green"
              size="sm"
            />
          </div>
          <div className={styles.statCard}>
            <ProgressBar
              value={ship.shield}
              max={ship.max_shield}
              label="Shield"
              color="cyan"
              size="sm"
            />
          </div>
          <div className={styles.statCard}>
            <ProgressBar
              value={ship.fuel}
              max={ship.max_fuel}
              label="Fuel"
              color="orange"
              size="sm"
            />
          </div>
          <div className={styles.statCard}>
            <ProgressBar
              value={ship.cargo_used}
              max={ship.cargo_capacity}
              label="Cargo"
              color="yellow"
              size="sm"
            />
          </div>
          <div className={styles.statCard}>
            <ProgressBar
              value={ship.cpu_used}
              max={ship.cpu_capacity}
              label="CPU"
              color="purple"
              size="sm"
            />
          </div>
          <div className={styles.statCard}>
            <ProgressBar
              value={ship.power_used}
              max={ship.power_capacity}
              label="Power"
              color="blue"
              size="sm"
            />
          </div>
        </div>

        {/* Speed + Slots */}
        <div className={styles.speedStat}>
          <span className={styles.speedIcon}>
            <Gauge size={14} />
          </span>
          <span className={styles.speedLabel}>Speed</span>
          <span className={styles.speedValue}>{ship.speed}</span>
        </div>

        <div className={styles.slotRow}>
          <div className={styles.slotItem}>
            <span className={styles.slotIcon}>
              <Crosshair size={12} />
            </span>
            <span className={styles.slotLabel}>Wpn:</span>
            <span className={styles.slotValue}>{ship.weapon_slots}</span>
          </div>
          <div className={styles.slotItem}>
            <span className={styles.slotIcon}>
              <Shield size={12} />
            </span>
            <span className={styles.slotLabel}>Def:</span>
            <span className={styles.slotValue}>{ship.defense_slots}</span>
          </div>
          <div className={styles.slotItem}>
            <span className={styles.slotIcon}>
              <CircuitBoard size={12} />
            </span>
            <span className={styles.slotLabel}>Util:</span>
            <span className={styles.slotValue}>{ship.utility_slots}</span>
          </div>
        </div>

        {/* Modules */}
        <div>
          <div className={styles.sectionTitle}>
            Modules ({ship.modules.length})
          </div>
          {ship.modules.length > 0 ? (
            <div className={styles.modulesList}>
              {ship.modules.map((mod) => (
                <div
                  key={mod.instance_id || mod.module_id}
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
          <button
            className={styles.browseBtn}
            onClick={handleBrowseShips}
            disabled={!isDocked}
            title={isDocked ? 'Browse ships' : 'Dock to browse ships'}
            type="button"
          >
            <Layers size={14} />
            Ships
          </button>
          <button
            className={styles.fleetBtn}
            onClick={handleListShips}
            title="View your fleet"
            type="button"
          >
            <Package size={14} />
            Fleet
          </button>
        </div>
      </div>
    </div>
  )
}
