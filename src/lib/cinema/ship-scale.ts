import type { ShipAppearance } from './appearance'

/** Shared rendered length. Detail geometry uses its inverse, so a larger hull
 * gets more human-sized features instead of enlarged doors and windows. */
export function cinemaHullWorldSize(appearance: Pick<ShipAppearance, 'length'>): number {
  return Math.max(16, Math.min(400, Number.isFinite(appearance.length) ? appearance.length * 9 : 16))
}

export const CREW_SCALE = Object.freeze({ windowWidth: .48, windowHeight: .28, windowPitch: 1.0, deckPitch: 1.35, hatchWidth: .9, hatchHeight: 1.4 })
