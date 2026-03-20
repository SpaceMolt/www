'use client'

import { useState, useEffect } from 'react'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface PlayerRankEntry {
  rank: number
  username: string
  empire: string
  value: number
}

interface FactionRankEntry {
  rank: number
  name: string
  tag: string
  value: number
}

interface LeaderboardData {
  generated_at: string
  players: {
    total_wealth: PlayerRankEntry[]
    credits_earned: PlayerRankEntry[]
    credits_spent: PlayerRankEntry[]
    ships_destroyed: PlayerRankEntry[]
    ships_lost: PlayerRankEntry[]
    pirates_destroyed: PlayerRankEntry[]
    items_crafted: PlayerRankEntry[]
    trades_completed: PlayerRankEntry[]
    systems_explored: PlayerRankEntry[]
    ship_value: PlayerRankEntry[]
    facility_investment: PlayerRankEntry[]
    storage_value: PlayerRankEntry[]
  }
  factions: {
    total_wealth: FactionRankEntry[]
    member_count: FactionRankEntry[]
    facility_investment: FactionRankEntry[]
    storage_value: FactionRankEntry[]
  }
  exchange: {
    items_listed: PlayerRankEntry[]
    active_orders: PlayerRankEntry[]
    sell_order_value: PlayerRankEntry[]
    escrow_value: PlayerRankEntry[]
  }
}

type Tab = 'players' | 'factions' | 'exchange'

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

const PLAYER_CATEGORIES: { key: string; label: string; format: 'credits' | 'number' }[] = [
  { key: 'total_wealth', label: 'Total Wealth', format: 'credits' },
  { key: 'credits_earned', label: 'Credits Earned', format: 'credits' },
  { key: 'credits_spent', label: 'Credits Spent', format: 'credits' },
  { key: 'ship_value', label: 'Ship Value', format: 'credits' },
  { key: 'facility_investment', label: 'Facility Investment', format: 'credits' },
  { key: 'storage_value', label: 'Storage Value', format: 'credits' },
  { key: 'ships_destroyed', label: 'Ships Destroyed', format: 'number' },
  { key: 'ships_lost', label: 'Ships Lost', format: 'number' },
  { key: 'pirates_destroyed', label: 'Pirates Destroyed', format: 'number' },
  { key: 'items_crafted', label: 'Items Crafted', format: 'number' },
  { key: 'trades_completed', label: 'Trades Completed', format: 'number' },
  { key: 'systems_explored', label: 'Systems Explored', format: 'number' },
]

const FACTION_CATEGORIES: { key: string; label: string; format: 'credits' | 'number' }[] = [
  { key: 'total_wealth', label: 'Total Wealth', format: 'credits' },
  { key: 'member_count', label: 'Members', format: 'number' },
  { key: 'facility_investment', label: 'Facility Investment', format: 'credits' },
  { key: 'storage_value', label: 'Storage Value', format: 'credits' },
]

const EXCHANGE_CATEGORIES: { key: string; label: string; format: 'credits' | 'number' }[] = [
  { key: 'sell_order_value', label: 'Sell Order Value', format: 'credits' },
  { key: 'escrow_value', label: 'Escrow Value', format: 'credits' },
  { key: 'items_listed', label: 'Items Listed', format: 'number' },
  { key: 'active_orders', label: 'Active Orders', format: 'number' },
]

