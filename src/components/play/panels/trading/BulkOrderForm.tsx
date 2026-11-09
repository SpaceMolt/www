'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useCommandMutation, useCommandQuery, usePlayer } from '@/lib/spacemolt'
import type { MutationResult, StorageResponse } from '@spacemolt/lib'
import { getItem, tradeableItems, formatItemId } from '@/data/catalog'
import type { RawCatalogItem } from '@/data/catalog'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useFactionPermissions, useStationServices } from '../../hooks/useGates'
import { useFactionServices } from '../faction/useFactionService'
import { usePlay } from '../../PlayProvider'
import { ConfirmAction, QtyButtons, errorMessage, shared } from '../../shared'
import { chunk } from '../../shared/itemSelection'
import { BULK_ORDER_LIMIT, sumBulk } from './tradingLogic'
import styles from './OrdersView.module.css'

type FactionStorageView = Extract<StorageResponse, { hint: string; faction_id: string }>

export interface InventoryRow {
  item_id: string
  name: string
  quantity: number
}

interface Draft { qty: string; price: string }

// ── Buy Item Autocomplete ───────────────────────────────────────────────

export function BuyAutocomplete({ onSelect, placeholder = 'Add any item to buy...' }: { onSelect: (item: RawCatalogItem) => void; placeholder?: string }) {
  const [inputText, setInputText] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    if (inputText.length < 2) return []
    const q = inputText.toLowerCase()
    return tradeableItems()
      .filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
  }, [inputText])

  const handleClose = useCallback(() => setOpen(false), [])
  useClickOutside(ref, open, handleClose)

  return (
    <div className={styles.autocomplete} ref={ref}>
      <div className={styles.autocompleteInputWrap}>
        <Search size={11} />
        <input
          className={styles.autocompleteInput}
          type="text"
          placeholder={placeholder}
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setOpen(e.target.value.length >= 2) }}
          onFocus={() => { if (inputText.length >= 2) setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-autocomplete="list"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className={styles.autocompletePanel} role="listbox">
          {suggestions.map(item => (
            <button
              key={item.id}
              className={styles.dropdownItem}
              onClick={() => { onSelect(item); setInputText(''); setOpen(false) }}
              type="button"
              role="option"
              aria-selected={false}
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

// ── Bulk order form ─────────────────────────────────────────────────────

/**
 * Create many sell or buy orders in one go (orders[], chunked to the server's 50 per call).
 * Faction members can place them for the faction: sells draw from faction storage (or a bucket),
 * buys spend the treasury, and "private" restricts them to the Company Store.
 */
export function BulkOrderForm({ inventory, onCreated, onClose }: {
  inventory: InventoryRow[]
  onCreated: () => void
  onClose: () => void
}) {
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const credits = player?.credits ?? 0
  const hasStorage = useStationServices().includes('storage')
  const factionServices = useFactionServices()
  const hasFactionMarket = factionServices?.has('faction_market')
  const hasCompanyStore = factionServices?.has('faction_company_store')
  const { can } = useFactionPermissions({ enabled: Boolean(hasFactionMarket) })
  const canTradeForFaction = Boolean(hasFactionMarket) && hasStorage && can('manage_treasury')

  const [side, setSide] = useState<'sell' | 'buy'>('sell')
  const [asFaction, setAsFaction] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [bucket, setBucket] = useState('')
  const [toStorage, setToStorage] = useState(false)
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [extra, setExtra] = useState<InventoryRow[]>([])
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: factionStorage } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view({ target: 'faction' })).structuredContent as FactionStorageView | undefined,
    [],
    { enabled: asFaction },
  )
  const buckets = factionStorage?.buckets ?? []

  useEffect(() => { setDrafts({}) }, [side, asFaction, bucket])

  const rows = useMemo(() => {
    const factionItems = bucket ? buckets.find((b) => b.id === bucket)?.items : factionStorage?.items
    const source: InventoryRow[] = side === 'sell' && asFaction
      ? (factionItems ?? []).map((i) => ({ item_id: i.item_id, name: i.name ?? getItem(i.item_id)?.name ?? formatItemId(i.item_id), quantity: i.quantity }))
      : inventory
    const all = side === 'buy' ? [...extra.filter((e) => !source.some((s) => s.item_id === e.item_id)), ...source] : source
    const q = search.toLowerCase().trim()
    return q ? all.filter((r) => r.name.toLowerCase().includes(q) || r.item_id.includes(q)) : all
  }, [side, asFaction, bucket, buckets, factionStorage, inventory, extra, search])

  const toggle = (row: InventoryRow) => setDrafts((prev) => {
    if (prev[row.item_id]) {
      const { [row.item_id]: _removed, ...rest } = prev
      return rest
    }
    const base = getItem(row.item_id)?.base_value ?? 0
    return { ...prev, [row.item_id]: { qty: side === 'sell' ? String(row.quantity) : '', price: base > 0 ? String(base) : '' } }
  })
  const setDraft = (id: string, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const orders = Object.entries(drafts)
    .map(([item_id, d]) => ({ item_id, quantity: parseInt(d.qty, 10) || 0, price_each: parseInt(d.price, 10) || 0 }))
    .filter((o) => o.quantity > 0 && o.price_each > 0)
  const total = orders.reduce((sum, o) => sum + o.quantity * o.price_each, 0)
  const invalid = Object.keys(drafts).length - orders.length

  const submit = async () => {
    setConfirming(false)
    setSubmitting(true)
    const details: unknown[] = []
    try {
      for (const batch of chunk(orders, BULK_ORDER_LIMIT)) {
        const factionBatch = batch.map((o) => ({ ...o, private: isPrivate || undefined, bucket: bucket || undefined }))
        const result = await mutate((c): Promise<MutationResult> => {
          if (asFaction) {
            return side === 'sell'
              ? c.spacemolt_faction_commerce.create_sell_order({ orders: factionBatch })
              : c.spacemolt_faction_commerce.create_buy_order({ orders: factionBatch })
          }
          return side === 'sell'
            ? c.spacemolt_market.create_sell_order({ orders: batch })
            : c.spacemolt_market.create_buy_order({ orders: batch.map((o) => ({ ...o, deliver_to: toStorage ? 'storage' as const : 'cargo' as const })) })
        }, { label: side === 'sell' ? 'create_sell_order' : 'create_buy_order' })
        details.push(result.delta.details)
        // Drop placed orders from the form so a retry cannot place them twice.
        const results = (result.delta.details as { results?: Array<{ index: number; success: boolean }> } | undefined)?.results
        const placed = results ? results.filter((r) => r.success).map((r) => batch[r.index]?.item_id) : batch.map((o) => o.item_id)
        setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !placed.includes(id))))
      }
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    }
    setSubmitting(false)
    if (details.length === 0) return
    const { failed, text } = sumBulk(`${side === 'sell' ? 'Sell' : 'Buy'} orders created:`, details)
    uiStore.dispatch({ type: 'toast', kind: failed > 0 ? 'warning' : 'success', text })
    onCreated()
    if (failed === 0) onClose()
  }

  const confirmText = side === 'sell'
    ? `List ${orders.length} sell order${orders.length === 1 ? '' : 's'} worth ${total.toLocaleString()} cr${asFaction ? ' for your faction' : ''}?`
    : `Place ${orders.length} buy order${orders.length === 1 ? '' : 's'} and escrow ${total.toLocaleString()} cr${asFaction ? ' from the faction treasury' : ''}?`

  return (
    <div className={styles.formContainer}>
      <div className={styles.formTitle}>Create Orders</div>
      <div className={styles.typeToggle}>
        <button className={`${styles.typeBtn} ${side === 'sell' ? styles.typeBtnActiveSell : ''}`} onClick={() => setSide('sell')} type="button">Sell</button>
        <button className={`${styles.typeBtn} ${side === 'buy' ? styles.typeBtnActiveBuy : ''}`} onClick={() => setSide('buy')} type="button">Buy</button>
      </div>

      <div className={styles.optionRow}>
        {canTradeForFaction && (
          <label><input type="checkbox" checked={asFaction} onChange={(e) => { setAsFaction(e.target.checked); setBucket('') }} /> For my faction</label>
        )}
        {asFaction && hasCompanyStore && (
          <label title="Only faction members see these orders">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Company Store only
          </label>
        )}
        {asFaction && buckets.length > 0 && (
          <select className={styles.formInput} value={bucket} onChange={(e) => setBucket(e.target.value)} title="Faction storage bucket">
            <option value="">Main faction storage</option>
            {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {side === 'buy' && !asFaction && hasStorage && (
          <label><input type="checkbox" checked={toStorage} onChange={(e) => setToStorage(e.target.checked)} /> Deliver to storage</label>
        )}
      </div>

      <div className={styles.formRow}>
        <div className={styles.autocompleteInputWrap}>
          <Search size={11} />
          <input className={styles.autocompleteInput} type="text" placeholder="Filter items..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {side === 'buy' && (
          <BuyAutocomplete onSelect={(item) => {
            const row = { item_id: item.id, name: item.name, quantity: 0 }
            setExtra((prev) => prev.some((p) => p.item_id === row.item_id) ? prev : [row, ...prev])
            if (!drafts[row.item_id]) toggle(row)
          }} />
        )}
      </div>

      <div className={styles.bulkList}>
        {rows.length === 0 ? (
          <div className={shared.emptyState}>{side === 'sell' ? 'Nothing to sell here.' : 'Add an item to buy.'}</div>
        ) : rows.map((row) => {
          const draft = drafts[row.item_id]
          const price = parseInt(draft?.price ?? '', 10) || 0
          const max = side === 'sell' ? row.quantity : price > 0 ? Math.floor(credits / price) : 0
          return (
            <div key={row.item_id} className={styles.bulkRow}>
              <label className={styles.bulkName}>
                <input type="checkbox" checked={Boolean(draft)} onChange={() => toggle(row)} />
                {row.name}
                {row.quantity > 0 && <span className={styles.formHint}> ({row.quantity})</span>}
              </label>
              {draft && (
                <>
                  <input className={styles.modifyInput} type="number" min={1} placeholder="Qty" value={draft.qty}
                    onChange={(e) => setDraft(row.item_id, { qty: e.target.value })} />
                  <QtyButtons max={max} current={draft.qty} onChange={(qty) => setDraft(row.item_id, { qty })} />
                  <input className={styles.modifyInput} type="number" min={1} placeholder="Price" value={draft.price}
                    onChange={(e) => setDraft(row.item_id, { price: e.target.value })} title="Price each" />
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.formHint}>
        {orders.length} order{orders.length === 1 ? '' : 's'}, {total.toLocaleString()} cr total
        {invalid > 0 && ` (${invalid} selected without a quantity and price)`}
      </div>

      {confirming ? (
        <ConfirmAction message={confirmText} variant={side === 'sell' ? 'accent' : 'confirm'} onConfirm={submit} onCancel={() => setConfirming(false)} />
      ) : (
        <div className={styles.formActions}>
          <button className={shared.subtleBtn} onClick={onClose} type="button"><X size={11} /> Close</button>
          <button
            className={side === 'sell' ? shared.warningBtn : shared.actionBtn}
            onClick={() => setConfirming(true)}
            disabled={orders.length === 0 || submitting}
            type="button"
          >
            <Plus size={11} />
            {side === 'sell' ? 'Create Sell Orders' : 'Create Buy Orders'}
          </button>
        </div>
      )}
    </div>
  )
}
