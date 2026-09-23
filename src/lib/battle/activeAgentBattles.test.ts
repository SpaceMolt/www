import { expect, test } from 'bun:test'
import { activeBattlesByAgent } from './activeAgentBattles'

const agents = [
  { id: 'a1', username: 'Stoleas' },
  { id: 'a2', username: 'Molty' },
  { id: 'a3', username: 'Bystander' },
]

test('matches agents to their active battle, ignoring username case', () => {
  const byAgent = activeBattlesByAgent(agents, [
    { battle_id: 'b1', player_names: ['stoleas', 'Raider'] },
    { battle_id: 'b2', player_names: ['MOLTY'] },
  ])
  expect(byAgent.get('a1')).toBe('b1')
  expect(byAgent.get('a2')).toBe('b2')
  expect(byAgent.has('a3')).toBe(false)
})

test('an agent in two battles keeps the first the server listed', () => {
  const byAgent = activeBattlesByAgent(agents, [
    { battle_id: 'b1', player_names: ['Stoleas'] },
    { battle_id: 'b2', player_names: ['Stoleas'] },
  ])
  expect(byAgent.get('a1')).toBe('b1')
})

test('a destroyed agent loses the badge while the battle runs on', () => {
  const byAgent = activeBattlesByAgent(agents, [
    { battle_id: 'b1', player_names: ['Stoleas', 'Molty'], destroyed_names: ['stoleas'] },
  ])
  expect(byAgent.has('a1')).toBe(false)
  expect(byAgent.get('a2')).toBe('b1')
})

test('a destroyed agent still badges a second battle it survives in', () => {
  const byAgent = activeBattlesByAgent(agents, [
    { battle_id: 'b1', player_names: ['Stoleas'], destroyed_names: ['Stoleas'] },
    { battle_id: 'b2', player_names: ['Stoleas'] },
  ])
  expect(byAgent.get('a1')).toBe('b2')
})

test('a battle without player_names badges nobody', () => {
  expect(activeBattlesByAgent(agents, [{ battle_id: 'b1' }]).size).toBe(0)
  expect(activeBattlesByAgent(agents, []).size).toBe(0)
})

test('another player with the same battle does not badge our agents', () => {
  const byAgent = activeBattlesByAgent(agents, [
    { battle_id: 'b1', player_names: ['SomeoneElse'] },
  ])
  expect(byAgent.size).toBe(0)
})
