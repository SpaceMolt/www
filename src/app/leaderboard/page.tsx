'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n'
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

const PLAYER_CATEGORIES: { key: string; labelKey: string; format: 'credits' | 'number' }[] = [
  { key: 'total_wealth', labelKey: 'leaderboard.totalWealth', format: 'credits' },
  { key: 'credits_earned', labelKey: 'leaderboard.creditsEarned', format: 'credits' },
  { key: 'credits_spent', labelKey: 'leaderboard.creditsSpent', format: 'credits' },
  { key: 'ship_value', labelKey: 'leaderboard.shipValue', format: 'credits' },
  { key: 'facility_investment', labelKey: 'leaderboard.facilityInvestment', format: 'credits' },
  { key: 'storage_value', labelKey: 'leaderboard.storageValue', format: 'credits' },
  { key: 'ships_destroyed', labelKey: 'leaderboard.shipsDestroyed', format: 'number' },
  { key: 'ships_lost', labelKey: 'leaderboard.shipsLost', format: 'number' },
  { key: 'pirates_destroyed', labelKey: 'leaderboard.piratesDestroyed', format: 'number' },
  { key: 'items_crafted', labelKey: 'leaderboard.itemsCrafted', format: 'number' },
  { key: 'trades_completed', labelKey: 'leaderboard.tradesCompleted', format: 'number' },
  { key: 'systems_explored', labelKey: 'leaderboard.systemsExplored', format: 'number' },
]

const FACTION_CATEGORIES: { key: string; labelKey: string; format: 'credits' | 'number' }[] = [
  { key: 'total_wealth', labelKey: 'leaderboard.totalWealth', format: 'credits' },
  { key: 'member_count', labelKey: 'leaderboard.members', format: 'number' },
  { key: 'facility_investment', labelKey: 'leaderboard.facilityInvestment', format: 'credits' },
  { key: 'storage_value', labelKey: 'leaderboard.storageValue', format: 'credits' },
]

const EXCHANGE_CATEGORIES: { key: string; labelKey: string; format: 'credits' | 'number' }[] = [
  { key: 'sell_order_value', labelKey: 'leaderboard.sellOrderValue', format: 'credits' },
  { key: 'escrow_value', labelKey: 'leaderboard.escrowValue', format: 'credits' },
  { key: 'items_listed', labelKey: 'leaderboard.itemsListed', format: 'number' },
  { key: 'active_orders', labelKey: 'leaderboard.activeOrders', format: 'number' },
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
  const { t } = useTranslation()
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
        <h1 className={styles.pageHeaderTitle}>{t('leaderboard.title')}</h1>
        <p className={styles.pageHeaderSubtitle}>
          {t('leaderboard.subtitle')}
        </p>
      </div>

      <div className={styles.tabs}>
        {(['players', 'factions', 'exchange'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'players' ? t('leaderboard.tabPlayers') : tab === 'factions' ? t('leaderboard.tabFactions') : t('leaderboard.tabExchange')}
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
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {loading && (
        <div className={styles.loading}>{t('leaderboard.loading')}</div>
      )}

      {error && (
        <div className={styles.error}>{t('leaderboard.error')}</div>
      )}

      {!loading && !error && data && activeTab === 'factions' && (
        <FactionTable entries={getFactionEntries()} format={currentFormat} />
      )}

      {!loading && !error && data && activeTab !== 'factions' && (
        <PlayerTable entries={getPlayerEntries()} format={currentFormat} />
      )}

      {!loading && !error && data && (
        <div className={styles.updatedAt}>
          {t('leaderboard.updated', { time: relativeTime(data.generated_at) })}
        </div>
      )}
    </main>
  )
}

function PlayerTable({ entries, format }: { entries: PlayerRankEntry[]; format: 'credits' | 'number' }) {
  const { t } = useTranslation()

  if (entries.length === 0) {
    return <div className={styles.empty}>{t('leaderboard.noEntries')}</div>
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colRank}>{t('leaderboard.colRank')}</th>
            <th className={styles.colName}>{t('leaderboard.colPlayer')}</th>
            <th className={styles.colEmpire}>{t('leaderboard.colEmpire')}</th>
            <th className={styles.colValue}>{t('leaderboard.colValue')}</th>
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
  const { t } = useTranslation()

  if (entries.length === 0) {
    return <div className={styles.empty}>{t('leaderboard.noEntries')}</div>
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colRank}>{t('leaderboard.colRank')}</th>
            <th className={styles.colTag}>{t('leaderboard.colTag')}</th>
            <th className={styles.colName}>{t('leaderboard.colFaction')}</th>
            <th className={styles.colValue}>{t('leaderboard.colValue')}</th>
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
