'use client'

import type { ReactNode } from 'react'
import { ItemName } from '../ItemTooltip'
import { QtyButtons } from './QtyButtons'
import { selectAll, selectedItems, type SelectableItem, type Selection } from './itemSelection'
import styles from './ItemSelectList.module.css'

interface ItemSelectListProps {
  items: SelectableItem[]
  selection: Selection
  onChange: (selection: Selection) => void
  /** Hide the checkboxes (for example, a read-only remote view). */
  readOnly?: boolean
  empty?: string
  /** Extra per-row content, such as a module compatibility badge. */
  renderExtra?: (item: SelectableItem) => ReactNode
  /** Bulk action buttons, shown under the list. */
  actions?: ReactNode
}

/**
 * One list for cargo, personal storage and faction storage: a checkbox per row, select all / clear,
 * and a quantity per checked row that starts at the full stack.
 */
export function ItemSelectList({ items, selection, onChange, readOnly, empty = 'Nothing here', renderExtra, actions }: ItemSelectListProps) {
  if (items.length === 0) return <div className={styles.empty}>{empty}</div>
  const checkedCount = items.filter((item) => item.item_id in selection).length
  const validCount = selectedItems(items, selection).length
  const allChecked = checkedCount === items.length

  const toggle = (item: SelectableItem, checked: boolean) => {
    const { [item.item_id]: _, ...rest } = selection
    onChange(checked ? { ...rest, [item.item_id]: String(item.quantity) } : rest)
  }
  const setQty = (item: SelectableItem, qty: string) => onChange({ ...selection, [item.item_id]: qty })

  return (
    <div className={styles.list}>
      {!readOnly && (
        <label className={styles.header}>
          <input
            type="checkbox"
            className={styles.check}
            checked={allChecked}
            onChange={(e) => onChange(e.target.checked ? selectAll(items) : {})}
          />
          <span>{checkedCount > 0 ? `${checkedCount} selected` : 'Select all'}</span>
          {checkedCount > validCount && <span className={styles.warn}>{checkedCount - validCount} with a bad quantity</span>}
        </label>
      )}
      {items.map((item) => {
        const checked = item.item_id in selection
        return (
          <div key={item.item_id} className={styles.row}>
            <label className={styles.info}>
              {!readOnly && (
                <input type="checkbox" className={styles.check} checked={checked} onChange={(e) => toggle(item, e.target.checked)} />
              )}
              <span className={styles.name}><ItemName itemId={item.item_id}>{item.name ?? item.item_id}</ItemName></span>
              <span className={styles.meta}>x{item.quantity}</span>
              {item.size != null && item.size > 0 && <span className={styles.meta}>{item.size * item.quantity}u</span>}
            </label>
            {renderExtra?.(item)}
            {checked && (
              <span className={styles.qty}>
                <input
                  className={styles.qtyInput}
                  type="number"
                  min={1}
                  max={item.quantity}
                  value={selection[item.item_id]}
                  onChange={(e) => setQty(item, e.target.value)}
                  aria-label={`Quantity of ${item.name ?? item.item_id}`}
                />
                <QtyButtons max={item.quantity} current={selection[item.item_id]} onChange={(v) => setQty(item, v)} />
              </span>
            )}
          </div>
        )
      })}
      {!readOnly && actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
