'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import styles from './codex.module.css'

/*
 * Shared filter/sort table for every /codex/* section.
 *
 * The page that uses this is a SERVER component: it projects its entries down to
 * plain rows (only the columns the table shows) and hands them over. Nothing here
 * imports the catalog — keeping the 1.2 MB catalog.json out of the client bundle
 * depends on that staying true. Rows must be primitives only: functions (a
 * `render` callback, a `hrefFor` closure) cannot cross the RSC boundary, which is
 * why a row carries its own precomputed `href` and columns are pure data.
 */

/** Cell values must be serializable primitives. */
export type CatalogCell = string | number | undefined

export interface CatalogRow {
  id: string
  /** Rendered in the `name`-variant column, linked to `href`. */
  name: string
  href: string
  [key: string]: CatalogCell
}

export interface CatalogColumn {
  /** Key into the row. */
  key: string
  label: string
  /** Tooltip on the header cell. */
  title?: string
  /** Right-align + numeric sort. */
  numeric?: boolean
  /**
   * name    — the row's linked name cell (crawlable <Link>)
   * badge   — a neutral chip
   * rarity  — a chip coloured by rarity value
   * credits — thousands-separated number
   * text    — plain text (default)
   */
  variant?: 'name' | 'badge' | 'rarity' | 'credits' | 'text'
}

/** A multi-select filter over the distinct values of one column. */
export interface CatalogFacet {
  key: string
  label: string
}

interface CatalogTableProps {
  rows: CatalogRow[]
  columns: CatalogColumn[]
  facets?: CatalogFacet[]
  /** Row keys the search box matches against. Defaults to name + id. */
  searchKeys?: string[]
  searchPlaceholder?: string
  /** Column key to sort by initially. Defaults to the first column. */
  initialSort?: string
  initialDir?: 'asc' | 'desc'
  /** Plural noun for the result count, e.g. "items". */
  noun?: string
}

const RARITY_CLASSES: Record<string, string> = {
  common: styles.rarityCommon,
  uncommon: styles.rarityUncommon,
  rare: styles.rarityRare,
  exotic: styles.rarityExotic,
  legendary: styles.rarityLegendary,
}

function compare(a: CatalogCell, b: CatalogCell, numeric: boolean): number {
  if (numeric) {
    const an = typeof a === 'number' ? a : Number.NEGATIVE_INFINITY
    const bn = typeof b === 'number' ? b : Number.NEGATIVE_INFINITY
    return an - bn
  }
  return String(a ?? '').localeCompare(String(b ?? ''))
}

function Cell({ row, col }: { row: CatalogRow; col: CatalogColumn }) {
  const value = row[col.key]

  if (col.variant === 'name') {
    return (
      <Link href={row.href} className={styles.nameLink}>
        {row.name}
      </Link>
    )
  }
  if (value == null || value === '') return <span aria-hidden>—</span>
  if (col.variant === 'credits') {
    return <>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</>
  }
  if (col.variant === 'rarity') {
    const key = String(value).toLowerCase()
    return <span className={`${styles.badge} ${RARITY_CLASSES[key] ?? ''}`}>{value}</span>
  }
  if (col.variant === 'badge') {
    return <span className={styles.badge}>{value}</span>
  }
  return <>{value}</>
}

export function CatalogTable({
  rows,
  columns,
  facets = [],
  searchKeys,
  searchPlaceholder = 'Search…',
  initialSort,
  initialDir = 'asc',
  noun = 'entries',
}: CatalogTableProps) {
  const [sortCol, setSortCol] = useState(initialSort ?? columns[0]?.key ?? 'name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialDir)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, string[]>>({})

  const numericByKey = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const c of columns) map[c.key] = Boolean(c.numeric)
    return map
  }, [columns])

  /** Distinct values per facet, derived from the rows themselves. */
  const facetOptions = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const facet of facets) {
      const seen = new Set<string>()
      for (const row of rows) {
        const v = row[facet.key]
        if (v != null && v !== '') seen.add(String(v))
      }
      out[facet.key] = [...seen].sort()
    }
    return out
  }, [rows, facets])

  const keys = useMemo(() => searchKeys ?? ['name', 'id'], [searchKeys])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()

    const filtered = rows.filter((row) => {
      for (const [key, values] of Object.entries(selected)) {
        if (values.length === 0) continue
        if (!values.includes(String(row[key] ?? ''))) return false
      }
      if (!q) return true
      return keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    })

    const numeric = numericByKey[sortCol] ?? false
    return filtered.sort((a, b) => {
      const cmp = compare(a[sortCol], b[sortCol], numeric)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, selected, search, keys, sortCol, sortDir, numericByKey])

  const hasFilters = search.trim() !== '' || Object.values(selected).some((v) => v.length > 0)

  function toggleFacet(key: string, value: string) {
    setSelected((prev) => {
      const current = prev[key] ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  function handleSort(col: CatalogColumn) {
    if (sortCol === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col.key)
      setSortDir(col.numeric ? 'desc' : 'asc')
    }
  }

  return (
    <>
      <div className={`console-panel ${styles.filterBar}`}>
        {facets.map((facet) => (
          <div key={facet.key} className={styles.facet}>
            <span className={styles.facetLabel}>{facet.label}</span>
            {(facetOptions[facet.key] ?? []).map((option) => {
              const active = (selected[facet.key] ?? []).includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleFacet(facet.key, option)}
                >
                  {option}
                </button>
              )
            })}
          </div>
        ))}

        <input
          type="search"
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={searchPlaceholder}
        />

        <div className={styles.barRight}>
          <span className={styles.resultCount}>
            {visible.length.toLocaleString('en-US')} / {rows.length.toLocaleString('en-US')} {noun}
          </span>
          <button
            type="button"
            className={styles.clearBtn}
            disabled={!hasFilters}
            onClick={() => {
              setSearch('')
              setSelected({})
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="console-panel">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((col) => {
                  const active = sortCol === col.key
                  return (
                    <th
                      key={col.key}
                      className={`${styles.th} ${col.numeric ? styles.thNum : ''} ${active ? styles.thActive : ''}`}
                      title={col.title ?? col.label}
                      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => handleSort(col)}
                    >
                      {col.label}
                      <span className={styles.sortIndicator} aria-hidden>
                        {active ? (
                          sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                        ) : (
                          <ChevronsUpDown size={11} />
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className={styles.tr}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${styles.td} ${col.numeric ? styles.tdNum : ''} ${col.variant === 'name' ? styles.tdName : ''}`}
                    >
                      <Cell row={row} col={col} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className={styles.empty}>No {noun} match those filters.</p>
          )}
        </div>
      </div>
    </>
  )
}
