import fs from 'fs'
import path from 'path'
import type { MetadataRoute } from 'next'
import { getAllGuides } from '@/lib/guides'
import { getAllReferencePages } from '@/lib/reference'
import { getAllPosts } from '@/lib/blog'
import { allModules, allNonModuleItems, allRecipes, catalogMeta } from '@/data/catalog'
import {
  allAchievements,
  allFactionAchievements,
  allSkills,
  referenceMeta,
} from '@/data/catalogReference'
import { allChains } from '@/app/(console)/codex/facilities/chains'
import { listableShips } from '@/app/(console)/codex/ships/catalogShips'
import { SITE_URL } from '@/lib/links'

// Build time — used as the lastModified for static routes.
const BUILD_TIME = new Date()

/** mtime of a markdown file under public/<dir>/<slug>.md, or build time on failure. */
function mdMtime(dir: string, slug: string): Date {
  try {
    return fs.statSync(path.join(process.cwd(), 'public', dir, `${slug}.md`)).mtime
  } catch {
    return BUILD_TIME
  }
}

// robots.txt has advertised /sitemap.xml for a while; this route makes it real.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/docs',
    '/docs/getting-started',
    '/docs/guides',
    '/docs/game-clients',
    '/news',
    '/about',
    '/changelog',
    '/map',
    '/battles',
    '/leaderboard',
    '/ticker',
    '/stations',
    '/market',
    '/forum',
    '/shop',
    '/glossary',
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: BUILD_TIME,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }))

  const guides = getAllGuides().map((g) => ({
    url: `${SITE_URL}/docs/guides/${g.slug}`,
    lastModified: mdMtime('guides', g.slug),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const reference = getAllReferencePages().map((p) => ({
    url: `${SITE_URL}/docs/${p.slug}`,
    lastModified: mdMtime('docs', p.slug),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const posts = getAllPosts().map((p) => ({
    url: `${SITE_URL}/news/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }))

  return [...staticRoutes, ...guides, ...reference, ...posts, ...codexRoutes()]
}

/**
 * The codex: eight list pages plus a detail page per catalog entry. These are
 * statically rendered from the build-time catalog dump, so `lastModified` is
 * when that dump was fetched — the data only moves when a game release moves it,
 * which is why everything here is 'monthly' rather than the 'weekly' the live
 * pages claim.
 *
 * FACILITIES — chain roots only. The catalog has 2,652 facilities and every one
 * of them has an addressable detail page, but they collapse into 859 upgrade
 * chains, and each detail page renders its *whole* chain. So the ~1,800 non-root
 * tiers are near-duplicates of their root's page: same category, same recipe,
 * same chain table, differing only in which row is highlighted. Sitemapping all
 * 2,652 would ask the crawler to index thousands of pages of overlapping content
 * and split the ranking signal across each chain. The roots are the canonical
 * entry points (they're what the list page links to); the upper tiers stay
 * crawlable via the chain table on the root's page and self-canonicalise, they
 * just don't get advertised. Well under the 50k URL cap either way — this is a
 * quality call, not a size one.
 */
function codexRoutes(): MetadataRoute.Sitemap {
  const catalogFetched = new Date(catalogMeta.fetchedAt)
  const referenceFetched = new Date(referenceMeta.fetchedAt)

  const lists = [
    { path: '/codex', lastModified: catalogFetched },
    { path: '/codex/items', lastModified: catalogFetched },
    { path: '/codex/modules', lastModified: catalogFetched },
    { path: '/codex/recipes', lastModified: catalogFetched },
    { path: '/codex/ships', lastModified: catalogFetched },
    { path: '/codex/skills', lastModified: referenceFetched },
    { path: '/codex/facilities', lastModified: referenceFetched },
    { path: '/codex/achievements', lastModified: referenceFetched },
  ].map(({ path, lastModified }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    // The codex index is a section landing page; the five catalogs sit below it.
    priority: path === '/codex' ? 0.7 : 0.6,
  }))

  const detail = (
    prefix: string,
    ids: string[],
    lastModified: Date,
  ): MetadataRoute.Sitemap =>
    ids.map((id) => ({
      url: `${SITE_URL}${prefix}/${encodeURIComponent(id)}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    }))

  return [
    ...lists,
    ...detail('/codex/items', allNonModuleItems().map((i) => i.id), catalogFetched),
    ...detail('/codex/modules', allModules().map((m) => m.id), catalogFetched),
    ...detail('/codex/recipes', allRecipes().map((r) => r.id), catalogFetched),
    ...detail('/codex/ships', listableShips().map((s) => s.id), catalogFetched),
    ...detail('/codex/skills', allSkills().map((s) => s.id), referenceFetched),
    ...detail('/codex/facilities', allChains().map((c) => c.root.id), referenceFetched),
    ...detail(
      '/codex/achievements',
      [...allAchievements(), ...allFactionAchievements()].map((a) => a.id),
      referenceFetched,
    ),
  ]
}
