import { getItem } from '@/data/catalog'

/**
 * Deposit richness cut points (10th, 30th, 70th and 90th percentile) per item rarity, measured over
 * every deposit in the galaxy data on 2026-11-09. Rarity sets the scale: a rich helium ice deposit
 * is poor water ice. A new resource takes its rarity's scale from the catalog.
 */
const CUTS: Record<string, readonly [number, number, number, number]> = {
  common: [24, 34, 49, 61],
  uncommon: [16, 21, 30, 40],
  rare: [9, 13, 19, 24],
  exotic: [4, 5, 17, 25],
  legendary: [2, 5, 11, 19],
}

export const RICHNESS_LEVELS = ['Very poor', 'Poor', 'Average', 'Rich', 'Exceptional'] as const

/** Rate a deposit 0 (very poor) to 4 (exceptional) against deposits of the same rarity. */
export function rateRichness(itemId: string, richness: number) {
  const rarity = getItem(itemId)?.rarity ?? 'common'
  const level = (CUTS[rarity] ?? CUTS.common).filter((cut) => richness >= cut).length
  return { level, label: RICHNESS_LEVELS[level], rarity }
}

/** Hover text with the numbers the row leaves out. Richness is a yield percentage, not an amount. */
export function depositTitle(itemId: string, richness: number, remaining?: number): string {
  const { label, rarity } = rateRichness(itemId, richness)
  const left = remaining === undefined ? '' : remaining < 0 ? ', never runs out' : `, ${remaining.toLocaleString()} units left`
  return `${label} for a ${rarity} resource: ${richness}% yield per mining action${left}`
}
