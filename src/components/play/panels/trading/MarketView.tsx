'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Credits, Loading, Modal, shared } from '../../shared'
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

type SortField = 'name' | 'buyQty' | 'buyPrice' | 'sellQty' | 'sellPrice' | 'spread'
type SortDir = 'asc' | 'desc'
type ShowFilter = 'all' | 'buying' | 'selling'

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

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function MarketView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const marketData = state.marketData
  const cargo = state.ship?.cargo || []

  const credits = state.player?.credits ?? 0
  const storageItems = state.storageData?.items || []

  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [buyQty, setBuyQty] = useState('1')
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(true)

  // Buy confirmation modal
  const [buyEstimate, setBuyEstimate] = useState<{ itemId: string; itemName: string; data: EstimateData } | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [buying, setBuying] = useState(false)

  // New listing form
  const [listingItemId, setListingItemId] = useState<string | null>(null)
  const [listingQty, setListingQty] = useState('')
  const [listingPrice, setListingPrice] = useState('')
  const [listing, setListing] = useState(false)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilter, setShowFilter] = useState<ShowFilter>('all')

  // Sort
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Auto-fetch market data when docked and data is null
  useEffect(() => {
    if (isDocked && !marketData) {
      sendCommand('view_market')
    }
  }, [isDocked, marketData, sendCommand])

  const handleRefresh = useCallback(() => {
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
    (itemId: string) => {
      setExpandedItem(prev => prev === itemId ? null : itemId)
      setBuyQty('1')
      setListingItemId(null)
    },
    []
  )

  // Buy at market: estimate first, then show modal
  const handleBuyEstimate = useCallback(
    (itemId: string, itemName: string, quantity: number) => {
      setEstimating(true)
      sendCommand('estimate_purchase', { item_id: itemId, quantity }).then((resp: unknown) => {
        const data = resp as EstimateData | undefined
        if (data) {
          setBuyEstimate({ itemId, itemName, data })
        }
        setEstimating(false)
      }).catch(() => setEstimating(false))
    },
    [sendCommand]
  )

  const handleConfirmBuy = useCallback(() => {
    if (!buyEstimate) return
    setBuying(true)
    sendCommand('buy', { item_id: buyEstimate.itemId, quantity: buyEstimate.data.quantity_requested }).then(() => {
      setBuying(false)
      setBuyEstimate(null)
      setBuyQty('1')
      sendCommand('view_market')
    }).catch(() => setBuying(false))
  }, [sendCommand, buyEstimate])

  // Sell to a specific buy order
  const handleSellToOrder = useCallback(
    (itemId: string, quantity: number) => {
      sendCommand('sell', { item_id: itemId, quantity }).then(() => {
        sendCommand('view_market')
      })
    },
    [sendCommand]
  )

  // Buy from a specific sell order
  const handleBuyFromOrder = useCallback(
    (itemId: string, quantity: number) => {
      sendCommand('buy', { item_id: itemId, quantity }).then(() => {
        sendCommand('view_market')
      })
    },
    [sendCommand]
  )

  // Create a new sell listing
  const handleCreateListing = useCallback(() => {
    if (!listingItemId || !listingQty || !listingPrice) return
    const qty = parseInt(listingQty, 10)
    const price = parseInt(listingPrice, 10)
    if (isNaN(qty) || qty < 1 || isNaN(price) || price < 1) return
    setListing(true)
    sendCommand('create_sell_order', { item_id: listingItemId, quantity: qty, price_each: price }).then(() => {
      setListing(false)
      setListingItemId(null)
      setListingQty('')
      setListingPrice('')
      sendCommand('view_market')
    }).catch(() => setListing(false))
  }, [sendCommand, listingItemId, listingQty, listingPrice])

  const handleAnalyzeMarket = useCallback(() => {
    sendCommand('analyze_market').then((resp: unknown) => {
      const data = resp as AnalysisData | undefined
      if (data?.insights) {
        setAnalysisData(data)
        setAnalysisOpen(true)
      }
    })
  }, [sendCommand])

  // Helper: get available quantity for an item (cargo + storage)
  const getAvailable = useCallback((itemId: string): number => {
    const inCargo = cargo.find(c => c.item_id === itemId)?.quantity ?? 0
    const inStorage = storageItems.find((s: { item_id: string; quantity: number }) => s.item_id === itemId)?.quantity ?? 0
    return inCargo + inStorage
  }, [cargo, storageItems])

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
    }

    // Sort within categories
    const getSortValue = (item: MarketItem): number | string => {
      switch (sortField) {
        case 'name': return item.item_name.toLowerCase()
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
  }, [marketData?.items, selectedCategory, searchQuery, showFilter, sortField, sortDir])

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
            className={shared.iconBtn}
            onClick={handleAnalyzeMarket}
            title="Analyze market"
            type="button"
          >
            <BarChart3 size={13} />
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
        <Loading message="Loading market data..." />
      ) : groupedItems.length === 0 ? (
        <div className={shared.emptyState}>
          {searchQuery || selectedCategory || showFilter !== 'all'
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
                  const cargoItem = cargo.find((c) => c.item_id === item.item_id)
                  const totalBuyQty = item.buy_orders.reduce((sum, o) => sum + o.quantity, 0)
                  const totalSellQty = item.sell_orders.reduce((sum, o) => sum + o.quantity, 0)

                  return (
                    <div key={item.item_id} className={styles.itemBlock}>
                      <button
                        className={`${styles.itemRow} ${isExpanded ? styles.itemRowExpanded : ''}`}
                        onClick={() => handleToggleItem(item.item_id)}
                        type="button"
                      >
                        <span className={styles.colItem}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className={styles.itemName}>{item.item_name}</span>
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
                          buyQty={buyQty}
                          setBuyQty={setBuyQty}
                          estimating={estimating}
                          onBuyEstimate={handleBuyEstimate}
                          onBuyFromOrder={handleBuyFromOrder}
                          onSellToOrder={handleSellToOrder}
                          getAvailable={getAvailable}
                          listingItemId={listingItemId}
                          setListingItemId={setListingItemId}
                          listingQty={listingQty}
                          setListingQty={setListingQty}
                          listingPrice={listingPrice}
                          setListingPrice={setListingPrice}
                          listing={listing}
                          onCreateListing={handleCreateListing}
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
function ExpandedItemPanel({ item, credits, buyQty, setBuyQty, estimating, onBuyEstimate, onBuyFromOrder, onSellToOrder, getAvailable, listingItemId, setListingItemId, listingQty, setListingQty, listingPrice, setListingPrice, listing, onCreateListing }: {
  item: MarketItem
  credits: number
  buyQty: string
  setBuyQty: (v: string) => void
  estimating: boolean
  onBuyEstimate: (itemId: string, itemName: string, qty: number) => void
  onBuyFromOrder: (itemId: string, qty: number) => void
  onSellToOrder: (itemId: string, qty: number) => void
  getAvailable: (itemId: string) => number
  listingItemId: string | null
  setListingItemId: (v: string | null) => void
  listingQty: string
  setListingQty: (v: string) => void
  listingPrice: string
  setListingPrice: (v: string) => void
  listing: boolean
  onCreateListing: () => void
}) {
  const available = getAvailable(item.item_id)

  // Per-order qty state (keyed by order index)
  const [orderQtys, setOrderQtys] = useState<Record<string, string>>({})
  const setOrderQty = (key: string, val: string) => setOrderQtys(prev => ({ ...prev, [key]: val }))

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
                  .map((order, i) => {
                    const key = `sell-${i}`
                    const maxBuyable = Math.min(order.quantity, Math.floor(credits / order.price_each))
                    const qty = orderQtys[key] ?? String(maxBuyable > 0 ? maxBuyable : '')
                    return (
                      <div key={i} className={`${styles.orderEntry} ${styles.orderSell}`}>
                        <span className={styles.orderPrice}>
                          <Credits amount={order.price_each} />
                        </span>
                        <span className={styles.orderQty}>x{order.quantity.toLocaleString()}</span>
                        {order.source === 'npc' && <span className={styles.npcTag}>NPC</span>}
                        <div className={styles.orderAction}>
                          <QtyButtons max={maxBuyable} current={qty} onChange={(v) => setOrderQty(key, v)} />
                          <input
                            className={styles.orderQtyInput}
                            type="number"
                            min={1}
                            max={order.quantity}
                            value={qty}
                            onChange={(e) => setOrderQty(key, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            className={shared.actionBtn}
                            onClick={(e) => { e.stopPropagation(); onBuyFromOrder(item.item_id, parseInt(qty, 10) || 0) }}
                            disabled={!qty || parseInt(qty, 10) < 1}
                            type="button"
                          >
                            Buy
                          </button>
                        </div>
                      </div>
                    )
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
                  .map((order, i) => {
                    const key = `buy-${i}`
                    const maxSellable = Math.min(order.quantity, available)
                    const qty = orderQtys[key] ?? String(maxSellable > 0 ? maxSellable : '')
                    return (
                      <div key={i} className={`${styles.orderEntry} ${styles.orderBuy}`}>
                        <span className={styles.orderPrice}>
                          <Credits amount={order.price_each} />
                        </span>
                        <span className={styles.orderQty}>x{order.quantity.toLocaleString()}</span>
                        {order.source === 'npc' && <span className={styles.npcTag}>NPC</span>}
                        <div className={styles.orderAction}>
                          <QtyButtons max={maxSellable} current={qty} onChange={(v) => setOrderQty(key, v)} />
                          <input
                            className={styles.orderQtyInput}
                            type="number"
                            min={1}
                            max={order.quantity}
                            value={qty}
                            onChange={(e) => setOrderQty(key, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            className={shared.warningBtn}
                            onClick={(e) => { e.stopPropagation(); onSellToOrder(item.item_id, parseInt(qty, 10) || 0) }}
                            disabled={!qty || parseInt(qty, 10) < 1 || available === 0}
                            type="button"
                          >
                            Sell
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className={styles.noOrders}>No buy orders</div>
            )}
          </div>
        </div>
      </div>

      {/* Actions row: Buy at Market + New Listing */}
      <div className={styles.quickTradeForms}>
        <div className={styles.quickForm}>
          <span className={styles.quickLabel}>Buy at Market</span>
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
              onClick={() => onBuyEstimate(item.item_id, item.item_name, parseInt(buyQty, 10) || 0)}
              disabled={!buyQty || parseInt(buyQty, 10) < 1 || estimating}
              type="button"
            >
              {estimating ? <Loader2 size={11} className={shared.spinner} /> : <ShoppingCart size={11} />}
              Buy
            </button>
          </div>
        </div>

        <div className={styles.quickForm}>
          <span className={styles.quickLabel}>
            New Listing
            {available > 0 && <span className={styles.cargoHint}>(have {available})</span>}
          </span>
          {listingItemId === item.item_id ? (
            <div className={styles.quickRow}>
              <input
                className={shared.textInput}
                type="number"
                min={1}
                max={available}
                placeholder="Qty"
                value={listingQty}
                onChange={(e) => setListingQty(e.target.value)}
              />
              <input
                className={shared.textInput}
                type="number"
                min={1}
                placeholder="Price"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
              />
              <button
                className={shared.warningBtn}
                onClick={onCreateListing}
                disabled={listing || !listingQty || !listingPrice || parseInt(listingQty, 10) < 1 || parseInt(listingPrice, 10) < 1 || parseInt(listingQty, 10) > available}
                type="button"
              >
                {listing ? <Loader2 size={11} className={shared.spinner} /> : <Plus size={11} />}
                List
              </button>
              <button className={shared.subtleBtn} onClick={() => setListingItemId(null)} type="button">
                Cancel
              </button>
            </div>
          ) : (
            <button
              className={shared.warningBtn}
              onClick={() => { setListingItemId(item.item_id); setListingQty(''); setListingPrice('') }}
              disabled={available === 0}
              type="button"
            >
              <Plus size={11} /> New Listing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
