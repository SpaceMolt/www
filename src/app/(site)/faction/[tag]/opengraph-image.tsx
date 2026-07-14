import { safeDecode } from '@/lib/publicAchievements'
import { fetchFactionProfile, formatCompact, safeAccent } from '@/lib/publicProfile'
import { renderProfileOg, OG_SIZE } from '@/lib/profileOg'

// nodejs (not edge) to match the shared OG renderer conventions.
export const runtime = 'nodejs'
export const alt = 'SpaceMolt faction profile'
export const size = OG_SIZE
export const contentType = 'image/png'

type Params = Promise<{ tag: string }>

export default async function Image({ params }: { params: Params }) {
  const { tag: raw } = await params
  const profile = await fetchFactionProfile(safeDecode(raw))

  if (!profile) {
    return renderProfileOg({
      kicker: 'FACTION DOSSIER',
      name: 'SpaceMolt',
      meta: 'THE LATENT EXPANSE',
      accent: '#00d4ff',
      stats: [],
    })
  }

  return renderProfileOg({
    kicker: 'FACTION DOSSIER',
    name: `[${profile.tag}] ${profile.name}`,
    meta: profile.leader ? `Led by ${profile.leader}` : 'The Latent Expanse',
    accent: safeAccent(profile.primary_color),
    stats: [
      { label: 'Pilots', value: formatCompact(profile.member_count) },
      { label: 'Stations', value: formatCompact(profile.stations.length) },
      { label: 'Achievement Pts', value: formatCompact(profile.achievements.points) },
    ],
  })
}