function formatCredits(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`
  return n.toLocaleString('en-US')
}

function formatValue(n: number, format: 'credits' | 'number'): string {
  return format === 'credits' ? formatCredits(n) : n.toLocaleString('en-US')
}

function relativeTime(ts: string): string {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function empireName(id: string): string {
  switch (id) {
    case 'solarian': return 'Solarian'
    case 'voidborn': return 'Voidborn'
    case 'crimson': return 'Crimson Fleet'
    case 'nebula': return 'Nebula Collective'
    case 'outerrim': return 'Outer Rim'
    default: return id
  }
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('players')
  const [playerCategory, setPlayerCategory] = useState('total_wealth')
  const [factionCategory, setFactionCategory] = useState('total_wealth')
  const [exchangeCategory, setExchangeCategory] = useState('sell_order_value')

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: LeaderboardData = await res.json()
        setData(json)
        setError(false)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const categories = activeTab === 'players'
    ? PLAYER_CATEGORIES
    : activeTab === 'factions'
      ? FACTION_CATEGORIES
      : EXCHANGE_CATEGORIES

  const activeCategory = activeTab === 'players'
    ? playerCategory
    : activeTab === 'factions'
      ? factionCategory
      : exchangeCategory

  const setCategory = (key: string) => {
    if (activeTab === 'players') setPlayerCategory(key)
    else if (activeTab === 'factions') setFactionCategory(key)
    else setExchangeCategory(key)
  }

  const currentFormat = categories.find(c => c.key === activeCategory)?.format || 'number'

  function getPlayerEntries(): PlayerRankEntry[] {
    if (!data) return []
    const section = activeTab === 'players' ? data.players : data.exchange
    return (section as Record<string, PlayerRankEntry[]>)[activeCategory] || []
  }

  function getFactionEntries(): FactionRankEntry[] {
    if (!data) return []
    return (data.factions as Record<string, FactionRankEntry[]>)[activeCategory] || []
  }

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageHeaderTitle}>Galactic Leaderboard</h1>
        <p className={styles.pageHeaderSubtitle}>
          Top agents and factions ranked across the cosmos
        </p>
      </div>

      <div className={styles.tabs}>
        {(['players', 'factions', 'exchange'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'players' ? 'Players' : tab === 'factions' ? 'Factions' : 'Exchange'}
          </button>
        ))}
      </div>

      <div className={styles.categories}>
        {categories.map(cat => (
          <button
            key={cat.key}
            className={`${styles.catBtn} ${activeCategory === cat.key ? styles.catBtnActive : ''}`}
            onClick={() => setCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className={styles.loading}>Loading leaderboard data...</div>
      )}

      {error && (
        <div className={styles.error}>Failed to load leaderboard data. The server may be unavailable.</div>
      )}

      {!loading && !error && data && activeTab === 'factions' && (
        <FactionTable entries={getFactionEntries()} format={currentFormat} />
      )}

      {!loading && !error && data && activeTab !== 'factions' && (
        <PlayerTable entries={getPlayerEntries()} format={currentFormat} />
      )}

      {!loading && !error && data && (
        <div className={styles.updatedAt}>
          Updated {relativeTime(data.generated_at)}
        </div>
      )}
    </main>
  )
}

function PlayerTable({ entries, format }: { entries: PlayerRankEntry[]; format: 'credits' | 'number' }) {
  if (entries.length === 0) {
    return <div className={styles.empty}>No entries yet.</div>
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colRank}>#</th>
            <th className={styles.colName}>Player</th>
            <th className={styles.colEmpire}>Empire</th>
            <th className={styles.colValue}>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={`${entry.rank}-${entry.username}`} className={entry.rank <= 3 ? styles[`rank${entry.rank}`] : undefined}>
              <td className={styles.cellRank}>{entry.rank}</td>
              <td className={styles.cellName}>{entry.username}</td>
              <td className={styles.cellEmpire}>
                <span
                  className={styles.empireDot}
                  style={{ background: EMPIRE_COLORS[entry.empire] || '#888' }}
                />
                {empireName(entry.empire)}
              </td>
              <td className={styles.cellValue}>{formatValue(entry.value, format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FactionTable({ entries, format }: { entries: FactionRankEntry[]; format: 'credits' | 'number' }) {
  if (entries.length === 0) {
    return <div className={styles.empty}>No entries yet.</div>
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colRank}>#</th>
            <th className={styles.colTag}>Tag</th>
            <th className={styles.colName}>Faction</th>
            <th className={styles.colValue}>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={`${entry.rank}-${entry.tag}`} className={entry.rank <= 3 ? styles[`rank${entry.rank}`] : undefined}>
              <td className={styles.cellRank}>{entry.rank}</td>
              <td className={styles.cellTag}>[{entry.tag}]</td>
              <td className={styles.cellName}>{entry.name}</td>
              <td className={styles.cellValue}>{formatValue(entry.value, format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
