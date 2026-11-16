import { describe, it, expect } from 'bun:test'
import { gatesFromLinks, joinGates } from './gateLanes'

describe('gate lists', () => {
  it('turns get_map gate links into gates', () => {
    expect(gatesFromLinks([{ system_id: 'a', gate_connections: [{ system_id: 'b', online: false }] }, { system_id: 'c' }])).toEqual([
      { from_system: 'a', to_system: 'b', online: false },
    ])
  })

  it('keeps one gate per pair, from the earlier list', () => {
    const fresh = [{ from_system: 'b', to_system: 'a', online: false }]
    const cached = [
      { from_system: 'a', to_system: 'b', online: true },
      { from_system: 'c', to_system: 'd', online: true },
    ]
    expect(joinGates(fresh, cached)).toEqual([fresh[0], cached[1]])
  })
})
