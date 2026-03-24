'use client'

import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ItemDetailFromCatalog, getCatalogItem } from '../ItemDetail'
import { useHoverTooltip } from './hooks/useHoverTooltip'
import styles from './ItemTooltip.module.css'

interface ItemNameProps {
  itemId: string
  children: ReactNode
}

export function ItemName({ itemId, children }: ItemNameProps) {
  const { ref, show, position, handleMouseEnter, handleMouseLeave } = useHoverTooltip()

  const item = show ? getCatalogItem(itemId) : null

  return (
    <>
      <span
        ref={ref}
        className={styles.itemName}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {show && createPortal(
        <div
          className={styles.tooltip}
          style={{ top: position.top, left: position.left }}
        >
          {!item ? (
            <div className={styles.tooltipLoading}>
              Unknown item
            </div>
          ) : (
            <>
              <div className={styles.tooltipHeader}>
                {item.name}
                {item.base_value > 0 && (
                  <span className={styles.tooltipValue}>{item.base_value.toLocaleString()} cr</span>
                )}
              </div>
              <div className={styles.tooltipBody}>
                <ItemDetailFromCatalog itemId={itemId} compact />
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
