import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Play, Map, Radar, Swords, Trophy, Radio, Building2,
  Coins, TrendingUp, MessagesSquare, Newspaper, MessageCircle, Compass,
  BookOpen, Library, TerminalSquare, ScrollText, Info, ShoppingBag, Heart,
  BookA, Database, Activity,
} from 'lucide-react'
import { DISCORD_URL, PATREON_URL, SHOP_URL, STATUS_URL } from '@/lib/links'

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
    id: 'start',
    labelKey: 'console.groupStart',
    items: [
      { href: '/play', labelKey: 'console.play', icon: Play },
      { href: '/docs/getting-started', labelKey: 'nav.gettingStarted', icon: Compass },
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { href: '/intel', labelKey: 'nav.intel', icon: Radar },
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
    id: 'galaxy',
    labelKey: 'console.groupGalaxy',
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
      // "Codex" not "Reference" — /docs already owns that label (and /reference
      // permanently redirects to /docs), so the game-data catalog lives at /codex.
      { href: '/codex', labelKey: 'nav.codex', icon: Database },
      // /codex/ships is reached from the Codex index card — it no longer earns
      // its own sidebar slot now that the Codex fronts the data.
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
      { href: STATUS_URL, labelKey: 'nav.status', icon: Activity, external: true },
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
