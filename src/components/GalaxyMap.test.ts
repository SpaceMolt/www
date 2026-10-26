import { describe, it, expect } from 'bun:test'
import { EMPIRE_NAMES, publicPOIPresentation } from './GalaxyMap'
import { layoutMobileBaseMarkers, mobileBaseColor, mobileBaseFanOffset, mobileBaseMarkerAt } from './mobileBaseMarkers'
import type { PublicMobileBase } from '@/lib/mobileBases'
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

describe('mobile base markers', () => {
  const systems: Record<string, { x: number; y: number }> = {
    a: { x: 0, y: 0 },
    b: { x: 100, y: 0 },
  }
  const systemPosition = (id: string) => systems[id]
  const identity = (x: number, y: number) => ({ x, y })
  const base = (over: Partial<PublicMobileBase>): PublicMobileBase => ({
    base_id: 'base_1',
    name: 'Civitas',
    kind: 'faction',
    wrecked: false,
    ...over,
  })

  it('places a lone parked base up-right of its system', () => {
    const { dx, dy } = mobileBaseFanOffset(0, 1, 10)
    expect(dx).toBeCloseTo(10 / Math.SQRT2)
    expect(dy).toBeCloseTo(-10 / Math.SQRT2)
  })

  it('fans out bases parked at one system so they do not overlap', () => {
    const [m1, m2] = layoutMobileBaseMarkers(
      [base({ base_id: 'x', system_id: 'a' }), base({ base_id: 'y', system_id: 'a' })],
      null,
      systemPosition,
      identity,
      20,
    )
    expect(Math.hypot(m1.x - m2.x, m1.y - m2.y)).toBeGreaterThan(10)
    expect(Math.hypot(m1.x, m1.y)).toBeCloseTo(20)
    expect(m1).toMatchObject({ anchorX: 0, anchorY: 0, jumping: false })
  })

  it('puts a jumping base on the lane, anchored to its destination', () => {
    const [m] = layoutMobileBaseMarkers(
      [base({ from_system: 'a', to_system: 'b', start_tick: 100, arrival_tick: 200 })],
      150,
      systemPosition,
      identity,
      20,
    )
    expect(m).toMatchObject({ y: 0, anchorX: 100, anchorY: 0, jumping: true, angle: 0 })
    expect(m.x).toBeGreaterThan(0)
    expect(m.x).toBeLessThan(100)
  })

  it('leaves jumping bases out until the tick is known, and skips unknown systems', () => {
    expect(
      layoutMobileBaseMarkers(
        [base({ from_system: 'a', to_system: 'b', start_tick: 1, arrival_tick: 2 }), base({ system_id: 'zz' })],
        null,
        systemPosition,
        identity,
        20,
      ),
    ).toEqual([])
  })

  it('hit-tests the closest marker within the radius', () => {
    const markers = layoutMobileBaseMarkers(
      [base({ base_id: 'x', system_id: 'a' }), base({ base_id: 'y', system_id: 'b' })],
      null,
      systemPosition,
      identity,
      0,
    )
    expect(mobileBaseMarkerAt(markers, 98, 1, 5)?.base.base_id).toBe('y')
    expect(mobileBaseMarkerAt(markers, 50, 0, 5)).toBeNull()
  })

  it('colors by owner, then capital empire color, then cyan, and greys wrecks', () => {
    expect(mobileBaseColor(base({ faction_color: '#ff0000' }), '#00ff00')).toBe('#ff0000')
    expect(mobileBaseColor(base({ kind: 'capital' }), '#2dd4bf')).toBe('#2dd4bf')
    expect(mobileBaseColor(base({}), '#2dd4bf')).toBe('#00FFFF')
    expect(mobileBaseColor(base({ wrecked: true, faction_color: '#ff0000' }))).toBe('#6b7280')
  })
})
