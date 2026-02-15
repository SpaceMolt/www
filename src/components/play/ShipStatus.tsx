'use client'

import { useGame } from './GameProvider'
import { ProgressBar } from './ProgressBar'
import { Rocket } from 'lucide-react'
import styles from './ShipStatus.module.css'

export function ShipStatus() {
  const { state } = useGame()
  const ship = state.ship

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

  const hullPct = ship.max_hull > 0 ? ship.hull / ship.max_hull : 0
  const hullColor = hullPct < 0.25 ? 'red' : hullPct < 0.5 ? 'orange' : 'green'

  return (
    <div className={styles.container}>
      <div className={styles.shipName}>
        <Rocket size={14} className={styles.shipIcon} />
        <span className={styles.shipClass}>{ship.class}</span>
      </div>
      <div className={styles.bars}>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.hull}
            max={ship.max_hull}
            color={hullColor}
            label="Hull"
            size="sm"
          />
        </div>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.shield}
            max={ship.max_shield}
            color="blue"
            label="Shield"
            size="sm"
          />
        </div>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.fuel}
            max={ship.max_fuel}
            color="yellow"
            label="Fuel"
            size="sm"
          />
        </div>
        <div className={styles.barItem}>
          <ProgressBar
            value={ship.cargo_used}
            max={ship.cargo_capacity}
            color="cyan"
            label="Cargo"
            size="sm"
          />
        </div>
      </div>
    </div>
  )
}
