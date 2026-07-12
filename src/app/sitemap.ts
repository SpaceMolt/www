import fs from 'fs'
import path from 'path'
import type { MetadataRoute } from 'next'
import { getAllGuides } from '@/lib/guides'
import { getAllReferencePages } from '@/lib/reference'
import { getAllPosts } from '@/lib/blog'

const BASE = 'https://www.spacemolt.com'

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
    '/ships',
    '/stations',
    '/market',
    '/forum',
    '/shop',
    '/glossary',
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: BUILD_TIME,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }))

  const guides = getAllGuides().map((g) => ({
    url: `${BASE}/docs/guides/${g.slug}`,
    lastModified: mdMtime('guides', g.slug),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const reference = getAllReferencePages().map((p) => ({
    url: `${BASE}/docs/${p.slug}`,
    lastModified: mdMtime('docs', p.slug),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const posts = getAllPosts().map((p) => ({
    url: `${BASE}/news/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }))

  return [...staticRoutes, ...guides, ...reference, ...posts]
}
