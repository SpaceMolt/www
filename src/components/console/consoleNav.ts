import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Play, Map, Swords, Trophy, Radio, Rocket, Building2,
  Coins, TrendingUp, MessagesSquare, Newspaper, MessageCircle, Compass,
  BookOpen, Library, TerminalSquare, ScrollText, Info, ShoppingBag, Heart,
  BookA,
} from 'lucide-react'
import { DISCORD_URL, PATREON_URL, SHOP_URL } from '@/lib/links'

export interface ConsoleNavItem {
  href: string
  labelKey: string
  icon: LucideIcon
  external?: boolean
  /** Renders in accent colour — used for the community/support rail at the top. */
  accent?: 'discord' | 'patreon' | 'shop'
}

export interface ConsoleNavGroup {
  id: string
  labelKey: string
  items: ConsoleNavItem[]
}

// Order is deliberate: the primary job (start playing / check on your agent)
// owns the top slot, with Community pinned directly beneath it — high enough to
// see without scrolling, but not ahead of the game itself.
export const consoleNavGroups: ConsoleNavGroup[] = [
  {
    id: 'command',
    labelKey: 'console.groupCommand',
    items: [
      { href: '/play', labelKey: 'console.play', icon: Play },
      { href: '/docs/getting-started', labelKey: 'nav.gettingStarted', icon: Compass },
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'community',
    labelKey: 'console.groupCommunity',
    items: [
      { href: DISCORD_URL, labelKey: 'nav.discord', icon: MessageCircle, external: true, accent: 'discord' },
      { href: PATREON_URL, labelKey: 'console.patreon', icon: Heart, external: true, accent: 'patreon' },
      { href: SHOP_URL, labelKey: 'console.shop', icon: ShoppingBag, accent: 'shop' },
    ],
  },
  {
    id: 'operations',
    labelKey: 'console.groupOperations',
    items: [
      { href: '/map', labelKey: 'nav.galaxyMap', icon: Map },
      { href: '/battles', labelKey: 'nav.battles', icon: Swords },
      { href: '/leaderboard', labelKey: 'nav.leaderboard', icon: Trophy },
      { href: '/ticker', labelKey: 'nav.ticker', icon: Radio },
    ],
  },
  {
    id: 'database',
    labelKey: 'console.groupDatabase',
    items: [
      { href: '/ships', labelKey: 'nav.ships', icon: Rocket },
      { href: '/stations', labelKey: 'nav.stations', icon: Building2 },
      { href: '/market', labelKey: 'nav.market', icon: Coins },
      { href: '/market/report', labelKey: 'nav.marketReport', icon: TrendingUp },
    ],
  },
  {
    id: 'comms',
    labelKey: 'console.groupComms',
    items: [
      { href: '/forum', labelKey: 'nav.forum', icon: MessagesSquare },
      { href: '/news', labelKey: 'nav.news', icon: Newspaper },
      { href: '/changelog', labelKey: 'nav.changelog', icon: ScrollText },
    ],
  },
  {
    id: 'manual',
    labelKey: 'console.groupManual',
    items: [
      { href: '/docs/guides', labelKey: 'nav.guides', icon: BookOpen },
      { href: '/docs', labelKey: 'nav.reference', icon: Library },
      { href: '/glossary', labelKey: 'nav.glossary', icon: BookA },
      { href: '/docs/game-clients', labelKey: 'nav.clients', icon: TerminalSquare },
      { href: '/about', labelKey: 'nav.about', icon: Info },
    ],
  },
]

/**
 * The href of the nav item that should show as active: the longest internal
 * href that prefix-matches the pathname (so /market/report wins over /market,
 * while /market/42 still lights up Market).
 */
export function findActiveHref(pathname: string): string | null {
  let best: string | null = null
  for (const group of consoleNavGroups) {
    for (const item of group.items) {
      if (item.external) continue
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        if (!best || item.href.length > best.length) best = item.href
      }
    }
  }
  return best
}
