import {
  fetchFactionAchievements,
  accentFor,
  hasEmblem,
  safeDecode,
} from '@/lib/publicAchievements'
import { renderAchievementCabinetOg, OG_SIZE } from '@/lib/achievementCabinetOg'

// nodejs (not edge) so the shared renderer can read emblem PNGs off disk.
export const runtime = 'nodejs'
export const alt = "A faction's SpaceMolt achievement cabinet"
export const size = OG_SIZE
export const contentType = 'image/png'

type Params = Promise<{ tag: string }>

export default async function Image({ params }: { params: Params }) {
  const { tag: raw } = await params
  const data = await fetchFactionAchievements(safeDecode(raw))

  const earnedEmblemIds = (data?.achievements ?? [])
    .filter((a) => a.earned && hasEmblem(a.id))
    .sort((a, b) => b.points - a.points)
    .map((a) => a.id)

  return renderAchievementCabinetOg({
    kicker: 'Faction Dossier',
    subjectName: data?.subject.name ?? 'A faction',
    subjectMeta: data?.subject.faction_tag ? `[${data.subject.faction_tag}]` : 'FACTION',
    accent: accentFor(undefined),
    earned: data?.summary.earned ?? 0,
    total: data?.summary.total ?? 0,
    points: data?.summary.points ?? 0,
    earnedEmblemIds,
  })
}
