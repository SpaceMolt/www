'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import styles from './ItemSelector.module.css'

interface SelectableItem {
  id: string
  name: string
  quantity?: number
}

interface ItemSelectorProps {
  items: SelectableItem[]
  onSelect: (id: string) => void
  placeholder?: string
}

export function ItemSelector({
  items,
  onSelect,
  placeholder = 'Select item...',
}: ItemSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? items.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase())
      )
    : items

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id)
      setOpen(false)
      setSearch('')
    },
    [onSelect]
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search input on open
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      } else if (e.key === 'Enter' && filtered.length === 1) {
        handleSelect(filtered[0].id)
      }
    },
    [filtered, handleSelect]
  )

  const triggerClass = `${styles.trigger} ${open ? styles.triggerOpen : ''}`
  const iconClass = `${styles.triggerIcon} ${open ? styles.triggerIconOpen : ''}`

  return (
    <div className={styles.container} ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen(!open)}
      >
        <span className={`${styles.triggerText} ${styles.placeholder}`}>
          {placeholder}
        </span>
        <span className={iconClass}>
          <ChevronDown size={14} />
        </span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <Search size={12} />
            </span>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.options}>
            {filtered.length === 0 ? (
              <div className={styles.noResults}>No matching items</div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className={styles.option}
                  onClick={() => handleSelect(item.id)}
                >
                  <span className={styles.optionName}>{item.name}</span>
                  {item.quantity !== undefined && (
                    <span className={styles.optionQty}>x{item.quantity}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
