import { expect, test } from 'bun:test'
import { addBattlefieldCoverage } from './coverage'
import type { CinemaFilm, CinemaShip, CinemaShot } from './types'

const ship = (id: string, fields: Partial<CinemaShip> = {}): CinemaShip => ({
  id, playerId: id, name: id, shipClass: 'shard', kind: 'player', sideId: 1, sideIndex: 0,
  start: 0, end: 90, fate: 'survived', health: [{ time: 0, hull: 1, shield: 1 }], ...fields,
})
function movie(ships: CinemaShip[]): CinemaFilm {
  const spans: [number, number, CinemaShot['role']][] = [[0, 2, 'geography'], [2, 4, 'protagonist'], [4, 6, 'opposition'],
    [6, 25, 'setup'], [25, 28, 'fire'], [28, 33, 'impact'], [33, 60, 'setup'], [60, 68, 'setup'],
    [68, 72, 'fire'], [72, 80, 'impact'], [80, 90, 'resolution']]
  return { version: 1, battleId: 'coverage-test', systemName: 'Test', seed: 1, duration: 90, arena: true,
    outcome: 'victory', winningSide: 2, ships, cues: [], segments: [],
    shots: spans.map(([start, end, role]) => ({ start, end, role, kind: 'tracking', intensity: .5, subject: 'capital', target: 'shard:0' })),
    story: { sequences: [{ id: 'climax', start: 60, end: 80, kind: 'climax', actionTime: 68, impactTime: 72, consequenceTime: 74 }] } }
}
const at = (shots: CinemaShot[], time: number) => shots.find(shot => time >= shot.start && time < shot.end)!
function continuous(shots: CinemaShot[], duration: number) {
  expect(shots[0].start).toBe(0)
  expect(shots.at(-1)!.end).toBe(duration)
  shots.forEach((shot, index) => {
    expect(shot.end).toBeGreaterThan(shot.start)
    if (index) expect(shot.start).toBe(shots[index - 1].end)
    if (shot.battlefield) {
      expect(shot.end - shot.start).toBeGreaterThanOrEqual(4)
      expect(shot.end - shot.start).toBeLessThanOrEqual(6)
    }
  })
}

test('the opening establishes the whole fleet for four seconds before detail coverage', () => {
  const film = movie([ship('capital', { sideId: 2 }), ...Array.from({ length: 100 }, (_, index) => ship(`shard:${index}`))])
  const shots = addBattlefieldCoverage(film)
  expect(shots[0].battlefield).toBe(true)
  expect(shots[0].end).toBe(4)
  expect(at(shots, 4.5).battlefield).not.toBe(true)
  continuous(shots, film.duration)
})

test('mass arena knockouts get a battlefield view during the pulse while the muzzle keeps close coverage', () => {
  const film = movie([ship('capital', { sideId: 2 }), ...Array.from({ length: 100 }, (_, index) =>
    ship(`shard:${index}`, { end: 74, fate: 'knocked_out' }))])
  const shots = addBattlefieldCoverage(film)
  const aftermath = shots.find(shot => shot.battlefield && shot.start > 6)
  expect(aftermath).toBeDefined()
  expect(aftermath!.start).toBeLessThanOrEqual(74)
  expect(at(shots, 74.3).battlefield).toBe(true)
  for (const time of [68, 71]) expect(at(shots, time).battlefield).not.toBe(true)
  continuous(shots, film.duration)
})

test('a substantial reinforcement gets context near arrival without retiming its state', () => {
  const film = movie([ship('capital', { sideId: 2 }), ship('shard:0'), ...Array.from({ length: 8 }, (_, index) =>
    ship(`reinforcement:${index}`, { start: 40 }))])
  const original = JSON.stringify(film)
  const shots = addBattlefieldCoverage(film)
  expect(shots.some(shot => shot.battlefield && shot.start >= 39 && shot.start < 48)).toBe(true)
  expect(JSON.stringify(film)).toBe(original)
  continuous(shots, film.duration)
})

test('isolated losses in a large fleet do not generate a cutaway for every casualty', () => {
  const film = movie([ship('capital', { sideId: 2 }), ...Array.from({ length: 100 }, (_, index) =>
    ship(`shard:${index}`, index < 5 ? { end: 35 + index * 4, fate: 'knocked_out' } : {}))])
  const shots = addBattlefieldCoverage(film)
  expect(shots.filter(shot => shot.battlefield)).toHaveLength(1)
  continuous(shots, film.duration)
})

test('a new opposing side warrants a wide view even when it is only one arrival', () => {
  const film = movie([...Array.from({ length: 100 }, (_, index) => ship(`shard:${index}`)), ship('capital', { sideId: 2, start: 40 })])
  const shots = addBattlefieldCoverage(film)
  expect(shots.some(shot => shot.battlefield && shot.start >= 39 && shot.start < 48)).toBe(true)
})


test('large nonlethal collateral volleys show propagation across the formation', () => {
  const film = movie([ship('capital', { sideId: 2 }), ...Array.from({ length: 30 }, (_, index) => ship(`shard:${index}`))])
  film.cues = Array.from({ length: 8 }, (_, index) => ({ id: `volley:${index}`, kind: 'weapon', time: 39, duration: 1,
    tick: 20, from: 'capital', to: `shard:${index}`, hit: true, intensity: .6, parentId: index ? 'volley:0' : undefined }))
  const shots = addBattlefieldCoverage(film)
  expect(at(shots, 40.3).battlefield).toBe(true)
  continuous(shots, film.duration)
})


test('a mass impact cut starts at the existing cut instead of leaving a subsecond closeup', () => {
  const film = movie([ship('capital', { sideId: 2 }), ...Array.from({ length: 100 }, (_, index) =>
    ship(`shard:${index}`, { end: 74, fate: 'knocked_out' }))])
  const index = film.shots.findIndex(shot => shot.start === 72)
  film.shots[index - 1].end = 72.6
  film.shots[index] = { ...film.shots[index], start: 72.6, end: 74.6 }
  film.shots.splice(index + 1, 0, { ...film.shots[index], start: 74.6, end: 80, role: 'reaction' })
  const shots = addBattlefieldCoverage(film)
  expect(at(shots, 74.3).battlefield).toBe(true)
  expect(shots.find(shot => shot.battlefield && shot.start > 6)!.start).toBe(72.6)
  continuous(shots, film.duration)
})

test('a compact opening never replaces the first muzzle release with a fleet master', () => {
  const film=movie([ship('capital'),ship('shard:0',{sideId:2})])
  film.duration=10
  film.shots=[{start:0,end:1.2,kind:'reveal',role:'geography',intensity:.2},
    {start:1.2,end:1.5,kind:'tracking',role:'setup',intensity:.4},
    {start:1.5,end:2.5,kind:'broadside',role:'fire',intensity:.7},
    {start:2.5,end:10,kind:'impact',role:'impact',intensity:.7}]
  const shots=addBattlefieldCoverage(film)
  expect(shots[0].end).toBe(1.2)
  expect(at(shots,1.7).role).toBe('fire')
  expect(at(shots,1.7).battlefield).not.toBe(true)
})
