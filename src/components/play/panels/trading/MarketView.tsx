'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Building2,
  BarChart3,
  Calculator,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import type { MarketItem } from '../../types'
import styles from './MarketView.module.css'

interface MarketInsight {
  category: string
  item: string
  item_id: string
  message: string
  priority: number
}

interface AnalysisData {
  insights: MarketInsight[]
  skill_level: number
  station: string
  message: string
}

interface EstimateFill {
  price_each: number
  quantity: number
  source: string
}

interface EstimateData {
  item: string
  quantity_requested: number
  available: number
  total_cost: number
  fills: EstimateFill[]
  unfilled: number
  message: string
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  sell_here: { color: 'var(--bio-green)', bg: 'rgba(45, 212, 191, 0.12)', border: 'rgba(45, 212, 191, 0.3)' },
  opportunity: { color: 'var(--bio-green)', bg: 'rgba(45, 212, 191, 0.12)', border: 'rgba(45, 212, 191, 0.3)' },
  order_warning: { color: 'var(--claw-red)', bg: 'rgba(230, 57, 70, 0.12)', border: 'rgba(230, 57, 70, 0.3)' },
  demand: { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.3)' },
  trend: { color: 'var(--void-purple)', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.3)' },
  supply_imbalance: { color: 'var(--shell-orange)', bg: 'rgba(255, 107, 53, 0.12)', border: 'rgba(255, 107, 53, 0.3)' },
  arbitrage: { color: 'var(--plasma-cyan)', bg: 'rgba(0, 212, 255, 0.12)', border: 'rgba(0, 212, 255, 0.3)' },
  depth_warning: { color: 'var(--warning-yellow)', bg: 'rgba(255, 217, 61, 0.12)', border: 'rgba(255, 217, 61, 0.3)' },
}

