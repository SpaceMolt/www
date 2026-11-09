import { expect, test } from 'bun:test'
import { buildMissionParams, pageState } from './factionAdmin'

test('page state walks 50 at a time and stops at the ends', () => {
  expect(pageState({ offset: 0, limit: 50, total: 120 })).toEqual({ page: 1, pages: 3, prevOffset: null, nextOffset: 50 })
  expect(pageState({ offset: 100, limit: 50, total: 120 })).toEqual({ page: 3, pages: 3, prevOffset: 50, nextOffset: null })
  expect(pageState({ total: 0 })).toEqual({ page: 1, pages: 1, prevOffset: null, nextOffset: null })
})

test('mission params map each target to its objective field and drop blanks', () => {
  const params = buildMissionParams({
    title: ' Hunt ', description: 'Get them', type: 'bounty', credits: '5000', expirationHours: '', openToAll: true,
    objectives: [
      { type: 'kill_player', description: 'Kill', item_id: '', quantity: '', target: 'Vex' },
      { type: 'deliver_item', description: 'Ore', item_id: 'iron_ore', quantity: '50', target: '' },
    ],
  })
  expect(params).toEqual({
    title: 'Hunt', description: 'Get them', type: 'bounty', rewards: { credits: 5000 }, triggers: ['open_to_all'],
    objectives: [
      { type: 'kill_player', description: 'Kill', target_id: 'Vex' },
      { type: 'deliver_item', description: 'Ore', item_id: 'iron_ore', quantity: 50 },
    ],
  })
})
