'use client'

import { useState, useEffect } from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'
import { AchievementsBoard } from './AchievementsBoard'
import { PlayerLink, FactionLink } from '@/components/profile/ProfileLink'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface PlayerRankEntry {
  rank: number
  username: string
  empire: string
  value: number
  npc?: boolean // injected benchmark rows (empire/pirate fleets) — never link
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
    exchange_credits_earned: PlayerRankEntry[]
    ships_destroyed: PlayerRankEntry[]
    ships_lost: PlayerRankEntry[]
    damage_dealt: PlayerRankEntry[]
    pirates_destroyed: PlayerRankEntry[]
    items_crafted: PlayerRankEntry[]
    ore_mined: PlayerRankEntry[]
    facilities_built: PlayerRankEntry[]
    facility_items_produced: PlayerRankEntry[]
    trades_completed: PlayerRankEntry[]
    systems_explored: PlayerRankEntry[]
    distance_traveled: PlayerRankEntry[]
    missions_completed: PlayerRankEntry[]
    wormholes_traversed: PlayerRankEntry[]
    ship_value: PlayerRankEntry[]
    ships_commissioned: PlayerRankEntry[]
    facility_investment: PlayerRankEntry[]
    storage_value: PlayerRankEntry[]
    refuels_given: PlayerRankEntry[]
    items_jettisoned: PlayerRankEntry[]
    customs_evaded: PlayerRankEntry[]
    contraband_sold: PlayerRankEntry[]
  }
  factions: {
    total_wealth: FactionRankEntry[]
    member_count: FactionRankEntry[]
    ship_value: FactionRankEntry[]
    facility_investment: FactionRankEntry[]
    storage_value: FactionRankEntry[]
    ships_destroyed: FactionRankEntry[]
    damage_dealt: FactionRankEntry[]
    ore_mined: FactionRankEntry[]
    items_crafted: FactionRankEntry[]
    missions_completed: FactionRankEntry[]
  }
  exchange: {
    items_listed: PlayerRankEntry[]
    active_orders: PlayerRankEntry[]
    sell_order_value: PlayerRankEntry[]
    escrow_value: PlayerRankEntry[]
  }
}

type Tab = 'players' | 'factions' | 'exchange' | 'achievements'

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
  pirate: '#cc3333',
}

interface CategoryDef {
  key: string
  labelKey: string
  format: 'credits' | 'number'
  description: string
}

interface CategoryGroup {
  label: string
  categories: CategoryDef[]
}

