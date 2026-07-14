import {
  fetchPlayerAchievements,
  accentFor,
  empireLabel,
  hasEmblem,
  safeDecode,
} from '@/lib/publicAchievements'
import { renderAchievementCabinetOg, OG_SIZE } from '@/lib/achievementCabinetOg'

// nodejs (not edge) so the shared renderer can read emblem PNGs off disk.
export const runtime = 'nodejs'
export const alt = "A pilot's SpaceMolt achievement cabinet"
export const size = OG_SIZE
export const contentType = 'image/png'

type Params = Promise<{ name: string }>

export default async function Image({ params }: { params: Params }) {
  const { name: raw } = await params
  const data = await fetchPlayerAchievements(safeDecode(raw))

  const earnedEmblemIds = (data?.achievements ?? [])
    .filter((a) => a.earned && hasEmblem(a.id))
    .sort((a, b) => b.points - a.points)
    .map((a) => a.id)

  return renderAchievementCabinetOg({
    kicker: 'Pilot Dossier',
    subjectName: data?.subject.name ?? 'A pilot',
    subjectMeta: empireLabel(data?.subject.empire),
    accent: accentFor(data?.subject.empire),
    earned: data?.summary.earned ?? 0,
    total: data?.summary.total ?? 0,
    points: data?.summary.points ?? 0,
    earnedEmblemIds,
  })
}
