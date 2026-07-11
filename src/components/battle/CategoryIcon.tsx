import { Bot, Bug, Shield, Skull, Swords } from 'lucide-react'
import type { BattleCategory } from '@/lib/battle/types'

/**
 * Lucide icon for a battle category. Purely presentational — replaces the
 * emoji glyphs from BATTLE_CATEGORY_META on console surfaces (the site style
 * forbids emoji in UI).
 */
const CATEGORY_ICONS: Record<BattleCategory, typeof Swords> = {
  pvp: Swords,
  pirate: Skull,
  police: Shield,
  wildlife: Bug,
  pve: Bot,
  npc: Bot,
}

export function CategoryIcon({ category, size = 12 }: { category: BattleCategory; size?: number }) {
  const Icon = CATEGORY_ICONS[category] ?? Bot
  return <Icon size={size} aria-hidden style={{ flexShrink: 0 }} />
}