const PLAYER_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'Economy',
    categories: [
      {
        key: 'total_wealth',
        labelKey: 'leaderboard.totalWealth',
        format: 'credits',
        description:
          'Credits held + credits locked in active buy orders (escrow) + all stored items at their base market price + fitted fleet at hull & module production cost + total facility build investment.',
      },
      {
        key: 'credits_earned',
        labelKey: 'leaderboard.creditsEarned',
        format: 'credits',
        description:
          'Lifetime cumulative credits received from all sources — trading, missions, salvage, gifts, insurance payouts, and more.',
      },
      {
        key: 'credits_spent',
        labelKey: 'leaderboard.creditsSpent',
        format: 'credits',
        description: 'Lifetime cumulative credits spent across all purchases and fees.',
      },
      {
        key: 'exchange_credits_earned',
        labelKey: 'leaderboard.exchangeRevenue',
        format: 'credits',
        description: 'Lifetime credits earned specifically from exchange sell orders filling.',
      },
      {
        key: 'trades_completed',
        labelKey: 'leaderboard.tradesCompleted',
        format: 'number',
        description: 'Total direct P2P trades negotiated and completed with other players.',
      },
    ],
  },
  {
    label: 'Fleet',
    categories: [
      {
        key: 'ship_value',
        labelKey: 'leaderboard.shipValue',
        format: 'credits',
        description:
          'Current fleet value: each ship\'s hull price plus the production cost of installed modules. Module cost uses the fair market production price when available, otherwise falls back to base item value. Empire and pirate NPC fleets are included as benchmark entries.',
      },
      {
        key: 'ships_commissioned',
        labelKey: 'leaderboard.shipsCommissioned',
        format: 'number',
        description: 'Total ships ever commissioned from a shipyard. Does not count ships purchased second-hand.',
      },
      {
        key: 'ships_destroyed',
        labelKey: 'leaderboard.shipsDestroyed',
        format: 'number',
        description: 'Total enemy player ships destroyed in combat.',
      },
      {
        key: 'ships_lost',
        labelKey: 'leaderboard.shipsLost',
        format: 'number',
        description: 'Total own ships lost to any cause — PvP, pirates, or self-destruct.',
      },
      {
        key: 'damage_dealt',
        labelKey: 'leaderboard.damageDealt',
        format: 'number',
        description: 'Cumulative damage dealt across all combat encounters, summed across all damage types.',
      },
      {
        key: 'pirates_destroyed',
        labelKey: 'leaderboard.piratesDestroyed',
        format: 'number',
        description: 'Total pirate NPC ships destroyed.',
      },
    ],
  },
  {
    label: 'Industry',
    categories: [
      {
        key: 'storage_value',
        labelKey: 'leaderboard.storageValue',
        format: 'credits',
        description:
          'Total value of items stored across all bases, calculated at each item\'s base market price.',
      },
      {
        key: 'facility_investment',
        labelKey: 'leaderboard.facilityInvestment',
        format: 'credits',
        description:
          'Sum of the one-time build cost of all owned facilities. Reflects total capital deployed into infrastructure.',
      },
      {
        key: 'facility_items_produced',
        labelKey: 'leaderboard.facilityItemsProduced',
        format: 'number',
        description: 'Total items produced by facilities you own. Each facility cycle that outputs an item increments this counter.',
      },
      {
        key: 'items_crafted',
        labelKey: 'leaderboard.itemsCrafted',
        format: 'number',
        description: 'Total number of items produced via crafting recipes.',
      },
      {
        key: 'ore_mined',
        labelKey: 'leaderboard.oreMined',
        format: 'number',
        description: 'Total units of ore and raw resources extracted from asteroid belts and resource nodes.',
      },
      {
        key: 'facilities_built',
        labelKey: 'leaderboard.facilitiesBuilt',
        format: 'number',
        description: 'Total number of facilities ever constructed.',
      },
      {
        key: 'refuels_given',
        labelKey: 'leaderboard.refuelsGiven',
        format: 'number',
        description: 'Total number of times you have refueled another player\'s ship.',
      },
      {
        key: 'items_jettisoned',
        labelKey: 'leaderboard.itemsJettisoned',
        format: 'number',
        description: 'Total items dropped into space as floating wrecks or cargo pods.',
      },
    ],
  },
  {
    label: 'Exploration',
    categories: [
      {
        key: 'systems_explored',
        labelKey: 'leaderboard.systemsExplored',
        format: 'number',
        description: 'Number of unique star systems visited.',
      },
      {
        key: 'wormholes_traversed',
        labelKey: 'leaderboard.wormholesTraversed',
        format: 'number',
        description: 'Total wormhole transits completed. Wormholes are one-way passages to distant systems with no jump-drive alternative.',
      },
      {
        key: 'distance_traveled',
        labelKey: 'leaderboard.distanceTraveled',
        format: 'number',
        description:
          'Cumulative distance traveled — measured in AU for in-system movement and GU (galactic units) for inter-system jumps.',
      },
      {
        key: 'missions_completed',
        labelKey: 'leaderboard.missionsCompleted',
        format: 'number',
        description: 'Total missions completed across all mission types.',
      },
    ],
  },
  {
    label: 'Smuggling',
    categories: [
      {
        key: 'customs_evaded',
        labelKey: 'leaderboard.customsEvaded',
        format: 'number',
        description: 'Total successful customs scans evaded while carrying contraband.',
      },
      {
        key: 'contraband_sold',
        labelKey: 'leaderboard.contrabandSold',
        format: 'number',
        description: 'Total contraband items sold on the black market.',
      },
    ],
  },
]

const FACTION_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'Wealth',
    categories: [
      {
        key: 'total_wealth',
        labelKey: 'leaderboard.totalWealth',
        format: 'credits',
        description:
          'Faction treasury credits plus member wallet balances, faction storage value, facility investment, exchange escrow, and member fleet value.',
      },
      {
        key: 'storage_value',
        labelKey: 'leaderboard.storageValue',
        format: 'credits',
        description: 'Total value of items in faction storage across all bases, at base market price.',
      },
      {
        key: 'facility_investment',
        labelKey: 'leaderboard.facilityInvestment',
        format: 'credits',
        description: 'Sum of the build cost of all faction-owned facilities.',
      },
    ],
  },
  {
    label: 'Fleet',
    categories: [
      {
        key: 'ship_value',
        labelKey: 'leaderboard.shipValue',
        format: 'credits',
        description:
          'Combined fleet value of all member ships: hull price plus installed module production costs.',
      },
      {
        key: 'ships_destroyed',
        labelKey: 'leaderboard.shipsDestroyed',
        format: 'number',
        description: 'Total enemy player ships destroyed by faction members combined.',
      },
      {
        key: 'damage_dealt',
        labelKey: 'leaderboard.damageDealt',
        format: 'number',
        description: 'Cumulative damage dealt by all faction members across all combat encounters.',
      },
    ],
  },
  {
    label: 'Operations',
    categories: [
      {
        key: 'member_count',
        labelKey: 'leaderboard.members',
        format: 'number',
        description: 'Current number of faction members.',
      },
      {
        key: 'ore_mined',
        labelKey: 'leaderboard.oreMined',
        format: 'number',
        description: 'Total ore and raw resources extracted by all faction members combined.',
      },
      {
        key: 'missions_completed',
        labelKey: 'leaderboard.missionsCompleted',
        format: 'number',
        description: 'Total missions completed by all faction members combined.',
      },
      {
        key: 'items_crafted',
        labelKey: 'leaderboard.itemsCrafted',
        format: 'number',
        description: 'Total items crafted by all faction members combined.',
      },
    ],
  },
]

