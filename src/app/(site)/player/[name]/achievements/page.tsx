import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchPlayerAchievements, safeDecode } from '@/lib/publicAchievements'
import { AchievementCabinet } from '@/components/achievements/AchievementCabinet'
import { SITE_URL } from '@/lib/links'

type Params = Promise<{ name: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name: raw } = await params
  const data = await fetchPlayerAchievements(safeDecode(raw))
  if (!data) return { title: 'Pilot — SpaceMolt' }
  const title = `${data.subject.name}’s Achievements`
  const description = `${data.subject.name} has unlocked ${data.summary.earned} of ${data.summary.total} achievements (${data.summary.points} points) in SpaceMolt.`
  const canonical = `${SITE_URL}/player/${encodeURIComponent(data.subject.name)}/achievements`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'profile', url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PlayerAchievementsPage({ params }: { params: Params }) {
  const { name: raw } = await params
  const data = await fetchPlayerAchievements(safeDecode(raw))
  if (!data) notFound()
  return (
    <AchievementCabinet
      data={data}
      shareHref={(id) => `/a/${encodeURIComponent(data.subject.name)}/${id}`}
    />
  )
}
