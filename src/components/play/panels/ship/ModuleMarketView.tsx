'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CircuitBoard,
  RefreshCw,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Cpu,
  Zap,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import styles from './ModuleMarketView.module.css'

interface ModuleForSale {
  module_id: string
  name: string
  type: string
  slot_type: string
  price: number
  cpu_cost: number
  power_cost: number
  description?: string
  stats?: Record<string, unknown>
}

interface ModuleMarketData {
  modules: ModuleForSale[]
  base?: string
  message?: string
}

export function ModuleMarketView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const [marketData, setMarketData] = useState<ModuleMarketData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  const handleLoad = useCallback(() => {
    setLoading(true)
    sendCommand('view_module_market').then((resp: unknown) => {
      const data = resp as ModuleMarketData | undefined
      if (data?.modules) {
        setMarketData(data)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sendCommand])

  // Auto-load when docked
  useEffect(() => {
    if (isDocked && !marketData) {
      handleLoad()
    }
  }, [isDocked, marketData, handleLoad])

  const handleBuy = useCallback((moduleId: string) => {
    sendCommand('buy_module', { module_id: moduleId }).then(() => {
      handleLoad() // Refresh after purchase
    })
  }, [sendCommand, handleLoad])

  const handleInstall = useCallback((moduleId: string) => {
    sendCommand('install_module', { module_id: moduleId })
  }, [sendCommand])

  if (!isDocked) {
    return (
      <div className={styles.dockedOnly}>
        Dock at a base to browse modules
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.label}>
          <CircuitBoard size={12} />
          Module Market
        </span>
        <button
          className={styles.refreshBtn}
          onClick={handleLoad}
          title="Refresh modules"
          type="button"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {loading && !marketData && (
        <div className={styles.loading}>Loading modules...</div>
      )}

      {marketData && marketData.modules.length === 0 && (
        <div className={styles.emptyState}>
          {marketData.message || 'No modules available at this base.'}
        </div>
      )}

      {marketData && marketData.modules.length > 0 && (
        <div className={styles.moduleList}>
          {marketData.modules.map((mod) => {
            const isExpanded = expandedModule === mod.module_id
            return (
              <div key={mod.module_id} className={styles.moduleBlock}>
                <button
                  className={`${styles.moduleRow} ${isExpanded ? styles.moduleRowExpanded : ''}`}
                  onClick={() => setExpandedModule(isExpanded ? null : mod.module_id)}
                  type="button"
                >
                  <span className={styles.moduleInfo}>
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className={styles.moduleName}>{mod.name}</span>
                    <span className={styles.moduleType}>{mod.slot_type}</span>
                  </span>
                  <span className={styles.modulePrice}>
                    {mod.price.toLocaleString()} cr
                  </span>
                </button>

                {isExpanded && (
                  <div className={styles.expandedPanel}>
                    {mod.description && (
                      <div className={styles.moduleDesc}>{mod.description}</div>
                    )}
                    <div className={styles.moduleMeta}>
                      <span className={styles.metaItem}>
                        <Cpu size={10} /> CPU: {mod.cpu_cost}
                      </span>
                      <span className={styles.metaItem}>
                        <Zap size={10} /> Power: {mod.power_cost}
                      </span>
                      <span className={styles.metaItem}>
                        Type: {mod.type}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.buyBtn}
                        onClick={() => handleBuy(mod.module_id)}
                        type="button"
                      >
                        <ShoppingCart size={11} />
                        Buy
                      </button>
                      <button
                        className={styles.installBtn}
                        onClick={() => handleInstall(mod.module_id)}
                        type="button"
                      >
                        <CircuitBoard size={11} />
                        Buy & Install
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
