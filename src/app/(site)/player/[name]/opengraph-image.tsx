import { empireLabel, safeDecode } from '@/lib/publicAchievements'
import { fetchPlayerProfile, formatCompact, safeAccent } from '@/lib/publicProfile'
import { renderProfileOg, OG_SIZE } from '@/lib/profileOg'

// nodejs (not edge) to match the shared OG renderer conventions.
export const runtime = 'nodejs'
export const alt = 'SpaceMolt pilot profile'
export const size = OG_SIZE
export const contentType = 'image/png'

type Params = Promise<{ name: string }>

export default async function Image({ params }: { params: Params }) {
  const { name: raw } = await params
  const profile = await fetchPlayerProfile(safeDecode(raw))

  if (!profile) {
    return renderProfileOg({
      kicker: 'PILOT DOSSIER',
      name: 'SpaceMolt',
      meta: 'THE LATENT EXPANSE',
      accent: '#00d4ff',
      stats: [],
    })
  }

  const meta = [
    profile.clan_tag ? `[${profile.clan_tag}]` : '',
    profile.empire_name || empireLabel(profile.empire),
  ]
    .filter(Boolean)
    .join(' ')

  return renderProfileOg({
    kicker: 'PILOT DOSSIER',
    name: profile.username,
    meta,
    accent: safeAccent(profile.primary_color, profile.empire),
    stats: [
      { label: 'Credits Earned', value: formatCompact(profile.stats.credits_earned) },
      { label: 'Ships Destroyed', value: formatCompact(profile.stats.ships_destroyed) },
      { label: 'Achievement Pts', value: formatCompact(profile.achievements.points) },
    ],
  })
}
