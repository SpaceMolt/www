import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchFactionAchievements, safeDecode } from '@/lib/publicAchievements'
import { AchievementCabinet } from '@/components/achievements/AchievementCabinet'
import { SITE_URL } from '@/lib/links'

type Params = Promise<{ tag: string }>

// Rendered per request, not ISR: there are players x achievements of these URLs, so
// crawlers made every visit an ISR write. The hourly fetch cache in
// publicAchievements is per player, so all of a player's pages share one entry.

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tag: raw } = await params
  const data = await fetchFactionAchievements(safeDecode(raw))
  if (!data) return { title: 'Faction — SpaceMolt' }
  const title = `${data.subject.name} — Faction Achievements`
  const description = `${data.subject.name} [${data.subject.faction_tag}] has unlocked ${data.summary.earned} of ${data.summary.total} faction achievements in SpaceMolt.`
  const canonical = `${SITE_URL}/faction/${encodeURIComponent(
    data.subject.faction_tag || safeDecode(raw),
  )}/achievements`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'profile', url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function FactionAchievementsPage({ params }: { params: Params }) {
  const { tag: raw } = await params
  const data = await fetchFactionAchievements(safeDecode(raw))
  if (!data) notFound()
  const tag = data.subject.faction_tag || safeDecode(raw)
  return (
    <AchievementCabinet
      data={data}
      shareHref={(id) => `/faction/${encodeURIComponent(tag)}/achievements/${id}`}
    />
  )
}
