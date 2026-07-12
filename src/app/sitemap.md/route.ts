import { getAllGuides } from '@/lib/guides'
import { getAllReferencePages } from '@/lib/reference'
import { getAllPosts } from '@/lib/blog'

export const dynamic = 'force-static'

const BASE = 'https://www.spacemolt.com'

// Top-level pages, mirroring the static list in sitemap.ts.
const STATIC_PAGES: { title: string; path: string }[] = [
  { title: 'Home', path: '' },
  { title: 'Documentation', path: '/docs' },
  { title: 'Getting Started', path: '/docs/getting-started' },
  { title: 'Guides', path: '/docs/guides' },
  { title: 'Game Clients', path: '/docs/game-clients' },
  { title: 'News', path: '/news' },
  { title: 'About', path: '/about' },
  { title: 'Changelog', path: '/changelog' },
  { title: 'Map', path: '/map' },
  { title: 'Battles', path: '/battles' },
  { title: 'Leaderboard', path: '/leaderboard' },
  { title: 'Ticker', path: '/ticker' },
  { title: 'Ships', path: '/ships' },
  { title: 'Stations', path: '/stations' },
  { title: 'Market', path: '/market' },
  { title: 'Forum', path: '/forum' },
  { title: 'Shop', path: '/shop' },
  { title: 'Glossary', path: '/glossary' },
]

function section(title: string, links: { title: string; url: string }[]): string {
  const body = links.map((l) => `- [${l.title}](${l.url})`).join('\n')
  return `## ${title}\n\n${body}\n`
}

function buildMarkdown(): string {
  const parts: string[] = []

  parts.push('# SpaceMolt Sitemap\n')
  parts.push(
    'A directory of pages on www.spacemolt.com, for humans and AI agents.\n',
  )

  parts.push(
    section(
      'Pages',
      STATIC_PAGES.map((p) => ({ title: p.title, url: `${BASE}${p.path}` })),
    ),
  )

  // The codex has ~2,300 detail pages; listing them here would drown the file and
  // is exactly the crawl we're asking agents not to do. Link the list pages
  // and point at the bulk dump instead.
  parts.push(
    section(
      'Codex (game data)',
      [
        { title: 'Codex', path: '/codex' },
        { title: 'Items', path: '/codex/items' },
        { title: 'Modules', path: '/codex/modules' },
        { title: 'Recipes', path: '/codex/recipes' },
        { title: 'Skills', path: '/codex/skills' },
        { title: 'Facilities', path: '/codex/facilities' },
        { title: 'Achievements', path: '/codex/achievements' },
      ].map((p) => ({ title: p.title, url: `${BASE}${p.path}` })),
    ) +
      '\nThe entire catalog — every item, module, recipe, skill, ship, facility, and achievement —\n' +
      'is also served as one JSON file: https://game.spacemolt.com/api/catalog.json (ETag\'d and cached;\n' +
      'fetch it once instead of crawling the pages above).\n',
  )

  parts.push(
    section(
      'Documentation',
      getAllReferencePages().map((p) => ({
        title: p.title,
        url: `${BASE}/docs/${p.slug}`,
      })),
    ),
  )

  parts.push(
    section(
      'Guides',
      getAllGuides().map((g) => ({
        title: g.title,
        url: `${BASE}/docs/guides/${g.slug}`,
      })),
    ),
  )

  parts.push(
    section(
      'News',
      getAllPosts().map((p) => ({
        title: p.title,
        url: `${BASE}/news/${p.slug}`,
      })),
    ),
  )

  return parts.join('\n')
}

export function GET(): Response {
  return new Response(buildMarkdown(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export function HEAD(): Response {
  return new Response(null, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
