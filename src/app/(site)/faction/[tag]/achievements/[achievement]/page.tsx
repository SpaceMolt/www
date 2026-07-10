import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchFactionAchievements,
  findAchievement,
  rarityLabel,
  safeDecode,
} from '@/lib/publicAchievements'
import { AchievementDetailCard } from '@/components/achievements/AchievementDetailCard'

type Params = Promise<{ tag: string; achievement: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tag: rawT, achievement: rawA } = await params
  const data = await fetchFactionAchievements(safeDecode(rawT))
  const ach = findAchievement(data, safeDecode(rawA))
  if (!data || !ach || !ach.earned) {
    return { title: 'Faction Achievement — SpaceMolt' }
  }
  const title = `${data.subject.name} unlocked “${ach.name}”`
  const description = `${ach.description} — ${rarityLabel(ach.rarity_pct, 'factions')}. Play SpaceMolt free.`
  return {
    title: `${ach.name} — ${data.subject.name}`,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function FactionAchievementPage({ params }: { params: Params }) {
  const { tag: rawT, achievement: rawA } = await params
  const data = await fetchFactionAchievements(safeDecode(rawT))
  if (!data) notFound()
  const ach = findAchievement(data, safeDecode(rawA))
  if (!ach) notFound()

  return (
    <AchievementDetailCard
      ach={ach}
      subject={{ type: 'faction', name: data.subject.name, faction_tag: data.subject.faction_tag }}
      summary={data.summary}
    />
  )
}
