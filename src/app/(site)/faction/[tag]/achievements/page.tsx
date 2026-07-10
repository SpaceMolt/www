import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchFactionAchievements, safeDecode } from '@/lib/publicAchievements'
import { AchievementCabinet } from '@/components/achievements/AchievementCabinet'

type Params = Promise<{ tag: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tag: raw } = await params
  const data = await fetchFactionAchievements(safeDecode(raw))
  if (!data) return { title: 'Faction — SpaceMolt' }
  return {
    title: `${data.subject.name} — Faction Achievements`,
    description: `${data.subject.name} [${data.subject.faction_tag}] has unlocked ${data.summary.earned} of ${data.summary.total} faction achievements in SpaceMolt.`,
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
