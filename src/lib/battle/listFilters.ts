import type { BattleCategory } from './types'

// Station participation is independent of who fought (the battle category).
export type FilterCategory = 'all' | BattleCategory | 'station'

export function battleListParams(status: string, category: FilterCategory, search: string, limit: number) {
  const params = new URLSearchParams({ status, limit: String(limit), offset: '0' })
  if (category === 'station') params.set('station', 'true')
  else if (category !== 'all') params.set('category', category)
  if (search.trim()) params.set('search', search.trim())
  return params
}
