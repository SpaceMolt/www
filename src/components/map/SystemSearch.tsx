'use client'

// System search for Recon, modelled on the one the public galaxy map has always
// had. Recon shipped without it, which made Recon strictly worse than the public
// map at the single thing people do most: find a system by name.
//
// Search covers every system in the galaxy, not just the ones a fleet has
// explored. System names and positions are public — they are on the public map —
// so scoping this to explored systems would hide nothing and only make the
// control useless for the systems an operator most wants to look up. Fog of war
// still governs what the *detail* shows once you get there.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import styles from './SystemSearch.module.css'

export interface SearchableSystem {
  id: string
  name: string
}

/** Case-insensitive subsequence match: "srs" finds "Sirius". */
export function matchesSystemQuery(name: string, query: string): boolean {
  const n = name.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let ni = 0; ni < n.length && qi < q.length; ni++) {
    if (n[ni] === q[qi]) qi++
  }
  return qi === q.length
}

const MAX_RESULTS = 10

interface SystemSearchProps<T extends SearchableSystem> {
  systems: T[]
  onSelect: (system: T) => void
  /** Optional trailing note per row — e.g. "3 online". */
  renderMeta?: (system: T) => string | null
  className?: string
  placeholder?: string
}

export function SystemSearch<T extends SearchableSystem>({
  systems,
  onSelect,
  renderMeta,
  className,
  placeholder = 'Search systems...',
}: SystemSearchProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    if (!query) return []
    return systems.filter((s) => matchesSystemQuery(s.name, query)).slice(0, MAX_RESULTS)
  }, [systems, query])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Click outside closes.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const select = useCallback(
    (system: T) => {
      onSelect(system)
      setOpen(false)
      setQuery('')
    },
    [onSelect],
  )

  return (
    <div ref={containerRef} className={`${styles.container} ${className ?? ''}`}>
      {open && (
        <div className={styles.dropdown}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              // Enter takes the top hit — the whole point is speed.
              if (e.key === 'Enter' && results.length > 0) select(results[0])
            }}
            aria-label="Search systems"
          />
          {query && (
            <div className={styles.results}>
              {results.length === 0 ? (
                <div className={styles.empty}>No systems match</div>
              ) : (
                results.map((system) => {
                  const meta = renderMeta?.(system)
                  return (
                    <button
                      key={system.id}
                      className={styles.result}
                      onClick={() => select(system)}
                    >
                      <span className={styles.resultName}>{system.name}</span>
                      {meta && <span className={styles.resultMeta}>{meta}</span>}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close system search' : 'Search systems'}
        aria-expanded={open}
      >
        {open ? <X size={16} /> : <Search size={16} />}
      </button>
    </div>
  )
}
