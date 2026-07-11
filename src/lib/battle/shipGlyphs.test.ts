import { describe, it, expect } from 'bun:test'
import {
  CLASS_ARCHETYPES,
  GLYPH_NOSE_X,
  archetypeForShip,
  traceGlyphPath,
  type GlyphArchetype,
} from './shipGlyphs'

const ARCHETYPES: GlyphArchetype[] = [
  'fighter',
  'warship',
  'capital',
  'carrier',
  'hauler',
  'miner',
  'scout',
  'support',
  'drone',
  'creature',
]

describe('CLASS_ARCHETYPES', () => {
  it('maps every class to a valid archetype, with lowercase keys', () => {
    for (const [key, archetype] of Object.entries(CLASS_ARCHETYPES)) {
      expect(key).toBe(key.toLowerCase())
      expect(ARCHETYPES).toContain(archetype)
    }
  })
})

describe('archetypeForShip', () => {
  it('routes drones and creatures by kind, ignoring class', () => {
    expect(archetypeForShip('drone', undefined, undefined, 0)).toBe('drone')
    expect(archetypeForShip('creature', 'Fighter', 'Combat', 3)).toBe('creature')
  })

  it('matches classes case-insensitively', () => {
    expect(archetypeForShip('ship', 'Heavy Fighter', 'Combat', 2)).toBe('fighter')
    expect(archetypeForShip('ship', 'heavy fighter', 'combat', 2)).toBe('fighter')
    expect(archetypeForShip('ship', ' Miner ', 'Industrial', 1)).toBe('miner')
  })

  it('maps representative live classes to the expected silhouettes', () => {
    const cases: Array<[string, GlyphArchetype]> = [
      ['Fighter', 'fighter'],
      ['Interceptor', 'fighter'],
      ['Cruiser', 'warship'],
      ['Battlecruiser', 'warship'],
      ['Dreadnought', 'capital'],
      ['Command Dreadnought', 'capital'],
      ['Drone Carrier', 'carrier'],
      ['Freighter', 'hauler'],
      ['Bulk Hauler', 'hauler'],
      ['Miner', 'miner'],
      ['Salvager', 'miner'],
      ['Ice Harvester', 'miner'],
      ['Explorer', 'scout'],
      ['Blockade Runner', 'scout'],
      ['Electronic Warfare', 'support'],
      ['Medical', 'support'],
    ]
    for (const [cls, expected] of cases) {
      expect(archetypeForShip('ship', cls, undefined, 3)).toBe(expected)
    }
  })

  it('falls back to category for unknown classes, splitting combat by scale', () => {
    expect(archetypeForShip('ship', 'Void Ripper', 'Combat', 1)).toBe('fighter')
    expect(archetypeForShip('ship', 'Void Ripper', 'Combat', 3)).toBe('warship')
    expect(archetypeForShip('ship', 'Void Ripper', 'Combat', 5)).toBe('capital')
    expect(archetypeForShip('ship', 'Unknown', 'Combat Support', 2)).toBe('support')
    expect(archetypeForShip('ship', 'Unknown', 'Industrial', 2)).toBe('miner')
    expect(archetypeForShip('ship', 'Unknown', 'Commercial', 2)).toBe('hauler')
    expect(archetypeForShip('ship', 'Unknown', 'Civilian', 2)).toBe('hauler')
    expect(archetypeForShip('ship', 'Unknown', 'Exploration', 2)).toBe('scout')
    expect(archetypeForShip('ship', 'Unknown', 'Covert', 2)).toBe('scout')
  })

  it('never throws on a fully unknown ship and lands on the generic scout', () => {
    expect(archetypeForShip('ship', undefined, undefined, 1)).toBe('scout')
    expect(archetypeForShip('ship', '', '', 0)).toBe('scout')
  })
})

// Records path commands instead of rasterizing them, so glyph tracing can be
// exercised without a canvas (precedent: starfieldRender.test.ts).
function makeRecordingCtx() {
  const points: Array<{ x: number; y: number }> = []
  let began = 0
  let closed = 0
  const ctx = {
    beginPath: () => {
      began++
    },
    closePath: () => {
      closed++
    },
    moveTo: (x: number, y: number) => {
      points.push({ x, y })
    },
    lineTo: (x: number, y: number) => {
      points.push({ x, y })
    },
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => {
      points.push({ x: cx, y: cy }, { x, y })
    },
    arc: () => {},
  } as unknown as CanvasRenderingContext2D
  return { ctx, points, began: () => began, closed: () => closed }
}

describe('traceGlyphPath', () => {
  const SIZE = 10

  it.each(ARCHETYPES)('%s: begins/closes one path within glyph bounds', archetype => {
    const rec = makeRecordingCtx()
    traceGlyphPath(rec.ctx, archetype, SIZE, 12345)
    expect(rec.began()).toBe(1)
    expect(rec.closed()).toBe(1)
    expect(rec.points.length).toBeGreaterThanOrEqual(3)
    for (const p of rec.points) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.5 * SIZE)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.5 * SIZE)
    }
  })

  it.each(ARCHETYPES)('%s: nose extent matches GLYPH_NOSE_X', archetype => {
    const rec = makeRecordingCtx()
    traceGlyphPath(rec.ctx, archetype, SIZE, 12345)
    const maxX = Math.max(...rec.points.map(p => p.x))
    // Creature lumps are seed-dependent; everything else must reach its nose.
    if (archetype !== 'creature') {
      expect(maxX).toBeGreaterThanOrEqual(GLYPH_NOSE_X[archetype] * SIZE - 0.001)
    }
    expect(maxX).toBeLessThanOrEqual(1.5 * SIZE)
  })
})
