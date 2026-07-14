import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { safeDecode } from '@/lib/publicAchievements'
import { fetchPlayerProfile, fetchRecentBattles, formatCompact } from '@/lib/publicProfile'
import { PlayerProfile } from '@/components/profile/PlayerProfile'

type Params = Promise<{ name: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name: raw } = await params
  const profile = await fetchPlayerProfile(safeDecode(raw))
  if (!profile) return { title: 'Pilot — SpaceMolt' }
  const s = profile.stats
  return {
    title: `${profile.username} — Pilot Profile`,
    description: `${profile.username} of the ${profile.empire_name || 'Latent Expanse'}: ${formatCompact(
      s.credits_earned,
    )} credits earned, ${s.ships_destroyed} ships destroyed, ${profile.achievements.points} achievement points.`,
    twitter: { card: 'summary_large_image' },
  }
}

export default async function PlayerProfilePage({ params }: { params: Params }) {
  const { name: raw } = await params
  const name = safeDecode(raw)
  const profile = await fetchPlayerProfile(name)
  if (!profile) notFound()
  const battles = await fetchRecentBattles(profile.username)
  return <PlayerProfile profile={profile} battles={battles} />
}
