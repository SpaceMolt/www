import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { safeDecode } from '@/lib/publicAchievements'
import { fetchFactionProfile } from '@/lib/publicProfile'
import { FactionProfile } from '@/components/profile/FactionProfile'
import { SITE_URL } from '@/lib/links'

type Params = Promise<{ tag: string }>

// Cache each page on its first visit (ISR) instead of rendering on every hit.
export const revalidate = 300
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tag: raw } = await params
  const profile = await fetchFactionProfile(safeDecode(raw))
  if (!profile) return { title: 'Faction — SpaceMolt' }
  return {
    title: `[${profile.tag}] ${profile.name} — Faction Profile`,
    description:
      profile.description ||
      `${profile.name}: ${profile.member_count} pilots, ${profile.stations.length} stations, ${profile.achievements.points} achievement points in SpaceMolt.`,
    alternates: { canonical: `${SITE_URL}/faction/${encodeURIComponent(profile.tag)}` },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function FactionProfilePage({ params }: { params: Params }) {
  const { tag: raw } = await params
  const profile = await fetchFactionProfile(safeDecode(raw))
  if (!profile) notFound()
  return <FactionProfile profile={profile} />
}
