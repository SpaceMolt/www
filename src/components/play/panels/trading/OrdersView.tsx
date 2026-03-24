'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside'
import {
  ClipboardList,
  RefreshCw,
  X,
  Plus,
  Users,
  Pencil,
  Check,
  Search,
  ChevronDown,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Credits, shared } from '../../shared'
import { getItem, tradeableItems, formatItemId } from '@/data/catalog'
import type { RawCatalogItem } from '@/data/catalog'
import styles from './OrdersView.module.css'

// ── Sell Item Dropdown ──────────────────────────────────────────────────

interface SellDropdownProps {
  items: Array<{ item_id: string; name: string; quantity: number }>
  value: string
  onChange: (itemId: string) => void
}

function SellDropdown({ items, value, onChange }: SellDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(i => i.name.toLowerCase().includes(q) || i.item_id.toLowerCase().includes(q))
  }, [items, search])

  const handleClose = useCallback(() => setOpen(false), [])
  useClickOutside(ref, open, handleClose)

  const selectedItem = items.find(i => i.item_id === value)

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        className={styles.dropdownTrigger}
        onClick={() => { setOpen(!open); if (!open) setTimeout(() => inputRef.current?.focus(), 0) }}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={styles.dropdownValue}>
          {selectedItem ? `${selectedItem.name} (${selectedItem.quantity})` : 'Select item...'}
        </span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className={styles.dropdownPanel}>
          <div className={styles.dropdownSearch}>
            <Search size={11} />
            <input
              ref={inputRef}
              className={styles.dropdownSearchInput}
              type="text"
              placeholder="Search inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.dropdownList} role="listbox">
            {filtered.length === 0 ? (
              <div className={styles.dropdownEmpty}>No matching items</div>
            ) : filtered.map(item => (
              <button
                key={item.item_id}
                className={`${styles.dropdownItem} ${item.item_id === value ? styles.dropdownItemActive : ''}`}
                onClick={() => { onChange(item.item_id); setOpen(false); setSearch('') }}
                type="button"
                role="option"
                aria-selected={item.item_id === value}
              >
                <span className={styles.dropdownItemName}>{item.name}</span>
                <span className={styles.dropdownItemQty}>{item.quantity}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Buy Item Autocomplete ───────────────────────────────────────────────

interface BuyAutocompleteProps {
  value: string
  onChange: (itemId: string) => void
}

function BuyAutocomplete({ value, onChange }: BuyAutocompleteProps) {
  const [inputText, setInputText] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    if (!inputText || inputText.length < 2) return []
    const q = inputText.toLowerCase()
    return tradeableItems()
      .filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
  }, [inputText])

  const handleClose = useCallback(() => setOpen(false), [])
  useClickOutside(ref, open, handleClose)

  // Sync display text when value changes externally
  useEffect(() => {
    if (value) {
      const item = getItem(value)
      if (item) setInputText(item.name)
    } else {
      setInputText('')
    }
  }, [value])

  const handleSelect = (item: RawCatalogItem) => {
    onChange(item.id)
    setInputText(item.name)
    setOpen(false)
  }

  const handleInputChange = (text: string) => {
    setInputText(text)
    setOpen(text.length >= 2)
    // Clear selection only when the text no longer matches the selected item
    if (value) {
      const selected = getItem(value)
      if (!selected || selected.name !== text) onChange('')
    }
  }

  return (
    <div className={styles.autocomplete} ref={ref}>
      <div className={styles.autocompleteInputWrap}>
        <Search size={11} />
        <input
          className={styles.autocompleteInput}
          type="text"
          placeholder="Search all items..."
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (inputText.length >= 2) setOpen(true) }}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-autocomplete="list"
        />
        {value && (
          <button
            className={styles.autocompleteClear}
            onClick={() => { onChange(''); setInputText(''); setOpen(false) }}
            type="button"
          >
            <X size={10} />
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className={styles.autocompletePanel} role="listbox">
          {suggestions.map(item => (
            <button
              key={item.id}
              className={`${styles.dropdownItem} ${item.id === value ? styles.dropdownItemActive : ''}`}
              onClick={() => handleSelect(item)}
              type="button"
              role="option"
              aria-selected={item.id === value}
            >
              <span className={styles.dropdownItemName}>{item.name}</span>
              <span className={styles.dropdownItemCategory}>{item.category || item.type || ''}</span>
              {item.base_value != null && item.base_value > 0 && (
                <span className={styles.dropdownItemPrice}>{item.base_value.toLocaleString()} cr</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main OrdersView ─────────────────────────────────────────────────────

export function OrdersView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const ordersData = state.ordersData
  const cargo = state.ship?.cargo || []
  const storageItems = state.storageData?.items || []

  // Build inventory list for sell dropdown: tradeable items in cargo + storage
  const inventoryItems = useMemo(() => {
    const map = new Map<string, { item_id: string; name: string; quantity: number }>()
    for (const c of cargo) {
      if (!c.item_id || c.quantity <= 0) continue
      const cat = getItem(c.item_id)
      if (cat && cat.tradeable === false) continue
      const existing = map.get(c.item_id)
      if (existing) {
        existing.quantity += c.quantity
      } else {
        map.set(c.item_id, {
          item_id: c.item_id,
          name: cat?.name ?? formatItemId(c.item_id),
          quantity: c.quantity,
        })
      }
    }
    for (const s of storageItems) {
      if (!s.item_id || s.quantity <= 0) continue
      const cat = getItem(s.item_id)
      if (cat && cat.tradeable === false) continue
      const existing = map.get(s.item_id)
      if (existing) {
        existing.quantity += s.quantity
      } else {
        map.set(s.item_id, {
          item_id: s.item_id,
          name: cat?.name ?? formatItemId(s.item_id),
          quantity: s.quantity,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [cargo, storageItems])

  // New order form state
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('sell')
  const [orderItemId, setOrderItemId] = useState('')
  const [orderQty, setOrderQty] = useState('')
  const [orderPrice, setOrderPrice] = useState('')
  const [showForm, setShowForm] = useState(false)

  // When item changes, set default qty and price
  const handleSellItemChange = useCallback((itemId: string) => {
    setOrderItemId(itemId)
    if (itemId) {
      const inv = inventoryItems.find(i => i.item_id === itemId)
      if (inv) setOrderQty(inv.quantity.toString())
      const catalogItem = getItem(itemId)
      if (catalogItem?.base_value) setOrderPrice(catalogItem.base_value.toString())
    } else {
      setOrderQty('')
      setOrderPrice('')
    }
  }, [inventoryItems])

  const handleBuyItemChange = useCallback((itemId: string) => {
    setOrderItemId(itemId)
    if (itemId) {
      setOrderQty('')
      const catalogItem = getItem(itemId)
      if (catalogItem?.base_value) setOrderPrice(catalogItem.base_value.toString())
      else setOrderPrice('')
    } else {
      setOrderQty('')
      setOrderPrice('')
    }
  }, [])

  // Reset form fields when switching type
  const handleTypeChange = useCallback((type: 'buy' | 'sell') => {
    setOrderType(type)
    setOrderItemId('')
    setOrderQty('')
    setOrderPrice('')
  }, [])

  // Modify order state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [modifyResult, setModifyResult] = useState<Record<string, { message: string; listing_fee?: number }>>({})

  // Auto-fetch orders when docked and data is null
  useEffect(() => {
    if (isDocked && !ordersData) {
      sendCommand('view_orders')
    }
    if (isDocked && !state.storageData) {
      sendCommand('view_storage')
    }
  }, [isDocked, ordersData, state.storageData, sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('view_orders')
  }, [sendCommand])

  const handleCancelOrder = useCallback(
    (orderId: string) => {
      sendCommand('cancel_order', { order_id: orderId })
    },
    [sendCommand]
  )

  const handleCreateOrder = useCallback(() => {
    const quantity = parseInt(orderQty, 10)
    const priceEach = parseInt(orderPrice, 10)
    if (!orderItemId.trim() || isNaN(quantity) || quantity < 1 || isNaN(priceEach) || priceEach < 1) return

    const cmd = orderType === 'sell' ? 'create_sell_order' : 'create_buy_order'
    sendCommand(cmd, {
      item_id: orderItemId.trim(),
      quantity,
      price_each: priceEach,
    })
    setOrderItemId('')
    setOrderQty('')
    setOrderPrice('')
    setShowForm(false)
  }, [sendCommand, orderType, orderItemId, orderQty, orderPrice])

  const handleStartModify = useCallback((orderId: string, currentPrice: number) => {
    setEditingOrderId(orderId)
    setEditPrice(currentPrice.toString())
    setModifyResult((prev) => {
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }, [])

  const handleCancelModify = useCallback(() => {
    setEditingOrderId(null)
    setEditPrice('')
  }, [])

  const handleSubmitModify = useCallback(
    (orderId: string) => {
      const newPrice = parseInt(editPrice, 10)
      if (isNaN(newPrice) || newPrice < 1) return
      sendCommand('modify_order', { order_id: orderId, new_price: newPrice }).then(
        (resp: unknown) => {
          const data = resp as { order_id: string; old_price: number; new_price: number; listing_fee?: number; message: string } | undefined
          if (data?.message) {
            setModifyResult((prev) => ({
              ...prev,
              [orderId]: { message: data.message, listing_fee: data.listing_fee },
            }))
          }
          setEditingOrderId(null)
          setEditPrice('')
        }
      )
    },
    [sendCommand, editPrice]
  )

  if (!isDocked) {
    return (
      <div className={shared.dockedOnly}>
        Dock at a base to manage your orders
      </div>
    )
  }

  const personalOrders = (ordersData?.orders || []).filter((o) => !o.faction_order)
  const factionOrders = (ordersData?.orders || []).filter((o) => o.faction_order)

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  const maxQty = orderType === 'sell'
    ? (inventoryItems.find(i => i.item_id === orderItemId)?.quantity ?? 0)
    : undefined

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          <ClipboardList size={12} />
          Your Orders ({personalOrders.length})
        </span>
        <div className={styles.toolbarActions}>
          <button
            className={shared.actionBtn}
            onClick={() => setShowForm(!showForm)}
            title="Create new order"
            type="button"
          >
            <Plus size={13} />
            New
          </button>
          <button
            className={shared.refreshBtn}
            onClick={handleRefresh}
            title="Refresh orders"
            type="button"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* New order form */}
      {showForm && (
        <div className={styles.formContainer}>
          <div className={styles.formTitle}>Create Order</div>
          <div className={styles.typeToggle}>
            <button
              className={`${styles.typeBtn} ${orderType === 'sell' ? styles.typeBtnActiveSell : ''}`}
              onClick={() => handleTypeChange('sell')}
              type="button"
            >
              Sell
            </button>
            <button
              className={`${styles.typeBtn} ${orderType === 'buy' ? styles.typeBtnActiveBuy : ''}`}
              onClick={() => handleTypeChange('buy')}
              type="button"
            >
              Buy
            </button>
          </div>

          {/* Item selection */}
          <div className={styles.formFieldStack}>
            <label className={styles.formLabel}>Item</label>
            {orderType === 'sell' ? (
              <SellDropdown
                items={inventoryItems}
                value={orderItemId}
                onChange={handleSellItemChange}
              />
            ) : (
              <BuyAutocomplete
                value={orderItemId}
                onChange={handleBuyItemChange}
              />
            )}
          </div>

          {/* Qty + Price side by side */}
          <div className={styles.formRow}>
            <div className={styles.formFieldStack}>
              <label className={styles.formLabel}>
                Quantity
                {orderType === 'sell' && maxQty != null && maxQty > 0 && (
                  <span className={styles.formHint}> (have {maxQty})</span>
                )}
              </label>
              <input
                className={styles.formInput}
                type="number"
                placeholder={orderType === 'sell' ? 'Max' : 'Quantity'}
                min={1}
                max={maxQty}
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
              />
            </div>
            <div className={styles.formFieldStack}>
              <label className={styles.formLabel}>
                Price each
                {orderItemId && (
                  <span className={styles.formHint}> (base: {getItem(orderItemId)?.base_value?.toLocaleString() ?? '?'})</span>
                )}
              </label>
              <input
                className={styles.formInput}
                type="number"
                placeholder="Credits"
                min={1}
                value={orderPrice}
                onChange={(e) => setOrderPrice(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              className={shared.subtleBtn}
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={orderType === 'sell' ? shared.warningBtn : shared.actionBtn}
              onClick={handleCreateOrder}
              disabled={
                !orderItemId.trim() ||
                !orderQty ||
                parseInt(orderQty, 10) < 1 ||
                !orderPrice ||
                parseInt(orderPrice, 10) < 1
              }
              type="button"
            >
              <Plus size={11} />
              {orderType === 'sell' ? 'Create Sell Order' : 'Create Buy Order'}
            </button>
          </div>
        </div>
      )}

      {/* Personal orders list */}
      {!ordersData ? (
        <div className={styles.loading}>Loading orders...</div>
      ) : personalOrders.length === 0 ? (
        <div className={shared.emptyState}>No active orders</div>
      ) : (
        <div className={styles.orderList}>
          {personalOrders.map((order) => {
            const isEditing = editingOrderId === order.order_id
            const result = modifyResult[order.order_id]
            return (
              <div key={order.order_id} className={styles.orderCard}>
                <div className={styles.orderTop}>
                  <span
                    className={`${styles.orderTypeBadge} ${
                      order.order_type === 'sell' ? styles.badgeSell : styles.badgeBuy
                    }`}
                  >
                    {order.order_type.toUpperCase()}
                  </span>
                  <span className={styles.orderItemName}>{order.item_name}</span>
                  <button
                    className={shared.iconBtn}
                    onClick={() => handleStartModify(order.order_id, order.price_each)}
                    title="Modify price"
                    type="button"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className={shared.dangerBtn}
                    onClick={() => handleCancelOrder(order.order_id)}
                    title="Cancel order"
                    type="button"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className={styles.orderDetails}>
                  <span className={styles.orderDetail}>
                    Qty: {order.remaining}/{order.quantity}
                  </span>
                  {isEditing ? (
                    <span className={styles.modifyInline}>
                      <span className={styles.modifyLabel}>Price:</span>
                      <input
                        className={styles.modifyInput}
                        type="number"
                        min={1}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSubmitModify(order.order_id)
                          if (e.key === 'Escape') handleCancelModify()
                        }}
                        autoFocus
                      />
                      <button
                        className={shared.confirmBtn}
                        onClick={() => handleSubmitModify(order.order_id)}
                        disabled={!editPrice || parseInt(editPrice, 10) < 1}
                        title="Save new price"
                        type="button"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        className={shared.dangerBtn}
                        onClick={handleCancelModify}
                        title="Cancel editing"
                        type="button"
                      >
                        <X size={11} />
                      </button>
                      {order.order_type === 'sell' && parseInt(editPrice, 10) > order.price_each && (
                        <span className={styles.modifyFeeNote}>
                          1% fee on price increase
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className={styles.orderDetail}>
                      Price: <Credits amount={order.price_each} />
                    </span>
                  )}
                  {order.listing_fee > 0 && (
                    <span className={styles.orderDetailDim}>
                      Fee: <Credits amount={order.listing_fee} />
                    </span>
                  )}
                </div>
                {result && (
                  <div className={styles.modifyResult}>
                    <span className={styles.modifyMessage}>{result.message}</span>
                    {result.listing_fee != null && result.listing_fee > 0 && (
                      <span className={styles.modifyFeeWarning}>
                        Listing fee: <Credits amount={result.listing_fee} />
                      </span>
                    )}
                  </div>
                )}
                <div className={styles.orderMeta}>
                  {formatDate(order.created_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Faction orders */}
      {factionOrders.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.sectionLabel}>
            <Users size={12} />
            Faction Orders ({factionOrders.length})
          </div>
          <div className={styles.orderList}>
            {factionOrders.map((order) => (
              <div key={order.order_id} className={`${styles.orderCard} ${styles.factionCard}`}>
                <div className={styles.orderTop}>
                  <span
                    className={`${styles.orderTypeBadge} ${
                      order.order_type === 'sell' ? styles.badgeSell : styles.badgeBuy
                    }`}
                  >
                    {order.order_type.toUpperCase()}
                  </span>
                  <span className={styles.orderItemName}>{order.item_name}</span>
                  {order.created_by && (
                    <span className={styles.createdBy}>by {order.created_by}</span>
                  )}
                </div>
                <div className={styles.orderDetails}>
                  <span className={styles.orderDetail}>
                    Qty: {order.remaining}/{order.quantity}
                  </span>
                  <span className={styles.orderDetail}>
                    Price: <Credits amount={order.price_each} />
                  </span>
                </div>
                <div className={styles.orderMeta}>
                  {formatDate(order.created_at)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
