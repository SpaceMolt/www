import { expect, test } from 'bun:test'
import { depositTitle, rateRichness, regenHint } from './richness'

test('rates richness against deposits of the same rarity', () => {
  // water_ice is common, helium_ice is rare: the same 24% reads very differently.
  expect(rateRichness('water_ice', 24).label).toBe('Poor')
  expect(rateRichness('helium_ice', 24).label).toBe('Exceptional')
  expect(rateRichness('water_ice', 10).label).toBe('Very poor')
  expect(rateRichness('water_ice', 55).label).toBe('Rich')
  expect(rateRichness('water_ice', 40).label).toBe('Average')
})

test('falls back to the common scale for an unknown item', () => {
  expect(rateRichness('not_a_real_item', 70).label).toBe('Exceptional')
})

test('puts the numbers and regeneration in the hover text', () => {
  expect(depositTitle('water_ice', 54, 302, 302)).toBe('Rich for a common resource: 54% yield per mining action, 302 units left. Full.')
  expect(depositTitle('water_ice', 54, 0, 1000)).toContain('0 units left. Regenerates steadily; common deposits refill from empty in about 7 days.')
})

test('estimates regeneration coarsely from the rarity refill time', () => {
  // Common refills in a week, exotic in two days; regeneration is linear.
  expect(regenHint('water_ice', 500, 1000)).toBe('Regenerates steadily; back to full in about 4 days.')
  expect(regenHint('water_ice', 990, 1000)).toBe('Regenerates steadily; back to full in a few hours.')
  expect(regenHint('helium_ice', 0)).toBe('Regenerates steadily; rare deposits refill from empty in about 3 days.')
  expect(regenHint('helium_ice', 40)).toBe('Regenerates steadily; rare deposits refill from empty in about 3 days.')
})
