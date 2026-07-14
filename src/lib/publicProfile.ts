// Client for the gameserver's public profile API (player and faction profile
// pages). See gameserver internal/server/profile_api.go.

import { accentFor } from '@/lib/publicAchievements'

export interface ProfileRank {
  category: string
  label: string
  rank: number
  value: number
}

export interface ProfileAchievementsSummary {
  earned: number
  total: number
  points: number
}

export interface PlayerProfileStats {
  credits_earned: number
  ships_destroyed: number
  ships_lost: number
  pirates_destroyed: number
  damage_dealt: number
  ore_mined: number
  items_crafted: number
  trades_completed: number
  exchange_credits_earned: number
  missions_completed: number
  systems_explored: number
  jumps_completed: number
  distance_traveled: number
  wormholes_traversed: number
  time_played: number
  times_docked: number
}

export interface PublicPlayerProfile {
  username: string
  empire: string
  empire_name?: string
  clan_tag?: string
  status_message?: string
  primary_color?: string
  secondary_color?: string
  created_at: string
  online: boolean
  titles?: string[]
  faction?: {
    name: string
    tag: string
    role?: string
    joined_at: string
  } | null
  // Omitted entirely for pilots whose position is unknown (e.g. cloaked).
  location?: {
    system_id: string
    system_name: string
    docked_station_id?: string
    docked_station_name?: string
  } | null
  stats: PlayerProfileStats
  ranks: ProfileRank[]
  ranks_top_n: number
  ranks_generated_at?: string
  achievements: ProfileAchievementsSummary
}

export interface FactionMemberRow {
  username: string
  role?: string
  role_priority: number
  joined_at: string
  last_seen: string
}

export interface FactionRef {
  name: string
  tag: string
}

export interface FactionWarRow {
  target_name: string
  target_tag: string
  aggressor: boolean
  started_at: string
  reason?: string
  our_kills: number
  their_kills: number
}

export interface FactionStationRow {
  id: string
  name: string
  system_id?: string
  system_name?: string
}

export interface PublicFactionProfile {
  id: string
  name: string
  tag: string
  description?: string
  charter?: string
  primary_color?: string
  secondary_color?: string
  emblem?: string
  created_at: string
  leader?: string
  founder?: string
  treasury: number
  member_count: number
  members: FactionMemberRow[]
  allies: FactionRef[]
  enemies: FactionRef[]
  wars: FactionWarRow[]
  stations: FactionStationRow[]
  titles?: string[]
  emblems?: string[]
  ranks: ProfileRank[]
  ranks_top_n: number
  ranks_generated_at?: string
  achievements: ProfileAchievementsSummary
}

const API_BASE =
  process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function fetchPlayerProfile(name: string) {
  return fetchJSON<PublicPlayerProfile>(`/api/players/${encodeURIComponent(name)}`)
}

export function fetchFactionProfile(tag: string) {
  return fetchJSON<PublicFactionProfile>(`/api/factions/${encodeURIComponent(tag)}`)
}

// The slice of the battles API the profile page renders.
export interface ProfileBattle {
  battle_id: string
  system_id: string
  system_name: string
  status: string
  category?: string
  duration_ticks: number
  participant_count: number
  ships_destroyed: number
  destroyed_names?: string[]
  player_names?: string[]
  outcome?: string | null
  ended_at?: string
  sides: { side_id: number; faction_tag?: string; participants: string[] }[]
}

// Recent battles involving a player: the battles search matches by substring,
// so filter to exact participant membership before showing them on a profile.
export async function fetchRecentBattles(name: string): Promise<ProfileBattle[]> {
  const data = await fetchJSON<{ battles: ProfileBattle[] | null }>(
    `/api/battles?search=${encodeURIComponent(name)}&limit=8`,
  )
  if (!data?.battles) return []
  return data.battles
    .filter((b) => b.sides?.some((s) => s.participants?.includes(name)))
    .slice(0, 5)
}

// A player-picked accent color is only safe on the dark theme if it's a valid
// hex and bright enough to read against #0a0e17; otherwise fall back to the
// empire accent.
export function safeAccent(hex: string | undefined, empire?: string): string {
  const fallback = accentFor(empire)
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.15 ? fallback : hex
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

// Compact credits/values for stat tiles: 1.2M, 45.3K.
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

// Play time arrives in seconds.
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  // Zero-value Go timestamps ("0001-01-01...") parse fine but would render
  // as an absurd "739000d ago" — treat anything pre-game as unknown.
  if (then < Date.UTC(2020, 0, 1)) return ''
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
