import { expect, test } from 'bun:test'
import { battleListParams } from './listFilters'

test('station participation is requested independently of category', () => {
  const params = battleListParams('completed', 'station', '  Orbital  ', 100)
  expect(Object.fromEntries(params)).toEqual({ status: 'completed', station: 'true', search: 'Orbital', limit: '100', offset: '0' })
})

test('default uses server exclusions before pagination; wildlife remains explicitly selectable', () => {
  expect(battleListParams('all', 'all', '', 50).has('category')).toBe(false)
  expect(battleListParams('all', 'wildlife', '', 50).get('category')).toBe('wildlife')
  expect(battleListParams('all', 'arena', '', 50).get('category')).toBe('arena')
  expect(battleListParams('all', 'pvp', '', 50).has('station')).toBe(false)
})
