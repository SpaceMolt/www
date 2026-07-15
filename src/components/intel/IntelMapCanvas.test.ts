import { describe, it, expect } from 'bun:test'
import {
  EMPIRE_NAMES,
  buildTrailFocus,
  getStationRingStyle,
  isConnectionTrailFocused,
  shouldDimSystemForTrailFocus,
  shouldShowSystemLabel,
} from './IntelMapCanvas'
import { CANONICAL_EMPIRE_FULL_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'
import type { PublicStation, TrailSegment, TransitMarker } from '@/lib/intelTypes'

describe('IntelMapCanvas EMPIRE_NAMES', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_NAMES))
  })

  it('matches the canonical full empire names from en.json for every empire', () => {
    for (const [id, canonicalName] of Object.entries(CANONICAL_EMPIRE_FULL_NAMES)) {
      expect(EMPIRE_NAMES[id]).toBe(canonicalName)
    }
  })
})

describe('IntelMapCanvas label policy', () => {
  it('hides every canvas label when the names layer is disabled', () => {
    expect(shouldShowSystemLabel(false, false, true, 4, 1)).toBe(false)
  })

  it('leaves the hover tooltip as the only name shown while hovering', () => {
    expect(shouldShowSystemLabel(true, true, false, 0, 1)).toBe(false)
    expect(shouldShowSystemLabel(true, true, true, 4, 1)).toBe(false)
  })

  it('keeps selected, occupied, and close-zoom labels when names are enabled', () => {
    expect(shouldShowSystemLabel(true, false, true, 0, 0.01)).toBe(true)
    expect(shouldShowSystemLabel(true, false, false, 1, 0.05)).toBe(true)
    expect(shouldShowSystemLabel(true, false, false, 0, 0.16)).toBe(true)
    expect(shouldShowSystemLabel(true, false, false, 0, 0.1)).toBe(false)
  })
})

describe('IntelMapCanvas trail focus', () => {
  const trails: TrailSegment[] = [
    { agentId: 'agent-1', color: '#00d4ff', from: 'a', to: 'b', age: 0 },
    { agentId: 'agent-1', color: '#00d4ff', from: 'b', to: 'a', age: 0.5 },
  ]
  const transits: TransitMarker[] = [
    { agentId: 'agent-2', from: 'b', to: 'c', startTick: 10, arrivalTick: 20 },
  ]

  it('focuses trail and active-transit endpoints with undirected connections', () => {
    const focus = buildTrailFocus(trails, transits)
    expect([...focus.systems].sort()).toEqual(['a', 'b', 'c'])
    expect(isConnectionTrailFocused(focus.connections, 'a', 'b')).toBe(true)
    expect(isConnectionTrailFocused(focus.connections, 'b', 'a')).toBe(true)
    expect(isConnectionTrailFocused(focus.connections, 'b', 'c')).toBe(true)
    expect(isConnectionTrailFocused(focus.connections, 'a', 'c')).toBe(false)
  })

  it('dims off-trail systems while keeping hover and selection inspectable', () => {
    const focus = buildTrailFocus(trails, transits)
    expect(shouldDimSystemForTrailFocus(true, focus.systems, 'outside', false, false)).toBe(true)
    expect(shouldDimSystemForTrailFocus(true, focus.systems, 'outside', true, false)).toBe(false)
    expect(shouldDimSystemForTrailFocus(true, focus.systems, 'outside', false, true)).toBe(false)
    expect(shouldDimSystemForTrailFocus(true, focus.systems, 'a', false, false)).toBe(false)
    expect(shouldDimSystemForTrailFocus(false, focus.systems, 'outside', false, false)).toBe(false)
  })

  it('deliberately leaves the whole topology low-profile when no trail is in the window', () => {
    const focus = buildTrailFocus([], [])
    expect(shouldDimSystemForTrailFocus(true, focus.systems, 'a', false, false)).toBe(true)
    expect(isConnectionTrailFocused(focus.connections, 'a', 'b')).toBe(false)
  })
})

describe('IntelMapCanvas station circles', () => {
  it('preserves the system node color and distinguishes faction ownership with a dashed ring', () => {
    const factionStation = { faction_id: 'faction-1', faction_color: '#ff3355' } as PublicStation
    const npcStation = {} as PublicStation
    expect(getStationRingStyle([factionStation], '#66ccff')).toEqual({
      color: '#ff3355',
      dashed: true,
    })
    expect(getStationRingStyle([npcStation], '#66ccff')).toEqual({
      color: '#66ccff',
      dashed: false,
    })
  })

  it('derives a stable green-to-teal fallback from an uncolored faction id', () => {
    const uncoloredFaction = { faction_id: 'faction-without-color' } as PublicStation
    const anotherFaction = { faction_id: 'another-faction' } as PublicStation
    const first = getStationRingStyle([uncoloredFaction], '#5a6a7a')
    const repeated = getStationRingStyle([uncoloredFaction], '#5a6a7a')
    const another = getStationRingStyle([anotherFaction], '#5a6a7a')

    expect(first).toEqual(repeated)
    expect(first.dashed).toBe(true)
    expect(first.color).not.toBe(another.color)

    // Canonical empire hues: Solarian yellow, Voidborn purple, Crimson red,
    // Nebula cyan, and Outer Rim teal. Generated faction hues stay visibly
    // separated from every one, including the nearest two bounding this band.
    const empireHues = [51, 283, 355, 190, 172]
    const generatedHues = Array.from({ length: 256 }, (_, index) => {
      const color = getStationRingStyle(
        [{ faction_id: `faction-${index}` } as PublicStation],
        '#5a6a7a',
      ).color
      return Number(color.match(/^hsl\((\d+)/)?.[1])
    })
    const minimumEmpireDistance = Math.min(
      ...generatedHues.flatMap((hue) =>
        empireHues.map((empireHue) => {
          const directDistance = Math.abs(hue - empireHue)
          return Math.min(directDistance, 360 - directDistance)
        }),
      ),
    )
    expect(Math.min(...generatedHues)).toBeGreaterThanOrEqual(90)
    expect(Math.max(...generatedHues)).toBeLessThanOrEqual(135)
    expect(minimumEmpireDistance).toBeGreaterThanOrEqual(35)
  })
})
