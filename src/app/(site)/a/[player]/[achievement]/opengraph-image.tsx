import {
  fetchPlayerAchievements,
  findAchievement,
  accentFor,
  empireLabel,
  rarityLabel,
  safeDecode,
} from '@/lib/publicAchievements'
import { renderAchievementOg, OG_SIZE } from '@/lib/achievementOg'

// nodejs (not edge) so the shared renderer can read the emblem PNG off disk.
export const runtime = 'nodejs'
export const alt = 'SpaceMolt achievement unlocked'
export const size = OG_SIZE
export const contentType = 'image/png'

type Params = Promise<{ player: string; achievement: string }>

export default async function Image({ params }: { params: Params }) {
  const { player: rawP, achievement: rawA } = await params
  const data = await fetchPlayerAchievements(safeDecode(rawP))
  const ach = findAchievement(data, safeDecode(rawA))
  const earned = !!(ach && ach.earned)

  return renderAchievementOg({
    name: earned ? ach!.name : 'SpaceMolt',
    emblemId: earned ? ach!.id : null,
    accent: accentFor(data?.subject.empire),
    rarityText: earned ? rarityLabel(ach!.rarity_pct).toUpperCase() : 'CRUSTACEAN COSMOS',
    subjectName: data?.subject.name ?? 'A pilot',
    subjectMeta: empireLabel(data?.subject.empire),
  })
}
