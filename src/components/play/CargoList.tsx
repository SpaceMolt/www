'use client'

import { Package, Archive } from 'lucide-react'
import { useCargo } from '@/lib/spacemolt'
import { ItemName } from './ItemTooltip'
import styles from './CargoList.module.css'

interface CargoListProps {
  compact?: boolean
}

export function CargoList({ compact = false }: CargoListProps) {
  const cargo = useCargo() ?? []

  if (cargo.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Archive size={14} />
          </span>
          Cargo hold empty
        </div>
      </div>
    )
  }

  const iconSize = compact ? 12 : 14

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      {cargo.map((item, index) => {
        const itemId = item.item_id ?? `cargo-${index}`
        const quantity = item.quantity ?? 0
        const size = item.size ?? 0
        return (
          <div key={itemId} className={styles.item}>
            <span className={styles.itemIcon}>
              <Package size={iconSize} />
            </span>
            <span className={styles.itemName}>
              <ItemName itemId={itemId}>{item.item_name || itemId}</ItemName>
            </span>
            <span className={styles.itemQuantity}>
              x{quantity}
            </span>
            <span className={styles.itemSize}>
              {size * quantity}m3
            </span>
          </div>
        )
      })}
    </div>
  )
}