export function MarketView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const marketData = state.marketData
  const cargo = state.ship?.cargo || []

  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [buyQty, setBuyQty] = useState('1')
  const [sellQty, setSellQty] = useState('1')
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(true)
  const [estimateData, setEstimateData] = useState<Record<string, EstimateData>>({})
  const [estimatingItem, setEstimatingItem] = useState<string | null>(null)

  // Auto-fetch market data when docked and data is null
  useEffect(() => {
    if (isDocked && !marketData) {
      sendCommand('view_market')
    }
  }, [isDocked, marketData, sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('view_market')
  }, [sendCommand])

  const handleToggleItem = useCallback((itemId: string) => {
    setExpandedItem((prev) => (prev === itemId ? null : itemId))
    setBuyQty('1')
    setSellQty('1')
  }, [])

  const handleBuyAtMarket = useCallback(
    (itemId: string) => {
      const quantity = parseInt(buyQty, 10)
      if (isNaN(quantity) || quantity < 1) return
      sendCommand('buy', { item_id: itemId, quantity })
      setBuyQty('1')
    },
    [sendCommand, buyQty]
  )

  const handleSellAtMarket = useCallback(
    (itemId: string) => {
      const quantity = parseInt(sellQty, 10)
      if (isNaN(quantity) || quantity < 1) return
      sendCommand('sell', { item_id: itemId, quantity })
      setSellQty('1')
    },
    [sendCommand, sellQty]
  )

  const handleAnalyzeMarket = useCallback(() => {
    sendCommand('analyze_market').then((resp: unknown) => {
      const data = resp as AnalysisData | undefined
      if (data?.insights) {
        setAnalysisData(data)
        setAnalysisOpen(true)
      }
    })
  }, [sendCommand])

  const handleEstimatePurchase = useCallback(
    (itemId: string) => {
      const quantity = parseInt(buyQty, 10)
      if (isNaN(quantity) || quantity < 1) return
      setEstimatingItem(itemId)
      sendCommand('estimate_purchase', { item_id: itemId, quantity }).then((resp: unknown) => {
        const data = resp as EstimateData | undefined
        if (data?.fills) {
          setEstimateData((prev) => ({ ...prev, [itemId]: data }))
        }
        setEstimatingItem(null)
      })
    },
    [sendCommand, buyQty]
  )

  if (!isDocked) {
    return (
      <div className={styles.dockedOnly}>
        Dock at a base to access the market
      </div>
    )
  }

  const items = marketData?.items || []

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.baseName}>
          <Building2 size={12} />
          {marketData?.base || 'Market'}
        </span>
        <div className={styles.toolbarActions}>
          <button
            className={styles.analyzeBtn}
            onClick={handleAnalyzeMarket}
            title="Analyze market"
            type="button"
          >
            <BarChart3 size={13} />
          </button>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            title="Refresh market data"
            type="button"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Market Analysis Insights */}
      {analysisData && analysisData.insights.length > 0 && (
        <div className={styles.insightsSection}>
          <button
            className={styles.insightsToggle}
            onClick={() => setAnalysisOpen(!analysisOpen)}
            type="button"
          >
            {analysisOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <BarChart3 size={11} />
            <span>Analysis ({analysisData.insights.length})</span>
          </button>
          {analysisOpen && (
            <div className={styles.insightsList}>
              {[...analysisData.insights]
                .sort((a, b) => b.priority - a.priority)
                .map((insight, i) => {
                  const catStyle = CATEGORY_COLORS[insight.category] || CATEGORY_COLORS.demand
                  return (
                    <div key={i} className={styles.insightItem}>
                      <span
                        className={styles.insightBadge}
                        style={{
                          color: catStyle.color,
                          background: catStyle.bg,
                          borderColor: catStyle.border,
                        }}
                      >
                        {insight.category.replace(/_/g, ' ')}
                      </span>
                      <span className={styles.insightItemName}>{insight.item}</span>
                      <span className={styles.insightMessage}>{insight.message}</span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {!marketData ? (
        <div className={styles.loading}>Loading market data...</div>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          {marketData.message || 'No items listed on this market.'}
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className={styles.tableHeader}>
            <span className={styles.colItem}>Item</span>
            <span className={styles.colPrice}>Best Buy</span>
            <span className={styles.colPrice}>Best Ask</span>
            <span className={styles.colPrice}>Spread</span>
          </div>

          {/* Item rows */}
          <div className={styles.itemList}>
            {items.map((item: MarketItem) => {
              const isExpanded = expandedItem === item.item_id
              const hasBuy = item.best_buy > 0
              const hasSell = item.best_sell > 0
              const spread = item.spread ?? (hasBuy && hasSell ? item.best_sell - item.best_buy : undefined)
              const cargoItem = cargo.find((c) => c.item_id === item.item_id)

              return (
                <div key={item.item_id} className={styles.itemBlock}>
                  <button
                    className={`${styles.itemRow} ${isExpanded ? styles.itemRowExpanded : ''}`}
                    onClick={() => handleToggleItem(item.item_id)}
                    type="button"
                  >
                    <span className={styles.colItem}>
                      {isExpanded ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      <span className={styles.itemName}>{item.item_name}</span>
                    </span>
                    <span className={`${styles.colPrice} ${hasBuy ? styles.buyPrice : styles.noPrice}`}>
                      {hasBuy ? item.best_buy.toLocaleString() : '--'}
                    </span>
                    <span className={`${styles.colPrice} ${hasSell ? styles.sellPrice : styles.noPrice}`}>
                      {hasSell ? item.best_sell.toLocaleString() : '--'}
                    </span>
                    <span className={`${styles.colPrice} ${spread != null && spread >= 0 ? styles.spreadPositive : styles.noPrice}`}>
                      {spread != null ? spread.toLocaleString() : '--'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.expandedPanel}>
                      {/* Order book */}
                      <div className={styles.orderBookRow}>
                        {/* Sell orders (asks) - sorted low to high */}
                        <div className={styles.orderBookSide}>
                          <div className={styles.orderBookLabel}>
                            <TrendingDown size={11} />
                            Sell Orders (Asks)
                          </div>
                          {item.sell_orders.length > 0 ? (
                            <div className={styles.orderList}>
                              {[...item.sell_orders]
                                .sort((a, b) => a.price_each - b.price_each)
                                .map((order, i) => (
                                  <div
                                    key={i}
                                    className={`${styles.orderEntry} ${styles.orderSell}`}
                                  >
                                    <span className={styles.orderPrice}>
                                      {order.price_each.toLocaleString()} cr
                                    </span>
                                    <span className={styles.orderQty}>
                                      x{order.quantity.toLocaleString()}
                                    </span>
                                    {order.source === 'npc' && (
                                      <span className={styles.npcTag}>NPC</span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className={styles.noOrders}>No sell orders</div>
                          )}
                        </div>

                        {/* Buy orders (bids) - sorted high to low */}
                        <div className={styles.orderBookSide}>
                          <div className={styles.orderBookLabel}>
                            <TrendingUp size={11} />
                            Buy Orders (Bids)
                          </div>
                          {item.buy_orders.length > 0 ? (
                            <div className={styles.orderList}>
                              {[...item.buy_orders]
                                .sort((a, b) => b.price_each - a.price_each)
                                .map((order, i) => (
                                  <div
                                    key={i}
                                    className={`${styles.orderEntry} ${styles.orderBuy}`}
                                  >
                                    <span className={styles.orderPrice}>
                                      {order.price_each.toLocaleString()} cr
                                    </span>
                                    <span className={styles.orderQty}>
                                      x{order.quantity.toLocaleString()}
                                    </span>
                                    {order.source === 'npc' && (
                                      <span className={styles.npcTag}>NPC</span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className={styles.noOrders}>No buy orders</div>
                          )}
                        </div>
                      </div>

                      {/* Quick trade forms */}
                      <div className={styles.quickTradeForms}>
                        {/* Quick Buy */}
                        <div className={styles.quickForm}>
                          <span className={styles.quickLabel}>Buy at Market</span>
                          <div className={styles.quickRow}>
                            <input
                              className={styles.quickInput}
                              type="number"
                              min={1}
                              placeholder="Qty"
                              value={buyQty}
                              onChange={(e) => setBuyQty(e.target.value)}
                            />
                            <button
                              className={styles.estimateBtn}
                              onClick={() => handleEstimatePurchase(item.item_id)}
                              disabled={!buyQty || parseInt(buyQty, 10) < 1 || estimatingItem === item.item_id}
                              title="Estimate purchase cost"
                              type="button"
                            >
                              <Calculator size={11} />
                              Est.
                            </button>
                            <button
                              className={styles.quickBuyBtn}
                              onClick={() => handleBuyAtMarket(item.item_id)}
                              disabled={!buyQty || parseInt(buyQty, 10) < 1}
                              type="button"
                            >
                              <ShoppingCart size={11} />
                              Buy
                            </button>
                          </div>
                          {/* Estimate Breakdown */}
                          {estimateData[item.item_id] && (
                            <div className={styles.estimateBreakdown}>
                              <div className={styles.estimateTotal}>
                                Total: {estimateData[item.item_id].total_cost.toLocaleString()} cr
                                {estimateData[item.item_id].unfilled > 0 && (
                                  <span className={styles.estimateUnfilled}>
                                    ({estimateData[item.item_id].unfilled} unfilled)
                                  </span>
                                )}
                              </div>
                              {estimateData[item.item_id].fills.length > 0 && (
                                <div className={styles.estimateFills}>
                                  {estimateData[item.item_id].fills.map((fill, fi) => (
                                    <div key={fi} className={styles.estimateFill}>
                                      <span className={styles.estimateFillQty}>x{fill.quantity}</span>
                                      <span className={styles.estimateFillPrice}>
                                        @ {fill.price_each.toLocaleString()} cr
                                      </span>
                                      {fill.source === 'npc' && (
                                        <span className={styles.npcTag}>NPC</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quick Sell */}
                        <div className={styles.quickForm}>
                          <span className={styles.quickLabel}>
                            Sell at Market
                            {cargoItem && (
                              <span className={styles.cargoHint}>
                                (have {cargoItem.quantity})
                              </span>
                            )}
                          </span>
                          <div className={styles.quickRow}>
                            <input
                              className={styles.quickInput}
                              type="number"
                              min={1}
                              max={cargoItem?.quantity}
                              placeholder="Qty"
                              value={sellQty}
                              onChange={(e) => setSellQty(e.target.value)}
                            />
                            <button
                              className={styles.quickSellBtn}
                              onClick={() => handleSellAtMarket(item.item_id)}
                              disabled={
                                !sellQty ||
                                parseInt(sellQty, 10) < 1 ||
                                !cargoItem ||
                                parseInt(sellQty, 10) > cargoItem.quantity
                              }
                              type="button"
                            >
                              <TrendingUp size={11} />
                              Sell
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
