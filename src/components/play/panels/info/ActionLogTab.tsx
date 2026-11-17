'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, ScrollText } from 'lucide-react'
import type { Commands } from '@spacemolt/lib'
import { useAccountStore, usePlayer } from '@/lib/spacemolt'
import { titleCase } from '@/lib/format'
import { usePlay } from '../../PlayProvider'
import { ActionButton } from '../../ActionButton'
import { shared, errorMessage } from '../../shared'
import infoStyles from '../InfoPanel.module.css'
import styles from './ActionLogTab.module.css'
import { actionLogToCsv, downloadFile, type ActionLogEntry } from './actionLogExport'

type Category = NonNullable<NonNullable<Parameters<Commands['spacemolt_social']['get_action_log']>[0]>['category']>

const CATEGORIES: Array<'all' | Category> = [
  'all', 'combat', 'trading', 'ship', 'crafting', 'faction', 'mission', 'skill', 'salvage', 'storage',
  'achievement', 'mining', 'navigation', 'exploration', 'reputation', 'drone', 'session', 'other',
]
const PAGE_SIZE = 100

type SortKey = 'created_at' | 'category' | 'event_type'
const SORT_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'created_at', label: 'Time' },
  { key: 'category', label: 'Category' },
  { key: 'event_type', label: 'Event' },
]

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

// <input type="date"> gives a local yyyy-mm-dd. Compare against local midnight.
const localDay = (day: string) => new Date(`${day}T00:00:00`).getTime()

/**
 * Searchable action log. The server filters by source and category, and pages
 * of 100 load on demand. Search, event type, dates and sort run in the browser
 * over the loaded rows. Export saves the rows that pass the filters.
 */
export function ActionLogTab() {
  const store = useAccountStore()
  const player = usePlayer()
  const { uiStore } = usePlay()
  const factionId = player?.faction_id

  const [source, setSource] = useState<'mine' | 'faction'>('mine')
  const [category, setCategory] = useState<'all' | Category>('all')
  const [entries, setEntries] = useState<ActionLogEntry[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'created_at', desc: true })
  const [openId, setOpenId] = useState<number | null>(null)

  // Drop responses from a request that a newer source/category change replaced.
  const requestSeq = useRef(0)

  const load = useCallback(async (nextPage: number) => {
    const seq = ++requestSeq.current
    setLoading(true)
    // A new source or category is a new row set: drop the old rows and the filter built from them.
    if (nextPage === 1) {
      setEntries([])
      setOpenId(null)
      setEventType('')
    }
    try {
      const resp = await store.account.commands.spacemolt_social.get_action_log({
        page: nextPage,
        page_size: PAGE_SIZE,
        category: category === 'all' ? undefined : category,
        faction_id: source === 'faction' ? factionId : undefined,
      })
      if (seq !== requestSeq.current) return
      const result = resp.structuredContent
      const loaded = result?.entries ?? []
      setEntries((prev) => (nextPage === 1 ? loaded : [...prev, ...loaded]))
      setHasMore(Boolean(result?.has_more))
      setTotal(result?.total ?? 0)
      setPage(nextPage)
    } catch (err) {
      if (seq === requestSeq.current) uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [store, uiStore, category, source, factionId])

  useEffect(() => { load(1) }, [load])

  const eventTypes = useMemo(() => [...new Set(entries.map((e) => e.event_type))].sort(), [entries])

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const start = from ? localDay(from) : -Infinity
    const end = to ? localDay(to) + 86400_000 : Infinity
    const dir = sort.desc ? -1 : 1
    return entries
      .filter((e) => !eventType || e.event_type === eventType)
      .filter((e) => {
        const t = new Date(e.created_at).getTime()
        return t >= start && t < end
      })
      .filter((e) => !needle || `${e.summary} ${e.event_type} ${JSON.stringify(e.data ?? {})}`.toLowerCase().includes(needle))
      // ISO timestamps sort correctly as strings. Ties fall back to id so equal rows keep log order.
      .sort((a, b) => dir * (a[sort.key].localeCompare(b[sort.key]) || a.id - b.id))
  }, [entries, search, eventType, from, to, sort])

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : key === 'created_at' }))

  const fileName = (ext: string) =>
    `spacemolt-action-log-${source === 'faction' ? 'faction' : (player?.username ?? 'player')}-${new Date().toLocaleDateString('en-CA')}.${ext}`

  return (
    <div className={styles.root}>
      <div className={infoStyles.filterRow}>
        {factionId && (
          <select className={infoStyles.filterSelect} value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="mine">My log</option>
            <option value="faction">Faction log</option>
          </select>
        )}
        <select className={infoStyles.filterSelect} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
        </select>
        <select className={infoStyles.filterSelect} value={eventType} onChange={(e) => setEventType(e.target.value)}>
          <option value="">All events</option>
          {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className={`${infoStyles.filterRow} ${styles.wrap}`}>
        <input
          className={`${infoStyles.noteInput} ${styles.grow}`}
          type="search"
          placeholder="Search summary, event, data"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input className={infoStyles.noteInput} type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className={infoStyles.noteInput} type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className={styles.toolbar}>
        <span className={styles.count}>
          {shown.length} shown of {entries.length} loaded{total > entries.length ? ` (${total} in log)` : ''}
        </span>
        <ActionButton
          label="CSV"
          icon={<Download size={12} />}
          onClick={() => downloadFile(fileName('csv'), actionLogToCsv(shown), 'text/csv')}
          variant="secondary"
          size="sm"
          disabled={shown.length === 0}
        />
        <ActionButton
          label="JSON"
          icon={<Download size={12} />}
          onClick={() => downloadFile(fileName('json'), JSON.stringify(shown, null, 2), 'application/json')}
          variant="secondary"
          size="sm"
          disabled={shown.length === 0}
        />
      </div>

      <div className={styles.table}>
        <div className={`${styles.row} ${styles.head}`}>
          {SORT_COLUMNS.map(({ key, label }) => (
            <button key={key} type="button" className={styles.sortBtn} onClick={() => toggleSort(key)}>
              {label}
              {sort.key === key && (sort.desc ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
            </button>
          ))}
          <span>Summary</span>
        </div>
        {shown.map((e) => (
          <div key={e.id}>
            <button
              type="button"
              className={`${styles.row} ${styles.entry}`}
              aria-expanded={openId === e.id}
              onClick={() => setOpenId(openId === e.id ? null : e.id)}
            >
              <span className={styles.time} title={e.created_at}>{formatTime(e.created_at)}</span>
              <span className={infoStyles.logCategory}>{e.category}</span>
              <span className={styles.event}>{e.event_type}</span>
              <span className={styles.summary}>{e.summary}</span>
            </button>
            {openId === e.id && (
              <pre className={styles.data}>{JSON.stringify(e.data ?? {}, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>

      {loading && entries.length === 0 && (
        <div className={infoStyles.loading}><span className={shared.spinner} />Loading action log...</div>
      )}
      {!loading && entries.length === 0 && <div className={styles.count}>No log entries.</div>}
      {hasMore && (
        <ActionButton
          label={`Load ${PAGE_SIZE} more`}
          icon={<ScrollText size={14} />}
          onClick={() => load(page + 1)}
          variant="secondary"
          size="sm"
          loading={loading}
        />
      )}
    </div>
  )
}
