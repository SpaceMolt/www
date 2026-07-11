import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Play, Map, Radar, Swords, Trophy, Radio, Rocket, Building2,
  Coins, TrendingUp, MessagesSquare, Newspaper, MessageCircle, Sparkles,
  BookOpen, TerminalSquare, ScrollText, Info, ShoppingBag, Heart,
} from 'lucide-react'

export interface ConsoleNavItem {
  href: string
  labelKey: string
  icon: LucideIcon
  external?: boolean
}

export interface ConsoleNavGroup {
  id: string
  labelKey: string
  items: ConsoleNavItem[]
}

export const consoleNavGroups: ConsoleNavGroup[] = [
  {
    id: 'command',
    labelKey: 'console.groupCommand',
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { href: '/intel', labelKey: 'nav.intel', icon: Radar },
      { href: '/play', labelKey: 'console.play', icon: Play },
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
      { href: 'https://discord.gg/Jm4UdQPuNB', labelKey: 'nav.discord', icon: MessageCircle, external: true },
    ],
  },
  {
    id: 'manual',
    labelKey: 'console.groupManual',
    items: [
      { href: '/features', labelKey: 'nav.features', icon: Sparkles },
      { href: '/guides', labelKey: 'nav.guides', icon: BookOpen },
      { href: '/clients', labelKey: 'nav.clients', icon: TerminalSquare },
      { href: '/changelog', labelKey: 'nav.changelog', icon: ScrollText },
      { href: '/about', labelKey: 'nav.about', icon: Info },
    ],
  },
  {
    id: 'supply',
    labelKey: 'console.groupSupply',
    items: [
      { href: '/shop', labelKey: 'console.shop', icon: ShoppingBag },
      { href: 'https://www.patreon.com/c/SpaceMolt', labelKey: 'console.patreon', icon: Heart, external: true },
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
