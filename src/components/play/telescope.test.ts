import { expect, test } from 'bun:test'
import { matchSightings, parseSightings, starRays } from './telescope'

const systems = [
  { id: 'near', name: 'Near', x: 100, y: 0 },
  { id: 'far', name: 'Far', x: 300, y: 0 },
  { id: 'north', name: 'North', x: 0, y: 200 },
]
const at = (sightings: { bearing: number; temperature: number; brightness: number }[]) => ({ x: 0, y: 0, sightings })

test('parseSightings keeps only whole sightings', () => {
  expect(parseSightings({ star_sightings: [{ bearing: 1, temperature: 2, brightness: 3 }, { bearing: 1 }, null] })).toHaveLength(1)
  expect(parseSightings({})).toEqual([])
})

test('a bearing with one system on it is a match', () => {
  const [ray] = starRays(at([{ bearing: 90, temperature: 5800, brightness: 4 }]), systems, {}, false)
  expect(ray.match?.id).toBe('north')
})

test('a known star class rules a candidate out', () => {
  const sighting = [{ bearing: 0.2, temperature: 3100, brightness: 4 }]
  expect(matchSightings(at(sighting), systems).map((c) => c.map((s) => s.id))).toEqual([['near', 'far']])
  expect(matchSightings(at(sighting), systems, { near: ['G2V'], far: ['M3V'] })[0].map((s) => s.id)).toEqual(['far'])
})

test('coarse readings widen the bearing, and a star off the map has no candidate', () => {
  const [wide, none] = matchSightings(at([{ bearing: 90, temperature: 6000, brightness: 1 }, { bearing: 180, temperature: 4000, brightness: 1 }]), [...systems, { id: 'ne', name: 'NE', x: 8, y: 200 }])
  expect(wide.map((s) => s.id)).toEqual(['north', 'ne'])
  expect(none).toEqual([])
})
