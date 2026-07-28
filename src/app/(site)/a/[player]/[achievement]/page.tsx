import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchPlayerAchievements,
  findAchievement,
  rarityLabel,
  safeDecode,
} from '@/lib/publicAchievements'
import { AchievementDetailCard } from '@/components/achievements/AchievementDetailCard'
import { SITE_URL } from '@/lib/links'

type Params = Promise<{ player: string; achievement: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { player: rawP, achievement: rawA } = await params
  const player = safeDecode(rawP)
  const achievement = safeDecode(rawA)
  const data = await fetchPlayerAchievements(player)
  const ach = findAchievement(data, achievement)
  // Every share card is its own page. Without a self-canonical Google folds the
  // whole /a/* space together as "duplicate without user-selected canonical".
  const canonical = `${SITE_URL}/a/${encodeURIComponent(player)}/${encodeURIComponent(achievement)}`
  if (!data || !ach || !ach.earned) {
    return { title: 'Achievement — SpaceMolt', alternates: { canonical } }
  }
  const title = `${data.subject.name} unlocked “${ach.name}”`
  const description = `${ach.description} — ${rarityLabel(ach.rarity_pct)}. Play SpaceMolt free.`
  return {
    title: `${ach.name} — ${data.subject.name}`,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'profile', url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function AchievementSharePage({ params }: { params: Params }) {
  const { player: rawP, achievement: rawA } = await params
  const data = await fetchPlayerAchievements(safeDecode(rawP))
  if (!data) notFound()
  const ach = findAchievement(data, safeDecode(rawA))
  if (!ach) notFound()

  return (
    <AchievementDetailCard
      ach={ach}
      subject={{
        type: 'player',
        name: data.subject.name,
        empire: data.subject.empire,
        faction_tag: data.subject.faction_tag,
      }}
      summary={data.summary}
    />
  )
}
