'use client'

import { useState } from 'react'
import {
  Rocket,
  Gauge,
  Layers,
  Ship,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ShipStatus } from './ship/ShipStatus'
import { ShipModules } from './ship/ShipModules'
import { ShipCatalog } from './ship/ShipCatalog'
import { FleetView } from './ship/FleetView'
import styles from './ShipPanel.module.css'

type TabId = 'status' | 'catalog' | 'fleet'

export function ShipPanel() {
  const { state } = useGame()
  const [activeTab, setActiveTab] = useState<TabId>('status')

  if (!state.ship && activeTab === 'status') {
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

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'status' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('status')}
          type="button"
        >
          <Gauge size={13} />
          Status
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'catalog' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('catalog')}
          type="button"
        >
          <Layers size={13} />
          Catalog
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'fleet' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('fleet')}
          type="button"
        >
          <Ship size={13} />
          Fleet
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'status' && (
          <>
            <ShipStatus />
            <ShipModules />
          </>
        )}
        {activeTab === 'catalog' && <ShipCatalog />}
        {activeTab === 'fleet' && <FleetView />}
      </div>
    </div>
  )
}
