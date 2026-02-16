'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardList,
  RefreshCw,
  X,
  Plus,
  Users,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import type { OrderEntry } from '../../types'
import styles from './OrdersView.module.css'

export function OrdersView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const ordersData = state.ordersData

  // New order form state
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('sell')
  const [orderItemId, setOrderItemId] = useState('')
  const [orderQty, setOrderQty] = useState('')
  const [orderPrice, setOrderPrice] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Auto-fetch orders when docked and data is null
  useEffect(() => {
    if (isDocked && !ordersData) {
      sendCommand('view_orders')
    }
  }, [isDocked, ordersData, sendCommand])

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

  if (!isDocked) {
    return (
      <div className={styles.dockedOnly}>
        Dock at a base to manage your orders
      </div>
    )
  }

  const personalOrders = ordersData?.orders || []
  const factionOrders = ordersData?.faction_orders || []

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          <ClipboardList size={12} />
          Your Orders ({personalOrders.length})
        </span>
        <div className={styles.toolbarActions}>
          <button
            className={styles.newOrderBtn}
            onClick={() => setShowForm(!showForm)}
            title="Create new order"
            type="button"
          >
            <Plus size={13} />
            New
          </button>
          <button
            className={styles.refreshBtn}
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
              onClick={() => setOrderType('sell')}
              type="button"
            >
              Sell
            </button>
            <button
              className={`${styles.typeBtn} ${orderType === 'buy' ? styles.typeBtnActiveBuy : ''}`}
              onClick={() => setOrderType('buy')}
              type="button"
            >
              Buy
            </button>
          </div>
          <div className={styles.formFields}>
            <input
              className={styles.formInput}
              type="text"
              placeholder="Item ID"
              value={orderItemId}
              onChange={(e) => setOrderItemId(e.target.value)}
            />
            <input
              className={styles.formInput}
              type="number"
              placeholder="Quantity"
              min={1}
              value={orderQty}
              onChange={(e) => setOrderQty(e.target.value)}
            />
            <input
              className={styles.formInput}
              type="number"
              placeholder="Price each"
              min={1}
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.cancelFormBtn}
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={orderType === 'sell' ? styles.submitSellBtn : styles.submitBuyBtn}
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
        <div className={styles.emptyState}>No active orders</div>
      ) : (
        <div className={styles.orderList}>
          {personalOrders.map((order: OrderEntry) => (
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
                  className={styles.cancelBtn}
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
                <span className={styles.orderDetail}>
                  Price: {order.price_each.toLocaleString()} cr
                </span>
                {order.listing_fee > 0 && (
                  <span className={styles.orderDetailDim}>
                    Fee: {order.listing_fee.toLocaleString()} cr
                  </span>
                )}
              </div>
              <div className={styles.orderMeta}>
                {formatDate(order.created_at)}
              </div>
            </div>
          ))}
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
            {factionOrders.map((order: OrderEntry) => (
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
                    Price: {order.price_each.toLocaleString()} cr
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
