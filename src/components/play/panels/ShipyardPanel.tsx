'use client'

import { useState } from 'react'
import {
  Warehouse,
  Layers,
  Hammer,
  Store,
} from 'lucide-react'
import { ShipCatalog } from './ship/ShipCatalog'
import { CommissionsView } from './ship/CommissionsView'
import { MarketplaceView } from './ship/MarketplaceView'
import styles from './ShipPanel.module.css'

type TabId = 'catalog' | 'commissions' | 'marketplace'

export function ShipyardPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('catalog')

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Warehouse size={16} />
          </span>
          Shipyard
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'catalog' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('catalog')}
          type="button"
        >
          <Layers size={13} />
          Catalog
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'commissions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('commissions')}
          type="button"
        >
          <Hammer size={13} />
          Commissions
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'marketplace' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('marketplace')}
          type="button"
        >
          <Store size={13} />
          Marketplace
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'catalog' && <ShipCatalog />}
        {activeTab === 'commissions' && <CommissionsView />}
        {activeTab === 'marketplace' && <MarketplaceView />}
      </div>
    </div>
  )
}
