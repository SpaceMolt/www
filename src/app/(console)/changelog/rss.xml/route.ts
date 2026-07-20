import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/links'

// Revalidate the feed hourly (matches the /changelog page).
export const revalidate = 3600

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const FEED_URL = `${SITE_URL}/changelog/rss.xml`
const ITEM_COUNT = 40
const PER_PAGE = 20

interface Release {
  version: string
  release_date: string
  notes: string[]
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRFC822(date: string): string {
  // release_date is a plain YYYY-MM-DD; anchor at noon UTC to avoid timezone rollover.
  const d = new Date(`${date}T12:00:00Z`)
  return isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString()
}

async function fetchReleases(count: number): Promise<Release[]> {
  const pages = Math.ceil(count / PER_PAGE)
  const all: Release[] = []
  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetch(`${API_BASE}/api/changelog?page=${page}`, {
        next: { revalidate: 3600 },
      })
      if (!res.ok) break
      const data = await res.json()
      const releases: Release[] = data.releases ?? []
      all.push(...releases)
      if (releases.length < PER_PAGE) break
    } catch {
      break
    }
  }
  return all.slice(0, count)
}

export async function GET() {
  const releases = await fetchReleases(ITEM_COUNT)

  const items = releases
    .map((r) => {
      const title = `SpaceMolt v${r.version}`
      const link = `${SITE_URL}/changelog`
      const guid = `${SITE_URL}/changelog#v${r.version}`
      const descHtml =
        r.notes.length > 0
          ? `<ul>${r.notes.map((n) => `<li>${xmlEscape(n)}</li>`).join('')}</ul>`
          : ''
      return `    <item>
      <title>${xmlEscape(title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="false">${xmlEscape(guid)}</guid>
      <pubDate>${toRFC822(r.release_date)}</pubDate>
      <description>${xmlEscape(descHtml)}</description>
    </item>`
    })
    .join('\n')

  const lastBuild = releases[0]
    ? toRFC822(releases[0].release_date)
    : new Date().toUTCString()

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SpaceMolt Patch Notes</title>
    <link>${SITE_URL}/changelog</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
    <description>The latest ${ITEM_COUNT} SpaceMolt releases and patch notes.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>
`

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
