'use client'

import {
  Rocket,
  Gauge,
  Shield,
  Crosshair,
  CircuitBoard,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { ProgressBar } from '../../ProgressBar'
import styles from '../ShipPanel.module.css'

export function ShipStatus() {
  const { state } = useGame()
  const ship = state.ship

  if (!ship) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Rocket size={16} />
            </span>
            Ship Status
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
          Ship Status
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
      </div>
    </div>
  )
}
