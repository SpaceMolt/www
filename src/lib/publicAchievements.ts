// Client for the gameserver's public achievements API (the shareable-profile
// data source). See gameserver internal/server/achievements_api.go.

import emblemManifest from '@/data/achievement-emblems.json'

export interface PublicAchievementEntry {
  id: string
  name: string
  description: string
  category: string
  points: number
  hidden: boolean
  earned: boolean
  earned_at?: string
  rarity_pct: number
  title?: string
  emblem?: string
}

export interface PublicAchievementsResponse {
  subject: {
    type: 'player' | 'faction'
    name: string
    empire?: string
    faction_tag?: string
    titles?: string[]
    emblems?: string[]
  }
  summary: { earned: number; total: number; points: number }
  achievements: PublicAchievementEntry[]
}

const API_BASE =
  process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

async function fetchAchievements(
  path: string,
): Promise<PublicAchievementsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } })
    if (!res.ok) return null
    return (await res.json()) as PublicAchievementsResponse
  } catch {
    return null
  }
}

// Route params arrive percent-encoded (Next doesn't decode dynamic segments),
// and Next's auto-generated og:image URL encodes them a second time — so a
// param can reach us singly or doubly encoded. Fully unwrap to the real value
// before display/refetch. Tolerates malformed input.
export function safeDecode(s: string): string {
  let cur = s
  for (let i = 0; i < 3; i++) {
    let next: string
    try {
      next = decodeURIComponent(cur)
    } catch {
      return cur
    }
    if (next === cur) return cur
    cur = next
  }
  return cur
}

export function fetchPlayerAchievements(player: string) {
  return fetchAchievements(`/api/players/${encodeURIComponent(player)}/achievements`)
}

export function fetchFactionAchievements(tag: string) {
  return fetchAchievements(`/api/factions/${encodeURIComponent(tag)}/achievements`)
}

export function findAchievement(
  data: PublicAchievementsResponse | null,
  id: string,
): PublicAchievementEntry | null {
  if (!data) return null
  return data.achievements.find((a) => a.id === id) ?? null
}

// Empire → accent colour, drawn from the site's design tokens so a pilot's card
// carries their allegiance. Falls back to plasma-cyan for the unaligned.
export const EMPIRE_ACCENT: Record<string, string> = {
  solarian: '#ffd93d',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#4dabf7',
  outerrim: '#ff6b35',
}

export function accentFor(empire?: string): string {
  return (empire && EMPIRE_ACCENT[empire.toLowerCase()]) || '#00d4ff'
}

export function empireLabel(empire?: string): string {
  if (!empire) return 'Unaligned'
  const m: Record<string, string> = {
    solarian: 'Solarian Concord',
    voidborn: 'Voidborn',
    crimson: 'Crimson Fleet',
    nebula: 'Nebula Trade Federation',
    outerrim: 'Outer Rim',
  }
  return m[empire.toLowerCase()] || empire
}

// Emblem art: which achievements have a generated medallion (the rest fall back
// to a letter glyph). The manifest is written by gen-achievement-emblems.ts.
const EMBLEM_IDS = new Set(emblemManifest as string[])

export function hasEmblem(id: string): boolean {
  return EMBLEM_IDS.has(id)
}

export function emblemSrc(id: string): string {
  return `/images/achievements/${id}.webp`
}

// Prestige tier from points — drives the medallion's frame metal (and any
// tier styling on the card). Mirrors gen-achievement-emblems.ts.
export type EmblemTier = 'bronze' | 'silver' | 'gold' | 'legendary'
export function tierFor(points: number): EmblemTier {
  if (points >= 50) return 'legendary'
  if (points >= 30) return 'gold'
  if (points >= 15) return 'silver'
  return 'bronze'
}

// Human phrasing for the rarity hook — the share card's pull.
export function rarityLabel(pct: number): string {
  if (pct <= 0) return 'Unclaimed in the galaxy'
  if (pct < 0.1) return 'Top 0.1% of pilots'
  if (pct < 1) return `Top ${pct.toFixed(1)}% of pilots`
  if (pct < 10) return `Earned by ${pct.toFixed(1)}% of pilots`
  return `Earned by ${Math.round(pct)}% of pilots`
}
