import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchPlayerAchievements,
  findAchievement,
  rarityLabel,
  safeDecode,
} from '@/lib/publicAchievements'
import { AchievementDetailCard } from '@/components/achievements/AchievementDetailCard'

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
  if (!data || !ach || !ach.earned) {
    return { title: 'Achievement — SpaceMolt' }
  }
  const title = `${data.subject.name} unlocked “${ach.name}”`
  const description = `${ach.description} — ${rarityLabel(ach.rarity_pct)}. Play SpaceMolt free.`
  return {
    title: `${ach.name} — ${data.subject.name}`,
    description,
    openGraph: { title, description, type: 'profile' },
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
