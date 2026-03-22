'use client'

import { Map } from 'lucide-react'
import { useGame } from '../GameProvider'
import styles from './GalaxyPanel.module.css'

export function GalaxyPanel() {
  const { state } = useGame()

  return (
    <div className={styles.panel}>
      <div className={styles.placeholder}>
        <Map size={48} className={styles.icon} />
        <div className={styles.title}>Galaxy Map</div>
        <div className={styles.subtitle}>
          {state.system
            ? `Current system: ${state.system.name}`
            : 'Loading system data...'}
        </div>
        <div className={styles.hint}>Interactive map coming soon</div>
      </div>
    </div>
  )
}
