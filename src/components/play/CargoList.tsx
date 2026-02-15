'use client'

import { Package, Archive } from 'lucide-react'
import styles from './CargoList.module.css'

interface CargoListItem {
  item_id: string
  name: string
  quantity: number
  size: number
}

interface CargoListProps {
  items: CargoListItem[]
  compact?: boolean
}

export function CargoList({ items, compact = false }: CargoListProps) {
  if (items.length === 0) {
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
      {items.map((item) => (
        <div key={item.item_id} className={styles.item}>
          <span className={styles.itemIcon}>
            <Package size={iconSize} />
          </span>
          <span className={styles.itemName} title={item.name}>
            {item.name}
          </span>
          <span className={styles.itemQuantity}>
            x{item.quantity}
          </span>
          <span className={styles.itemSize}>
            {item.size * item.quantity}m3
          </span>
        </div>
      ))}
    </div>
  )
}
