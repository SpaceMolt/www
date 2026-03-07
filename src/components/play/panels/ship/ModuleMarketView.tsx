'use client'

import { useState, useCallback } from 'react'
import {
  CircuitBoard,
  RefreshCw,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Wrench,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import type { MarketItem } from '../../types'
import styles from './ModuleMarketView.module.css'

interface ModuleMarketData {
  items: MarketItem[]
  base?: string
  message?: string
}

export function ModuleMarketView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const [marketData, setMarketData] = useState<ModuleMarketData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLoad = useCallback(() => {
    setLoading(true)
    setError(null)
    sendCommand('view_market', { category: 'module' })
      .then((resp: unknown) => {
        const data = resp as { items?: MarketItem[]; base?: string; message?: string } | undefined
        if (data?.items) {
          setMarketData({ items: data.items, base: data.base, message: data.message })
        } else {
          setMarketData({ items: [], message: data?.message || 'No modules available.' })
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load module market.')
        setLoading(false)
      })
  }, [sendCommand])

  const handleBuy = useCallback(
    (itemId: string) => {
      setBusyItem(itemId)
      sendCommand('buy', { item_id: itemId, quantity: 1 })
        .then(() => {
          handleLoad()
        })
        .finally(() => setBusyItem(null))
    },
    [sendCommand, handleLoad]
  )

  const handleBuyAndInstall = useCallback(
    (itemId: string) => {
      setBusyItem(itemId)
      sendCommand('buy', { item_id: itemId, quantity: 1 })
        .then(() => {
          return sendCommand('install_mod', { module_id: itemId })
        })
        .then(() => {
          handleLoad()
        })
        .finally(() => setBusyItem(null))
    },
    [sendCommand, handleLoad]
  )

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

      {error && (
        <div className={styles.emptyState}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {loading && !marketData && (
        <div className={styles.loading}>Loading modules...</div>
      )}

      {!loading && !marketData && !error && (
        <div className={styles.emptyState}>
          Click refresh to load available modules.
        </div>
      )}

      {marketData && marketData.items.length === 0 && (
        <div className={styles.emptyState}>
          {marketData.message || 'No modules available at this base.'}
        </div>
      )}

      {marketData && marketData.items.length > 0 && (
        <div className={styles.moduleList}>
          {marketData.items.map((item) => {
            const isExpanded = expandedModule === item.item_id
            const price = item.best_sell
            const hasStock = price > 0
            const totalQty = item.sell_orders.reduce((sum, o) => sum + o.quantity, 0)
            const isBusy = busyItem === item.item_id

            return (
              <div key={item.item_id} className={styles.moduleBlock}>
                <button
                  className={`${styles.moduleRow} ${isExpanded ? styles.moduleRowExpanded : ''}`}
                  onClick={() => setExpandedModule(isExpanded ? null : item.item_id)}
                  type="button"
                >
                  <span className={styles.moduleInfo}>
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className={styles.moduleName}>{item.item_name}</span>
                    {totalQty > 0 && (
                      <span className={styles.moduleType}>x{totalQty}</span>
                    )}
                  </span>
                  <span className={styles.modulePrice}>
                    {hasStock ? `${price.toLocaleString()} cr` : 'Out of stock'}
                  </span>
                </button>

                {isExpanded && (
                  <div className={styles.expandedPanel}>
                    {/* Sell order details */}
                    {item.sell_orders.length > 0 && (
                      <div className={styles.moduleMeta}>
                        {[...item.sell_orders]
                          .sort((a, b) => a.price_each - b.price_each)
                          .map((order, i) => (
                            <span key={i} className={styles.metaItem}>
                              {order.quantity}x @ {order.price_each.toLocaleString()} cr
                              {order.source === 'npc' ? ' (NPC)' : ''}
                            </span>
                          ))}
                      </div>
                    )}

                    {!hasStock && (
                      <div className={styles.moduleDesc}>
                        No sell orders available for this module.
                      </div>
                    )}

                    {hasStock && (
                      <div className={styles.actions}>
                        <button
                          className={styles.buyBtn}
                          onClick={() => handleBuy(item.item_id)}
                          disabled={isBusy}
                          type="button"
                        >
                          <ShoppingCart size={11} />
                          {isBusy ? 'Buying...' : 'Buy'}
                        </button>
                        <button
                          className={styles.installBtn}
                          onClick={() => handleBuyAndInstall(item.item_id)}
                          disabled={isBusy}
                          type="button"
                        >
                          <Wrench size={11} />
                          {isBusy ? 'Working...' : 'Buy & Install'}
                        </button>
                      </div>
                    )}
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
