import { expect, test } from 'bun:test'
import { refitPreview, type RefitStats } from './refitPreview'

// Cleaver: base armor 10 and speed 3, plus its standard Armor Plate I (+5 armor, -1 speed).
const onSpec: RefitStats = {
  max_hull: 156, max_shield: 14, shield_recharge: 1, armor: 15, speed: 2, max_fuel: 80,
  cargo_capacity: 15, cpu_capacity: 14, power_capacity: 40, weapon_slots: 3, defense_slots: 1, utility_slots: 0,
}

test('a ship on spec shows no stat changes, only the module swap', () => {
  const preview = refitPreview('cleaver', onSpec, ['Autocannon II'])!
  expect(preview.changes).toEqual([])
  expect(preview.removed).toEqual(['Autocannon II'])
  expect(preview.installed).toEqual(['Autocannon I', 'Autocannon I', 'Autocannon I', 'Armor Plate I'])
})

test('lists each stat the refit changes, before and after', () => {
  const preview = refitPreview('cleaver', { ...onSpec, max_shield: 30, cargo_capacity: 25 }, [])!
  expect(preview.changes).toEqual([
    { label: 'Shield', before: 30, after: 14 },
    { label: 'Cargo', before: 25, after: 15 },
  ])
})

test('returns nothing for a class missing from the catalog', () => {
  expect(refitPreview('not_a_ship', onSpec, [])).toBeUndefined()
})
