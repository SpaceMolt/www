import { describe, expect, it } from 'bun:test'
import { EMPIRE_ACCENT, emblemSrc } from './publicAchievements'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('publicAchievements EMPIRE_ACCENT', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_ACCENT))
  })
})

describe('achievement image revisions', () => {
  it('uses the repaired Maiden Jump asset for website and social cards', () => {
    expect(emblemSrc('maiden_jump')).toBe('https://assets.spacemolt.com/images/achievements/maiden_jump-v2.webp')
    expect(emblemSrc('maiden_jump', 'og.png')).toBe('https://assets.spacemolt.com/images/achievements/maiden_jump-v2.og.png')
  })

  it('preserves existing URLs for other achievements', () => {
    expect(emblemSrc('first_blood')).toBe('https://assets.spacemolt.com/images/achievements/first_blood.webp')
    expect(emblemSrc('first_blood', 'og.png')).toBe('https://assets.spacemolt.com/images/achievements/first_blood.og.png')
  })
})
