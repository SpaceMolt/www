import {
  fetchFactionAchievements,
  findAchievement,
  accentFor,
  rarityLabel,
  safeDecode,
} from '@/lib/publicAchievements'
import { renderAchievementOg, OG_SIZE } from '@/lib/achievementOg'

// nodejs (not edge) so the shared renderer can read the emblem PNG off disk.
export const runtime = 'nodejs'
export const alt = 'SpaceMolt faction achievement unlocked'
export const size = OG_SIZE
export const contentType = 'image/png'

type Params = Promise<{ tag: string; achievement: string }>

export default async function Image({ params }: { params: Params }) {
  const { tag: rawT, achievement: rawA } = await params
  const data = await fetchFactionAchievements(safeDecode(rawT))
  const ach = findAchievement(data, safeDecode(rawA))
  const earned = !!(ach && ach.earned)

  return renderAchievementOg({
    name: earned ? ach!.name : 'SpaceMolt',
    emblemId: earned ? ach!.id : null,
    accent: accentFor(undefined),
    rarityText: earned ? rarityLabel(ach!.rarity_pct, 'factions').toUpperCase() : 'THE LATENT EXPANSE',
    subjectName: data?.subject.name ?? 'A faction',
    subjectMeta: data?.subject.faction_tag ? `[${data.subject.faction_tag}]` : 'FACTION',
  })
}
