'use client'

import { useShip } from '@/lib/spacemolt'
import { ProgressBar } from './ProgressBar'
import { Rocket } from 'lucide-react'
import styles from './ShipStatus.module.css'

export function ShipStatus() {
  const ship = useShip()

  if (!ship) {
    return (
      <div className={styles.container}>
        <div className={styles.noShip}>
          <Rocket size={14} className={styles.noShipIcon} />
          <span>No ship data</span>
        </div>
      </div>
    )
  }

  const maxHull = ship.max_hull ?? 0
  const hullPct = maxHull > 0 ? (ship.hull ?? 0) / maxHull : 0
  const hullColor = hullPct < 0.25 ? 'red' : hullPct < 0.5 ? 'orange' : 'green'

  return (
    <div className={styles.container}>
      <div className={styles.shipName}>
        <Rocket size={14} className={styles.shipIcon} />
        <span className={styles.shipClass}>{ship.name}</span>
      </div>
      <div className={styles.bars}>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.hull ?? 0}
            max={maxHull}
            color={hullColor}
            label="Hull"
            size="sm"
          />
        </div>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.shield ?? 0}
            max={ship.max_shield ?? 0}
            color="blue"
            label="Shield"
            size="sm"
          />
        </div>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.fuel ?? 0}
            max={ship.max_fuel ?? 0}
            color="yellow"
            label="Fuel"
            size="sm"
          />
        </div>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.cargo_used ?? 0}
            max={ship.cargo_capacity ?? 0}
            color="cyan"
            label="Cargo"
            size="sm"
          />
        </div>
      </div>
    </div>
  )
}
