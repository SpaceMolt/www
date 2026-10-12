import { expect, test } from 'bun:test'
import { toListEntry } from './catalogShips'

test('mobile station projection does not expose obsolete ship fitting or movement stats', () => {
  const entry = toListEntry({ id: 'siege_foundry', name: 'Siege Foundry', class: 'Mobile Base', base_hull: 2500, base_speed: 9, weapon_slots: 3, cargo_capacity: 999, cpu_capacity: 800, power_capacity: 900 })
  expect(entry.base_hull).toBe(2500)
  expect(entry.weapon_slots).toBe(0)
  expect(entry.base_speed).toBe(0)
  expect(entry.cargo_capacity).toBe(0)
  expect(entry.cpu_capacity).toBe(0)
  expect(entry.power_capacity).toBe(0)
})

test('ordinary capital ships keep their real fitting and movement stats', () => {
  const entry = toListEntry({ id: 'capital', name: 'Capital', class: 'Dreadnought', base_speed: 2, weapon_slots: 8, cargo_capacity: 999 })
  expect(entry.weapon_slots).toBe(8)
  expect(entry.base_speed).toBe(2)
  expect(entry.cargo_capacity).toBe(999)
})
