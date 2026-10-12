import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { isMobileBase, MobileBaseDetails, type MobileBaseCatalog } from './MobileBaseDetails'

const base: MobileBaseCatalog = {
  combat_model: 'station', ship_modules: false, production_slots: 4, weapon_mounts: 4,
  storage_capacity_per_item: 10000, fuel_capacity: 100000,
  built_in_facilities: [{ id: 'station_turret', name: 'Station Turret' }, { id: 'market', name: 'Trade Concourse' }],
  services: ['market'], default_weapon_facilities: [{ id: 'station_turret', name: 'Station Turret' }],
}

test('mobile station panel renders actual station metadata and fitting limits', () => {
  const html = renderToStaticMarkup(<MobileBaseDetails ship={{ mobile_base: base }} />)
  for (const text of ['4 station weapon mounts', '4 production slots', '10,000 faction storage per item', 'Trade Concourse', 'Station Turret', 'cannot fit ship modules', 'station power']) expect(html).toContain(text)
  expect(renderToStaticMarkup(<MobileBaseDetails ship={{ mobile_base: { ...base, weapon_mounts: 2, storage_capacity_per_item: 20000 } }} />)).toContain('20,000 faction storage per item')
})

test('old catalogs identify mobile bases without inventing services or fitting counts', () => {
  expect(isMobileBase({ class: 'Mobile Base' })).toBe(true)
  expect(isMobileBase({ mobile_base_archetype: 'crimson' })).toBe(true)
  expect(isMobileBase({ class: 'Dreadnought' })).toBe(false)
  const html = renderToStaticMarkup(<MobileBaseDetails ship={{ class: 'Mobile Base' }} />)
  expect(html).toContain('unavailable in this catalog version')
  expect(html).not.toContain('weapon mounts')
})