const EXCHANGE_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: '',
    categories: [
      {
        key: 'sell_order_value',
        labelKey: 'leaderboard.sellOrderValue',
        format: 'credits',
        description:
          'Total value of items currently listed on sell orders, calculated as quantity remaining × ask price each.',
      },
      {
        key: 'escrow_value',
        labelKey: 'leaderboard.escrowValue',
        format: 'credits',
        description:
          'Credits currently locked in active buy orders, calculated as quantity remaining × bid price each.',
      },
      {
        key: 'items_listed',
        labelKey: 'leaderboard.itemsListed',
        format: 'number',
        description: 'Total number of individual items currently listed on active sell orders.',
      },
      {
        key: 'active_orders',
        labelKey: 'leaderboard.activeOrders',
        format: 'number',
        description: 'Total active orders on the exchange — buy and sell orders combined, excluding filled orders.',
      },
    ],
  },
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

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

function empireName(id: string): string {
  switch (id) {
    case 'solarian': return 'Solarian'
    case 'voidborn': return 'Voidborn'
    case 'crimson': return 'Crimson Fleet'
    case 'nebula': return 'Nebula Collective'
    case 'outerrim': return 'Outer Rim'
    case 'pirate': return 'Pirate Fleet'
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

  const activeGroups =
    activeTab === 'players'
      ? PLAYER_CATEGORY_GROUPS
      : activeTab === 'factions'
        ? FACTION_CATEGORY_GROUPS
        : EXCHANGE_CATEGORY_GROUPS

  const activeCategory =
    activeTab === 'players'
      ? playerCategory
      : activeTab === 'factions'
        ? factionCategory
        : exchangeCategory

  const setCategory = (key: string) => {
    if (activeTab === 'players') setPlayerCategory(key)
    else if (activeTab === 'factions') setFactionCategory(key)
    else setExchangeCategory(key)
  }

  const allActiveCategories = activeGroups.flatMap(g => g.categories)
  const activeCategoryDef = allActiveCategories.find(c => c.key === activeCategory)
  const currentFormat = activeCategoryDef?.format ?? 'number'
  const currentDescription = activeCategoryDef?.description ?? ''

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
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Galaxy</span>
        <h1 className="console-page-title">{t('leaderboard.title')}</h1>
        <p className="console-page-sub">{t('leaderboard.subtitle')}</p>
      </header>

      <h2 style={srOnly}>Leaderboard Categories</h2>
      <div className={styles.tabs}>
        {(['players', 'factions', 'exchange', 'achievements'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'players'
              ? t('leaderboard.tabPlayers')
              : tab === 'factions'
                ? t('leaderboard.tabFactions')
                : tab === 'exchange'
                  ? t('leaderboard.tabExchange')
                  : 'Achievements'}
          </button>
        ))}
      </div>

      <h2 style={srOnly}>Rankings</h2>

      {activeTab === 'achievements' ? (
        <AchievementsBoard />
      ) : (
        <>
          <div className={styles.categorySection}>
            {activeGroups.map(group => (
              <div key={group.label || '_'} className={styles.categoryGroup}>
                {group.label && (
                  <span className={styles.categoryGroupLabel}>{group.label}</span>
                )}
                <div className={styles.categoryGroupButtons}>
                  {group.categories.map(cat => (
                    <button
                      key={cat.key}
                      className={`${styles.catBtn} ${activeCategory === cat.key ? styles.catBtnActive : ''}`}
                      onClick={() => setCategory(cat.key)}
                    >
                      {t(cat.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {currentDescription && (
            <div className={styles.categoryInfo}>
              <span className={styles.categoryInfoIcon}>
                <Info size={13} aria-hidden />
              </span>
              <span>{currentDescription}</span>
            </div>
          )}

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
        </>
      )}
    </div>
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
              <td className={styles.cellName}>
                {entry.npc ? entry.username : <PlayerLink name={entry.username} />}
              </td>
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
              <td className={styles.cellTag}>
                <FactionLink tag={entry.tag}>[{entry.tag}]</FactionLink>
              </td>
              <td className={styles.cellName}>
                <FactionLink tag={entry.tag} name={entry.name} />
              </td>
              <td className={styles.cellValue}>{formatValue(entry.value, format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
