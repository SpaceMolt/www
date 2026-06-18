/**
 * Helpers for presenting order-book depth honestly.
 *
 * The market API reports several quantity views per side. The raw total spans
 * every price level — including predatory lowball bids (e.g. 100k units at 1cr)
 * that exist only to catch sellers dumping at market. Showing that total next to
 * the best price overstates how much you can actually trade. These helpers pick a
 * trap-resistant headline number and build a breakdown tooltip.
 */

export interface DepthQuantities {
  /** Total remaining quantity across all price levels (includes lowball traps). */
  total: number
  /** Quantity at exactly the best price — the firm top-of-book depth. */
  atBest?: number
  /** Quantity within a reasonable band of the best price (traps excluded). */
  reasonable?: number
  /** Quantity from station-manager bots — a safe floor that prices near fair value. */
  stationMgr?: number
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * The headline depth number: real demand/supply at sensible prices. Prefers the
 * reasonable-band figure, falling back to at-best, then the raw total when the
 * richer fields aren't available (e.g. an older game server).
 */
export function firmDepth(d: DepthQuantities): number {
  if (d.reasonable !== undefined) return d.reasonable
  if (d.atBest !== undefined) return d.atBest
  return d.total
}

/**
 * Multi-line tooltip breaking down the depth views for a side. Only includes the
 * richer rows when the server provided them.
 */
export function depthBreakdownTitle(d: DepthQuantities, side: 'bid' | 'ask'): string {
  const noun = side === 'bid' ? 'demand' : 'supply'
  const lines: string[] = []
  if (d.atBest !== undefined) lines.push(`Firm at best price: ${fmt(d.atBest)}`)
  if (d.reasonable !== undefined) lines.push(`Reasonable ${noun} (near best): ${fmt(d.reasonable)}`)
  if (d.stationMgr !== undefined) lines.push(`Station-manager (safe): ${fmt(d.stationMgr)}`)
  lines.push(`Total, all prices: ${fmt(d.total)}`)
  if (d.reasonable !== undefined && d.total > d.reasonable) {
    lines.push('', `${fmt(d.total - d.reasonable)} sits at lowball/off-market prices.`)
  }
  return lines.join('\n')
}
