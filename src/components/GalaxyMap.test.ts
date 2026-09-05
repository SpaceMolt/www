import { describe, it, expect } from 'bun:test'
import { EMPIRE_NAMES, publicPOIPresentation } from './GalaxyMap'
import { CANONICAL_EMPIRE_FULL_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('GalaxyMap EMPIRE_NAMES', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_NAMES))
  })

  it('matches the canonical full empire names from en.json for every empire', () => {
    for (const [id, canonicalName] of Object.entries(CANONICAL_EMPIRE_FULL_NAMES)) {
      expect(EMPIRE_NAMES[id]).toBe(canonicalName)
    }
  })
})

describe('publicPOIPresentation', () => {
  it('presents a BH-class sun as a black hole', () => {
    expect(publicPOIPresentation({ type: 'sun', class: 'BH' })).toMatchObject({
      icon: 'BH',
      typeLabel: 'Black Hole',
    })
  })

  it('includes an ordinary star spectral class', () => {
    expect(publicPOIPresentation({ type: 'sun', class: 'G2V' })).toMatchObject({
      icon: 'S',
      typeLabel: 'Star · G2V',
    })
  })

  it('humanizes a planet class', () => {
    expect(publicPOIPresentation({ type: 'planet', class: 'super_terran' })).toMatchObject({
      icon: 'P',
      typeLabel: 'Planet · Super Terran',
    })
  })

  it('falls back to Star when a sun has no class', () => {
    expect(publicPOIPresentation({ type: 'sun' }).typeLabel).toBe('Star')
  })

  it('falls back to Planet when a planet has no class', () => {
    expect(publicPOIPresentation({ type: 'planet' }).typeLabel).toBe('Planet')
  })
})
