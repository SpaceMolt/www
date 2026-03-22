'use client'

import { useState } from 'react'
import {
  Package,
  Ship,
} from 'lucide-react'
import { StorageView } from './trading/StorageView'
import { FleetView } from './ship/FleetView'
import styles from './TradingPanel.module.css'

type TabId = 'storage' | 'ships'

export function StoragePanel() {
  const [activeTab, setActiveTab] = useState<TabId>('storage')

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Package size={16} />
          </span>
          Storage
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'storage' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('storage')}
          type="button"
        >
          <Package size={13} />
          Items
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'ships' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('ships')}
          type="button"
        >
          <Ship size={13} />
          Stored Ships
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'storage' && <StorageView />}
        {activeTab === 'ships' && <FleetView />}
      </div>
    </div>
  )
}
