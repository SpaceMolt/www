'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ShoppingCart,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Building2,
  BarChart3,
  Search,
  ArrowUpDown,
  Plus,
  Loader2,
  AlertTriangle,
  Bookmark,
  X,
  Lightbulb,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { getCatalogItem } from '../../../ItemDetail'
import { ItemName } from '../../ItemTooltip'
import { Credits, Loading, Modal, shared } from '../../shared'
import { useHoverTooltip } from '../../hooks/useHoverTooltip'
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

interface MarketItem {
  item_id: string
  item_name: string
  category: string
  best_buy: number
  best_sell: number
  buy_price: number
  buy_quantity: number
  sell_price: number
  sell_quantity: number
  spread?: number
  buy_orders: Array<{ price_each: number; quantity: number; source?: string; my_quantity?: number }>
  sell_orders: Array<{ price_each: number; quantity: number; source?: string; my_quantity?: number }>
}

type SortField = 'name' | 'have' | 'buyQty' | 'buyPrice' | 'sellQty' | 'sellPrice' | 'spread'
type SortDir = 'asc' | 'desc'
type ShowFilter = 'all' | 'buying' | 'selling' | 'mine' | 'insights'

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Insight badge with rich hover tooltip */
function InsightBadge({ insights }: { insights: MarketInsight[] }) {
  const { ref, show, position, handleMouseEnter, handleMouseLeave } = useHoverTooltip({ delay: 150, width: 300 })

  return (
    <>
      <span
        ref={ref}
        className={styles.insightBadge}
        role="img"
        aria-label={insights.map(i => `${formatCategory(i.category)}: ${i.message}`).join('. ')}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Lightbulb size={10} aria-hidden="true" />
      </span>
      {show && createPortal(
        <div className={styles.insightTooltip} style={{ top: position.top, left: position.left }}>
          <div className={styles.insightTooltipHeader}>
            <Lightbulb size={12} aria-hidden="true" />
            Market Insights
          </div>
          {insights.map((insight, i) => (
            <div key={i} className={styles.insightTooltipRow}>
              <span className={styles.insightTooltipCategory}>{formatCategory(insight.category)}</span>
              <span className={styles.insightTooltipMessage}>{insight.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

export function MarketView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const marketData = state.marketData
  const cargo = state.ship?.cargo || []

  const credits = state.player?.credits ?? 0
  const storageItems = state.storageData?.items || []
  const ordersData = state.ordersData

  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // Buy confirmation modal
  const [buyEstimate, setBuyEstimate] = useState<{ itemId: string; itemName: string; data: EstimateData } | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [buying, setBuying] = useState(false)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilter, setShowFilter] = useState<ShowFilter>('all')

  // Sort
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Sell confirmation modal
  const [sellConfirm, setSellConfirm] = useState<{
    itemId: string; itemName: string; quantity: number; priceEach: number; total: number; baseValue: number
  } | null>(null)
  const [selling, setSelling] = useState(false)

  // Track whether we've auto-analyzed for the current market data
  const analyzedRef = useRef(false)

  // Auto-fetch market + storage data when docked
  useEffect(() => {
    if (isDocked && !marketData) {
      sendCommand('view_market')
    }
    if (isDocked && !state.storageData) {
      sendCommand('view_storage')
    }
    if (isDocked && !ordersData) {
      sendCommand('view_orders')
    }
  }, [isDocked, marketData, state.storageData, ordersData, sendCommand])

  // Auto-analyze market when data arrives
  useEffect(() => {
    if (!marketData || analyzedRef.current) return
    analyzedRef.current = true
    setAnalysisLoading(true)
    sendCommand('analyze_market').then((resp: unknown) => {
      const r = resp as Record<string, unknown>
      if (!r.error) {
        const data = resp as AnalysisData
        if (data.insights) setAnalysisData(data)
      }
      setAnalysisLoading(false)
    })
  }, [marketData, sendCommand])

  const handleRefresh = useCallback(() => {
    analyzedRef.current = false
    sendCommand('view_market')
  }, [sendCommand])

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategory(prev => prev === category ? '' : category)
    setExpandedItem(null)
  }, [])

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return field
      }
      setSortDir(field === 'name' ? 'asc' : 'desc')
      return field
    })
  }, [])

  const handleToggleItem = useCallback(
    (itemId: string) => setExpandedItem(prev => prev === itemId ? null : itemId),
    []
  )

  // Buy at market: estimate first, then show modal
  const handleBuyEstimate = useCallback(
    (itemId: string, itemName: string, quantity: number) => {
      setEstimating(true)
      sendCommand('estimate_purchase', { item_id: itemId, quantity }).then((resp: unknown) => {
        const r = resp as Record<string, unknown>
        if (!r.error) setBuyEstimate({ itemId, itemName, data: resp as EstimateData })
        setEstimating(false)
      })
    },
    [sendCommand]
  )

  const handleConfirmBuy = useCallback(() => {
    if (!buyEstimate) return
    setBuying(true)
    sendCommand('buy', { item_id: buyEstimate.itemId, quantity: buyEstimate.data.quantity_requested }).then((resp: unknown) => {
      setBuying(false)
      const r = resp as Record<string, unknown>
      if (!r.error) {
        setBuyEstimate(null)
        sendCommand('view_market')
      }
    })
  }, [sendCommand, buyEstimate])

  const handleAnalyzeMarket = useCallback(() => {
    setAnalysisLoading(true)
    sendCommand('analyze_market').then((resp: unknown) => {
      const r = resp as Record<string, unknown>
      if (!r.error) {
        const data = resp as AnalysisData
        if (data.insights) setAnalysisData(data)
      }
      setAnalysisLoading(false)
    })
  }, [sendCommand])

  // Sell confirmation: show modal with price check
  const handleQuickSell = useCallback(
    (itemId: string, itemName: string, quantity: number, priceEach: number, baseValue: number) => {
      setSellConfirm({ itemId, itemName, quantity, priceEach, total: quantity * priceEach, baseValue })
    },
    []
  )

  const handleConfirmSell = useCallback(() => {
    if (!sellConfirm) return
    setSelling(true)
    sendCommand('sell', { item_id: sellConfirm.itemId, quantity: sellConfirm.quantity }).then((resp: unknown) => {
      setSelling(false)
      const r = resp as Record<string, unknown>
      if (!r.error) {
        setSellConfirm(null)
        sendCommand('view_market')
      }
    })
  }, [sendCommand, sellConfirm])

  const haveMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cargo) map.set(c.item_id, (map.get(c.item_id) ?? 0) + c.quantity)
    for (const s of storageItems as Array<{ item_id: string; quantity: number }>) map.set(s.item_id, (map.get(s.item_id) ?? 0) + s.quantity)
    return map
  }, [cargo, storageItems])

  const getAvailable = useCallback((itemId: string) => haveMap.get(itemId) ?? 0, [haveMap])

  // Map insights by item_id for inline display; separate general (non-item) insights
  const { insightsByItem, generalInsights } = useMemo(() => {
    const map = new Map<string, MarketInsight[]>()
    const general: MarketInsight[] = []
    if (!analysisData?.insights) return { insightsByItem: map, generalInsights: general }
    for (const insight of analysisData.insights) {
      if (!insight.item_id) {
        general.push(insight)
      } else {
        const existing = map.get(insight.item_id)
        if (existing) existing.push(insight)
        else map.set(insight.item_id, [insight])
      }
    }
    return { insightsByItem: map, generalInsights: general }
  }, [analysisData?.insights])

  // Filter and sort items
  const { groupedItems, visibleCategories } = useMemo(() => {
    const items = (marketData?.items || []) as MarketItem[]
    const search = searchQuery.toLowerCase().trim()

    // Filter
    let filtered = items
    if (selectedCategory) {
      filtered = filtered.filter(i => i.category === selectedCategory)
    }
    if (search) {
      filtered = filtered.filter(i =>
        i.item_name.toLowerCase().includes(search) || i.item_id.toLowerCase().includes(search)
      )
    }
    if (showFilter === 'buying') {
      filtered = filtered.filter(i => i.buy_orders.length > 0)
    } else if (showFilter === 'selling') {
      filtered = filtered.filter(i => i.sell_orders.length > 0)
    } else if (showFilter === 'mine') {
      // Build owned items map from cargo + storage
      const owned = new Map<string, { name: string; quantity: number }>()
      for (const c of cargo) {
        const prev = owned.get(c.item_id)
        owned.set(c.item_id, {
          name: c.name || prev?.name || c.item_id,
          quantity: (prev?.quantity ?? 0) + c.quantity,
        })
      }
      for (const s of storageItems as Array<{ item_id: string; name: string; quantity: number }>) {
        const prev = owned.get(s.item_id)
        owned.set(s.item_id, {
          name: s.name || prev?.name || s.item_id,
          quantity: (prev?.quantity ?? 0) + s.quantity,
        })
      }

      // Filter market items to ones we own
      filtered = filtered.filter(i => owned.has(i.item_id))

      // Synthesize rows for owned items not in market data
      const marketIds = new Set(items.map(i => i.item_id))
      for (const [itemId, info] of owned) {
        if (marketIds.has(itemId)) continue
        if (selectedCategory) continue // synthetic items have no real category
        if (search && !info.name.toLowerCase().includes(search) && !itemId.toLowerCase().includes(search)) continue
        filtered.push({
          item_id: itemId,
          item_name: info.name,
          category: 'inventory',
          best_buy: 0,
          best_sell: 0,
          buy_price: 0,
          buy_quantity: 0,
          sell_price: 0,
          sell_quantity: 0,
          buy_orders: [],
          sell_orders: [],
        })
      }
    } else if (showFilter === 'insights') {
      filtered = filtered.filter(i => insightsByItem.has(i.item_id))
    }

    // Sort within categories
    const getSortValue = (item: MarketItem): number | string => {
      switch (sortField) {
        case 'name': return item.item_name.toLowerCase()
        case 'have': return haveMap.get(item.item_id) ?? 0
        case 'buyQty': return item.buy_orders.reduce((s, o) => s + o.quantity, 0)
        case 'buyPrice': return item.best_buy
        case 'sellQty': return item.sell_orders.reduce((s, o) => s + o.quantity, 0)
        case 'sellPrice': return item.best_sell
        case 'spread': return item.spread ?? (item.best_buy > 0 && item.best_sell > 0 ? item.best_sell - item.best_buy : -Infinity)
        default: return item.item_name.toLowerCase()
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      const va = getSortValue(a)
      const vb = getSortValue(b)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    // Group by category
    const groups: Record<string, MarketItem[]> = {}
    for (const item of sorted) {
      const cat = item.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }

    // Sort category keys alphabetically
    const sortedCats = Object.keys(groups).sort()

    return {
      groupedItems: sortedCats.map(cat => ({ category: cat, items: groups[cat] })),
      visibleCategories: sortedCats,
    }
  }, [marketData?.items, selectedCategory, searchQuery, showFilter, sortField, sortDir, haveMap, insightsByItem])

  if (!isDocked) {
    return (
      <div className={shared.dockedOnly}>
        Dock at a base to access the market
      </div>
    )
  }

  const allCategories = marketData?.categories || []

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={9} className={styles.sortInactive} />
    return <span className={styles.sortActive}>{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.baseName}>
          <Building2 size={12} />
          {marketData?.base || 'Market'}
        </span>
        <div className={styles.toolbarActions}>
          <button
            className={shared.actionBtn}
            onClick={handleAnalyzeMarket}
            disabled={analysisLoading}
            type="button"
          >
            {analysisLoading ? <Loader2 size={11} className={shared.spinner} /> : <BarChart3 size={11} />}
            {analysisData ? 'Re-analyze' : 'Analyze'}
          </button>
          <button
            className={shared.refreshBtn}
            onClick={handleRefresh}
            title="Refresh market data"
            type="button"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Search + show filter */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={12} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.showToggles}>
          <button
            className={`${styles.showToggle} ${showFilter === 'all' ? styles.showToggleActive : ''}`}
            onClick={() => setShowFilter('all')}
            type="button"
          >All</button>
          <button
            className={`${styles.showToggle} ${showFilter === 'buying' ? styles.showToggleActive : ''}`}
            onClick={() => setShowFilter('buying')}
            type="button"
          >Buying</button>
          <button
            className={`${styles.showToggle} ${showFilter === 'selling' ? styles.showToggleActive : ''}`}
            onClick={() => setShowFilter('selling')}
            type="button"
          >Selling</button>
          <button
            className={`${styles.showToggle} ${showFilter === 'mine' ? styles.showToggleActive : ''}`}
            onClick={() => setShowFilter('mine')}
            type="button"
          >Mine</button>
        </div>
      </div>

      {/* Category toggles */}
      {allCategories.length > 0 && (
        <div className={styles.categoryToggles}>
          {allCategories.map(cat => (
            <button
              key={cat}
              className={`${styles.categoryToggle} ${selectedCategory === cat ? styles.categoryToggleActive : ''}`}
              onClick={() => handleCategoryToggle(cat)}
              type="button"
            >
              {formatCategory(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Inline analysis status */}
      {analysisLoading ? (
        <div className={styles.analysisStatus}>
          <Loader2 size={10} className={shared.spinner} />
          <span>Analyzing market...</span>
        </div>
      ) : analysisData?.insights && analysisData.insights.length > 0 ? (
        <button
          className={`${styles.analysisStatus} ${styles.analysisStatusClickable} ${showFilter === 'insights' ? styles.analysisStatusActive : ''}`}
          onClick={() => setShowFilter(prev => prev === 'insights' ? 'all' : 'insights')}
          type="button"
        >
          <span className={styles.insightBadge}><Lightbulb size={10} aria-hidden="true" /></span>
          <span>{analysisData.insights.length} insight{analysisData.insights.length !== 1 ? 's' : ''} found</span>
          {showFilter === 'insights' && <X size={10} />}
        </button>
      ) : null}

      {showFilter === 'insights' && generalInsights.length > 0 && (
        <div className={styles.generalInsightsPanel}>
          <div className={styles.generalInsightsHeader}>
            <Lightbulb size={10} />
            General Insights
          </div>
          {generalInsights.map((insight, i) => (
            <div key={i} className={styles.generalInsightRow}>
              <span className={styles.generalInsightCategory}>{formatCategory(insight.category)}</span>
              <span className={styles.generalInsightMessage}>{insight.message}</span>
            </div>
          ))}
        </div>
      )}

      {!marketData ? (
        <Loading message="Loading market data..." />
      ) : groupedItems.length === 0 ? (
        <div className={shared.emptyState}>
          {showFilter === 'insights'
            ? 'No items with insights.'
            : showFilter === 'mine'
              ? 'No items in cargo or storage at this base.'
              : searchQuery || selectedCategory || showFilter !== 'all'
                ? 'No items match your filters.'
                : (marketData.message || 'No items listed on this market.')}
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className={styles.tableHeader}>
            <button className={`${styles.colItem} ${styles.colSortable}`} onClick={() => handleSort('name')} type="button">
              Item {sortIndicator('name')}
            </button>
            <button className={`${styles.colHave} ${styles.colSortable}`} onClick={() => handleSort('have')} type="button">
              Have {sortIndicator('have')}
            </button>
            <button className={`${styles.colQty} ${styles.colSortable}`} onClick={() => handleSort('buyQty')} type="button">
              Qty {sortIndicator('buyQty')}
            </button>
            <button className={`${styles.colPrice} ${styles.colSortable}`} onClick={() => handleSort('buyPrice')} type="button">
              Buying For {sortIndicator('buyPrice')}
            </button>
            <button className={`${styles.colQty} ${styles.colSortable}`} onClick={() => handleSort('sellQty')} type="button">
              Qty {sortIndicator('sellQty')}
            </button>
            <button className={`${styles.colPrice} ${styles.colSortable}`} onClick={() => handleSort('sellPrice')} type="button">
              Selling At {sortIndicator('sellPrice')}
            </button>
            <button className={`${styles.colPrice} ${styles.colSortable}`} onClick={() => handleSort('spread')} type="button">
              Spread {sortIndicator('spread')}
            </button>
          </div>

          {/* Item rows grouped by category */}
          <div className={styles.itemList}>
            {groupedItems.map(({ category, items }) => (
              <div key={category}>
                <div className={styles.categoryHeader}>
                  {formatCategory(category)}
                  <span className={styles.categoryCount}>{items.length}</span>
                </div>
                {items.map((item) => {
                  const isExpanded = expandedItem === item.item_id
                  const hasBuy = item.best_buy > 0
                  const hasSell = item.best_sell > 0
                  const spread = item.spread ?? (hasBuy && hasSell ? item.best_sell - item.best_buy : undefined)
                  const haveQty = getAvailable(item.item_id)
                  const hasMyOrders = item.buy_orders.some(o => (o.my_quantity ?? 0) > 0) || item.sell_orders.some(o => (o.my_quantity ?? 0) > 0)
                  const totalBuyQty = item.buy_orders.reduce((sum, o) => sum + o.quantity, 0)
                  const totalSellQty = item.sell_orders.reduce((sum, o) => sum + o.quantity, 0)
                  const itemInsights = insightsByItem.get(item.item_id)

                  return (
                    <div key={item.item_id} className={styles.itemBlock}>
                      <button
                        className={`${styles.itemRow} ${isExpanded ? styles.itemRowExpanded : ''} ${haveQty > 0 && showFilter !== 'mine' ? styles.itemRowOwned : ''}`}
                        onClick={() => handleToggleItem(item.item_id)}
                        type="button"
                      >
                        <span className={styles.colItem}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className={styles.itemName}><ItemName itemId={item.item_id}>{item.item_name}</ItemName></span>
                          {hasMyOrders && (
                            <span className={styles.myOrderBadge} title="You have active orders">
                              <Bookmark size={9} />
                            </span>
                          )}
                          {itemInsights && itemInsights.length > 0 && (
                            <InsightBadge insights={itemInsights} />
                          )}
                        </span>
                        <span className={`${styles.colHave} ${haveQty > 0 ? styles.haveQty : styles.noPrice}`}>
                          {haveQty > 0 ? haveQty.toLocaleString() : '--'}
                        </span>
                        <span className={`${styles.colQty} ${hasBuy ? styles.buyPrice : styles.noPrice}`}>
                          {totalBuyQty > 0 ? totalBuyQty.toLocaleString() : '--'}
                        </span>
                        <span className={`${styles.colPrice} ${hasBuy ? styles.buyPrice : styles.noPrice}`}>
                          {hasBuy ? item.best_buy.toLocaleString() : '--'}
                        </span>
                        <span className={`${styles.colQty} ${hasSell ? styles.sellPrice : styles.noPrice}`}>
                          {totalSellQty > 0 ? totalSellQty.toLocaleString() : '--'}
                        </span>
                        <span className={`${styles.colPrice} ${hasSell ? styles.sellPrice : styles.noPrice}`}>
                          {hasSell ? item.best_sell.toLocaleString() : '--'}
                        </span>
                        <span className={`${styles.colPrice} ${spread != null && spread >= 0 ? styles.spreadPositive : styles.noPrice}`}>
                          {spread != null ? spread.toLocaleString() : '--'}
                        </span>
                      </button>

                      {isExpanded && (
                        <ExpandedItemPanel
                          item={item}
                          credits={credits}
                          getAvailable={getAvailable}
                          sendCommand={sendCommand}
                          ordersData={ordersData}
                          onBuyEstimate={handleBuyEstimate}
                          estimating={estimating}
                          onQuickSell={handleQuickSell}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Buy confirmation modal */}
      {buyEstimate && (
        <Modal title={`Buy ${buyEstimate.itemName}`} icon={<ShoppingCart size={14} />} onClose={() => setBuyEstimate(null)}>
          <div className={styles.estimateBreakdown}>
            <div className={styles.estimateTotal}>
              Total: <Credits amount={buyEstimate.data.total_cost} />
              {buyEstimate.data.unfilled > 0 && (
                <span className={styles.estimateUnfilled}>
                  ({buyEstimate.data.unfilled} unfilled)
                </span>
              )}
            </div>
            {buyEstimate.data.total_cost > credits && (
              <div className={styles.estimateUnfilled}>
                Insufficient credits (have <Credits amount={credits} />)
              </div>
            )}
            {buyEstimate.data.fills.length > 0 && (
              <div className={styles.estimateFills}>
                {buyEstimate.data.fills.map((fill, fi) => (
                  <div key={fi} className={styles.estimateFill}>
                    <span className={styles.estimateFillQty}>x{fill.quantity}</span>
                    <span className={styles.estimateFillPrice}>
                      @ <Credits amount={fill.price_each} />
                    </span>
                    {fill.source === 'npc' && <span className={styles.npcTag}>NPC</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.modalBuyActions}>
            <button
              className={shared.actionBtn}
              onClick={handleConfirmBuy}
              disabled={buying || buyEstimate.data.total_cost > credits || buyEstimate.data.available === 0}
              type="button"
            >
              {buying ? <Loader2 size={11} className={shared.spinner} /> : <ShoppingCart size={11} />}
              Confirm Buy
            </button>
            <button className={shared.subtleBtn} onClick={() => setBuyEstimate(null)} type="button">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Sell confirmation modal */}
      {sellConfirm && (
        <Modal title={`Sell ${sellConfirm.itemName}`} icon={<ShoppingCart size={14} />} onClose={() => setSellConfirm(null)}>
          <div className={styles.estimateBreakdown}>
            <div className={styles.estimateTotal}>
              Sell {sellConfirm.quantity} × <Credits amount={sellConfirm.priceEach} /> = <Credits amount={sellConfirm.total} />
            </div>
            {sellConfirm.baseValue > 0 && sellConfirm.priceEach < sellConfirm.baseValue && (
              <div className={styles.sellWarning}>
                <AlertTriangle size={12} />
                Selling at {Math.round((sellConfirm.priceEach / sellConfirm.baseValue) * 100)}% of base value ({sellConfirm.baseValue.toLocaleString()} cr)
              </div>
            )}
          </div>
          <div className={styles.modalBuyActions}>
            <button
              className={sellConfirm.baseValue > 0 && sellConfirm.priceEach < sellConfirm.baseValue * 0.5 ? shared.dangerBtn : shared.warningBtn}
              onClick={handleConfirmSell}
              disabled={selling}
              type="button"
            >
              {selling ? <Loader2 size={11} className={shared.spinner} /> : <ShoppingCart size={11} />}
              Confirm Sell
            </button>
            <button className={shared.subtleBtn} onClick={() => setSellConfirm(null)} type="button">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Quick-fill qty buttons */
function QtyButtons({ max, current, onChange }: { max: number; current: string; onChange: (v: string) => void }) {
  const cur = parseInt(current, 10) || 0
  const add = (n: number) => onChange(String(Math.min(max, cur + n)))
  return (
    <div className={styles.qtyButtons}>
      <button className={styles.qtyBtn} onClick={(e) => { e.stopPropagation(); add(5) }} disabled={cur >= max} type="button">+5</button>
      <button className={styles.qtyBtn} onClick={(e) => { e.stopPropagation(); add(10) }} disabled={cur >= max} type="button">+10</button>
      <button className={styles.qtyBtn} onClick={(e) => { e.stopPropagation(); add(100) }} disabled={cur >= max} type="button">+100</button>
      <button className={`${styles.qtyBtn} ${styles.qtyBtnMax}`} onClick={(e) => { e.stopPropagation(); onChange(String(max)) }} disabled={cur >= max} type="button">MAX</button>
    </div>
  )
}

/** Expanded panel for a single market item — order book + actions */
function ExpandedItemPanel({ item, credits, getAvailable, sendCommand, ordersData, onBuyEstimate, estimating, onQuickSell }: {
  item: MarketItem
  credits: number
  getAvailable: (itemId: string) => number
  sendCommand: (cmd: string, params?: Record<string, unknown>) => Promise<unknown>
  ordersData: { orders: Array<{ order_id: string; item_id: string; price_each: number; order_type: string; remaining: number }> } | null
  onBuyEstimate: (itemId: string, itemName: string, qty: number) => void
  estimating: boolean
  onQuickSell: (itemId: string, itemName: string, quantity: number, priceEach: number, baseValue: number) => void
}) {
  const available = getAvailable(item.item_id)
  const catalogItem = getCatalogItem(item.item_id)
  const baseValue = catalogItem?.base_value ?? 0

  // Best non-own buy order for quick sell
  const bestBuyer = item.buy_orders.length > 0
    ? [...item.buy_orders]
        .filter(o => (o.quantity - (o.my_quantity ?? 0)) > 0)
        .sort((a, b) => b.price_each - a.price_each)[0] ?? null
    : null
  const quickSellQty = bestBuyer ? Math.min(available, bestBuyer.quantity - (bestBuyer.my_quantity ?? 0)) : 0

  const [buyQty, setBuyQty] = useState('1')
  const [listingOpen, setListingOpen] = useState(false)
  const [listingQty, setListingQty] = useState('')
  const [listingPrice, setListingPrice] = useState('')
  const [listing, setListing] = useState(false)
  const [orderQtys, setOrderQtys] = useState<Record<string, string>>({})
  const setOrderQty = (key: string, val: string) => setOrderQtys(prev => ({ ...prev, [key]: val }))

  const submitOrder = useCallback((cmd: string, params: Record<string, unknown>, onSuccess?: () => void) => {
    setListing(true)
    sendCommand(cmd, params).then((resp: unknown) => {
      setListing(false)
      const r = resp as Record<string, unknown>
      if (!r.error) {
        sendCommand('view_market')
        onSuccess?.()
      }
    })
  }, [sendCommand])

  const handleTradeOrder = useCallback(
    (cmd: 'buy' | 'sell', qty: number) => sendCommand(cmd, { item_id: item.item_id, quantity: qty }).then(() => { sendCommand('view_market') }),
    [sendCommand, item.item_id]
  )

  const handleCancelOrder = useCallback(
    (orderId: string) => sendCommand('cancel_order', { order_id: orderId }).then(() => {
      sendCommand('view_market')
      sendCommand('view_orders')
    }),
    [sendCommand]
  )

  const handleSubmitListing = useCallback(() => {
    const qty = parseInt(listingQty, 10)
    const price = parseInt(listingPrice, 10)
    if (qty >= 1 && price >= 1) {
      submitOrder('create_sell_order', { item_id: item.item_id, quantity: qty, price_each: price }, () => {
        setListingOpen(false); setListingQty(''); setListingPrice('')
      })
    }
  }, [listingQty, listingPrice, submitOrder, item.item_id])

  const findOrderId = (priceEach: number, side: 'buy' | 'sell'): string | undefined => {
    if (!ordersData) return undefined
    return ordersData.orders.find(
      o => o.item_id === item.item_id && o.price_each === priceEach && o.order_type === side
    )?.order_id
  }

  // Shared renderer for "YOURS" cancel row in order book
  const renderOwnOrderRow = (key: string, priceEach: number, quantity: number, side: 'buy' | 'sell') => {
    const orderId = findOrderId(priceEach, side)
    return (
      <div key={key} className={`${styles.orderEntry} ${styles.orderMine}`}>
        <span className={styles.orderPrice}><Credits amount={priceEach} /></span>
        <span className={styles.orderQty}>x{quantity.toLocaleString()}</span>
        <span className={styles.yourTag}>YOURS</span>
        {orderId && (
          <div className={styles.orderAction}>
            <button className={shared.dangerBtn} onClick={(e) => { e.stopPropagation(); handleCancelOrder(orderId) }} type="button">
              <X size={10} /> Cancel
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.expandedPanel}>
      {/* Order book */}
      <div className={styles.orderBookRow}>
        {/* Sell orders (asks) - sorted low to high */}
        <div className={styles.orderBookSide}>
          <div className={styles.orderBookLabel}>
            <TrendingDown size={11} />
            Selling At
          </div>
          <div className={styles.orderBookScroll}>
            {item.sell_orders.length > 0 ? (
              <div className={styles.orderList}>
                {[...item.sell_orders]
                  .sort((a, b) => a.price_each - b.price_each)
                  .flatMap((order, i) => {
                    const myQty = order.my_quantity ?? 0
                    const othersQty = order.quantity - myQty
                    const rows: React.ReactNode[] = []

                    if (othersQty > 0) {
                      const key = `sell-${i}`
                      const maxBuyable = Math.min(othersQty, Math.floor(credits / order.price_each))
                      const qty = orderQtys[key] ?? String(maxBuyable > 0 ? maxBuyable : '')
                      rows.push(
                        <div key={key} className={`${styles.orderEntry} ${styles.orderSell}`}>
                          <span className={styles.orderPrice}><Credits amount={order.price_each} /></span>
                          <span className={styles.orderQty}>x{othersQty.toLocaleString()}</span>
                          {order.source === 'npc' && <span className={styles.npcTag}>NPC</span>}
                          <div className={styles.orderAction}>
                            <QtyButtons max={maxBuyable} current={qty} onChange={(v) => setOrderQty(key, v)} />
                            <input className={styles.orderQtyInput} type="number" min={1} max={othersQty} value={qty}
                              onChange={(e) => setOrderQty(key, e.target.value)} onClick={(e) => e.stopPropagation()} />
                            <button className={shared.actionBtn}
                              onClick={(e) => { e.stopPropagation(); handleTradeOrder('buy', parseInt(qty, 10) || 0) }}
                              disabled={!qty || parseInt(qty, 10) < 1} type="button">Buy</button>
                          </div>
                        </div>
                      )
                    }
                    if (myQty > 0) rows.push(renderOwnOrderRow(`sell-mine-${i}`, order.price_each, myQty, 'sell'))
                    return rows
                  })}
              </div>
            ) : (
              <div className={styles.noOrders}>No sell orders</div>
            )}
          </div>
        </div>

        {/* Buy orders (bids) - sorted high to low */}
        <div className={styles.orderBookSide}>
          <div className={styles.orderBookLabel}>
            <TrendingUp size={11} />
            Buying For
          </div>
          <div className={styles.orderBookScroll}>
            {item.buy_orders.length > 0 ? (
              <div className={styles.orderList}>
                {[...item.buy_orders]
                  .sort((a, b) => b.price_each - a.price_each)
                  .flatMap((order, i) => {
                    const myQty = order.my_quantity ?? 0
                    const othersQty = order.quantity - myQty
                    const rows: React.ReactNode[] = []

                    if (othersQty > 0) {
                      const key = `buy-${i}`
                      const maxSellable = Math.min(othersQty, available)
                      const qty = orderQtys[key] ?? String(maxSellable > 0 ? maxSellable : '')
                      rows.push(
                        <div key={key} className={`${styles.orderEntry} ${styles.orderBuy}`}>
                          <span className={styles.orderPrice}><Credits amount={order.price_each} /></span>
                          <span className={styles.orderQty}>x{othersQty.toLocaleString()}</span>
                          {order.source === 'npc' && <span className={styles.npcTag}>NPC</span>}
                          <div className={styles.orderAction}>
                            <QtyButtons max={maxSellable} current={qty} onChange={(v) => setOrderQty(key, v)} />
                            <input className={styles.orderQtyInput} type="number" min={1} max={othersQty} value={qty}
                              onChange={(e) => setOrderQty(key, e.target.value)} onClick={(e) => e.stopPropagation()} />
                            <button className={shared.warningBtn}
                              onClick={(e) => { e.stopPropagation(); handleTradeOrder('sell', parseInt(qty, 10) || 0) }}
                              disabled={!qty || parseInt(qty, 10) < 1 || available === 0} type="button">Sell</button>
                          </div>
                        </div>
                      )
                    }
                    if (myQty > 0) rows.push(renderOwnOrderRow(`buy-mine-${i}`, order.price_each, myQty, 'buy'))
                    return rows
                  })}
              </div>
            ) : (
              <div className={styles.noOrders}>No buy orders</div>
            )}
          </div>
        </div>
      </div>

      {quickSellQty > 0 && bestBuyer && (
        <div className={styles.quickSell}>
          <span className={styles.quickSellLabel}>
            Quick Sell: {quickSellQty} × <Credits amount={bestBuyer.price_each} /> = <Credits amount={quickSellQty * bestBuyer.price_each} />
            {baseValue > 0 && bestBuyer.price_each < baseValue && (
              <span className={styles.sellWarningInline}>
                <AlertTriangle size={9} />
                {Math.round((bestBuyer.price_each / baseValue) * 100)}% of base
              </span>
            )}
          </span>
          <button
            className={baseValue > 0 && bestBuyer.price_each < baseValue * 0.5 ? shared.dangerBtn : shared.warningBtn}
            onClick={() => onQuickSell(item.item_id, item.item_name, quickSellQty, bestBuyer.price_each, baseValue)}
            type="button"
          >
            <ShoppingCart size={11} />
            Sell to Best Buyer
          </button>
        </div>
      )}

      {/* Actions row: Buy Quantity + New Listing */}
      <div className={styles.quickTradeForms}>
        <div className={styles.quickForm}>
          <span className={styles.quickLabel}>Buy Quantity</span>
          <div className={styles.quickRow}>
            <input
              className={shared.textInput}
              type="number"
              min={1}
              placeholder="Qty"
              value={buyQty}
              onChange={(e) => setBuyQty(e.target.value)}
            />
            <button
              className={shared.actionBtn}
              onClick={() => onBuyEstimate(item.item_id, item.item_name, parseInt(buyQty, 10))}
              disabled={!buyQty || parseInt(buyQty, 10) < 1 || estimating}
              type="button"
            >
              {estimating ? <Loader2 size={11} className={shared.spinner} /> : <ShoppingCart size={11} />}
              Buy at Market
            </button>
            <button
              className={shared.actionBtn}
              onClick={() => submitOrder('create_buy_order', { item_id: item.item_id, quantity: parseInt(buyQty, 10) || 0, price_each: baseValue })}
              disabled={!buyQty || parseInt(buyQty, 10) < 1 || baseValue < 1}
              title={baseValue > 0 ? `Place buy order at ${baseValue.toLocaleString()} cr each` : 'Base price unavailable'}
              type="button"
            >
              <Plus size={11} />
              Order at Base Price
            </button>
          </div>
          {baseValue > 0 && (
            <span className={styles.cargoHint}>Base price: {baseValue.toLocaleString()} cr</span>
          )}
        </div>

        <div className={styles.quickForm}>
          <span className={styles.quickLabel}>
            New Listing
            {available > 0 && <span className={styles.cargoHint}>(have {available})</span>}
          </span>
          {listingOpen ? (
            <div className={styles.quickRow}>
              <input className={shared.textInput} type="number" min={1} max={available} placeholder="Qty"
                value={listingQty} onChange={(e) => setListingQty(e.target.value)} />
              <input className={shared.textInput} type="number" min={1} placeholder="Price"
                value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} />
              <button className={shared.warningBtn} onClick={handleSubmitListing}
                disabled={listing || !listingQty || !listingPrice || parseInt(listingQty, 10) < 1 || parseInt(listingPrice, 10) < 1 || parseInt(listingQty, 10) > available}
                type="button">
                {listing ? <Loader2 size={11} className={shared.spinner} /> : <Plus size={11} />}
                List
              </button>
              <button className={shared.subtleBtn} onClick={() => setListingOpen(false)} type="button">Cancel</button>
            </div>
          ) : (
            <div className={styles.listingButtons}>
              <button className={shared.warningBtn}
                onClick={() => { setListingOpen(true); setListingQty(''); setListingPrice('') }}
                disabled={available === 0} type="button">
                <Plus size={11} /> New Listing
              </button>
              <button
                className={shared.warningBtn}
                onClick={() => submitOrder('create_sell_order', { item_id: item.item_id, quantity: available, price_each: baseValue })}
                disabled={listing || available === 0 || baseValue < 1}
                title={baseValue > 0 ? `List all ${available} at ${baseValue.toLocaleString()} cr each` : 'Base price unavailable'}
                type="button"
              >
                {listing ? <Loader2 size={11} className={shared.spinner} /> : <Plus size={11} />}
                List All at Base Price
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
