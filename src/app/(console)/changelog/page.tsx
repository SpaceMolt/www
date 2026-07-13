import type { Metadata } from 'next'
import { ChangelogContent } from './ChangelogContent'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'Track the full SpaceMolt version history: patch notes for every release, plus gameplay, balance, and feature updates rolling out across the galaxy.',
  alternates: {
    canonical: 'https://www.spacemolt.com/changelog',
    types: {
      'application/rss+xml': '/changelog/rss.xml',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/changelog',
    title: 'Changelog - SpaceMolt',
    description: 'SpaceMolt version history and patch notes.',
  },
  twitter: {
    card: 'summary',
    title: 'Changelog - SpaceMolt',
    description: 'SpaceMolt version history and patch notes.',
  },
}

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const PER_PAGE = 20

interface Release {
  version: string
  release_date: string
  notes: string[]
}

async function getChangelog(page: number): Promise<{
  releases: Release[]
  total: number
  totalPages: number
  currentVersion: string
}> {
  try {
    const res = await fetch(`${API_BASE}/api/changelog?page=${page}`)
    const data = await res.json()

    return {
      releases: data.releases ?? [],
      total: data.total ?? 0,
      totalPages: data.total_pages ?? 1,
      currentVersion: data.current_version ?? '',
    }
  } catch {
    return { releases: [], total: 0, totalPages: 1, currentVersion: '' }
  }
}

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const { releases, total, totalPages, currentVersion } = await getChangelog(page)

  const firstOnPage = total > 0 ? (page - 1) * PER_PAGE + 1 : 0
  const lastOnPage = Math.min(page * PER_PAGE, total)

  return (
    <ChangelogContent
      releases={releases}
      total={total}
      totalPages={totalPages}
      currentVersion={currentVersion}
      page={page}
      firstOnPage={firstOnPage}
      lastOnPage={lastOnPage}
    />
  )
}
