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

/** Hours for a deposit to refill from empty, by rarity. Regeneration is linear (gameserver config/economy.go). */
const REFILL_HOURS: Record<string, number> = { common: 168, uncommon: 168, rare: 72, exotic: 48, legendary: 72 }

/** A coarse duration: we only promise the order of magnitude. */
const roughly = (hours: number) =>
  hours < 1 ? 'within the hour' : hours < 6 ? 'in a few hours' : hours < 36 ? 'in about a day' : `in about ${Math.round(hours / 24)} days`

/** How the deposit recovers: deposits refill at a steady rate toward their capacity. */
export function regenHint(itemId: string, remaining?: number, capacity?: number): string {
  if (remaining !== undefined && remaining < 0) return 'Never runs out.'
  const rarity = getItem(itemId)?.rarity ?? 'common'
  const refill = REFILL_HOURS[rarity] ?? REFILL_HOURS.common
  if (remaining === 0 || !capacity || remaining === undefined) return `Regenerates steadily; ${rarity} deposits refill from empty ${roughly(refill)}.`
  if (remaining >= capacity) return 'Full.'
  return `Regenerates steadily; back to full ${roughly(refill * (1 - remaining / capacity))}.`
}

const RICHNESS_LEVELS = ['Very poor', 'Poor', 'Average', 'Rich', 'Exceptional'] as const

/** Rate a deposit 0 (very poor) to 4 (exceptional) against deposits of the same rarity. */
export function rateRichness(itemId: string, richness: number) {
  const rarity = getItem(itemId)?.rarity ?? 'common'
  const level = (CUTS[rarity] ?? CUTS.common).filter((cut) => richness >= cut).length
  return { level, label: RICHNESS_LEVELS[level], rarity }
}

/** Hover text with the numbers the row leaves out. Richness is a yield percentage, not an amount. */
export function depositTitle(itemId: string, richness: number, remaining?: number, capacity?: number): string {
  const { label, rarity } = rateRichness(itemId, richness)
  const left = remaining === undefined || remaining < 0 ? '' : `, ${remaining.toLocaleString()} units left`
  return `${label} for a ${rarity} resource: ${richness}% yield per mining action${left}. ${regenHint(itemId, remaining, capacity)}`
}
