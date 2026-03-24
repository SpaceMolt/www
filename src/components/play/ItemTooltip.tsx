'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { useItemCatalog } from './ItemCatalogContext'
import { ItemDetailContent } from '../ItemDetail'
import type { CatalogItem } from '../ItemDetail'
import styles from './ItemTooltip.module.css'

const HOVER_DELAY = 200
const TOOLTIP_WIDTH = 320
const TOOLTIP_MARGIN = 8

interface ItemNameProps {
  itemId: string
  children: ReactNode
}

export function ItemName({ itemId, children }: ItemNameProps) {
  const { getItem, fetchItem } = useItemCatalog()
  const [show, setShow] = useState(false)
  const [item, setItem] = useState<CatalogItem | undefined>(() => getItem(itemId))
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spanRef = useRef<HTMLSpanElement>(null)

  const computePosition = useCallback(() => {
    if (!spanRef.current) return
    const rect = spanRef.current.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let left = rect.left
    let top = rect.bottom + TOOLTIP_MARGIN

    // Flip left if near right edge
    if (left + TOOLTIP_WIDTH > viewportW - TOOLTIP_MARGIN) {
      left = Math.max(TOOLTIP_MARGIN, viewportW - TOOLTIP_WIDTH - TOOLTIP_MARGIN)
    }

    // Flip up if near bottom edge (estimate max tooltip height)
    if (top + 200 > viewportH) {
      top = Math.max(TOOLTIP_MARGIN, rect.top - 200 - TOOLTIP_MARGIN)
    }

    setPosition({ top, left })
  }, [])

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(async () => {
      computePosition()
      setShow(true)

      // Check cache first
      const cached = getItem(itemId)
      if (cached) {
        setItem(cached)
        return
      }

      setLoading(true)
      const fetched = await fetchItem(itemId)
      setItem(fetched)
      setLoading(false)
    }, HOVER_DELAY)
  }, [itemId, getItem, fetchItem, computePosition])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
    setShow(false)
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    }
  }, [])

  // Close tooltip on scroll
  useEffect(() => {
    if (!show) return
    const handleScroll = () => setShow(false)
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [show])

  return (
    <>
      <span
        ref={spanRef}
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
          {loading || !item ? (
            <div className={styles.tooltipLoading}>
              <Loader2 size={14} className="animate-spin" />
              Loading...
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
                <ItemDetailContent item={item} compact />
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
