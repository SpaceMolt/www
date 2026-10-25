import { expect, test } from 'bun:test'
import { mobileBaseLabel, mobileBasePose, mobileBaseStatus, type PublicMobileBase } from './mobileBases'
import { fixedStations } from './stationPresentation'

const systems = new Map([
  ['alpha', { x: 0, y: 0 }],
  ['beta', { x: 1000, y: 0 }],
])
const at = (id: string) => systems.get(id)

const parked: PublicMobileBase = {
  base_id: 'drft_civitas', name: 'Civitas', kind: 'faction', faction_tag: 'DRFT',
  lifecycle: 'stationary', system_id: 'alpha', wrecked: false,
}
const jumping: PublicMobileBase = {
  ...parked, lifecycle: 'jumping', system_id: undefined,
  from_system: 'alpha', to_system: 'beta', start_tick: 100, arrival_tick: 640,
}

test('a parked base sits on its system', () => {
  expect(mobileBasePose(parked, 500, at)).toEqual({ x: 0, y: 0, jumping: false, angle: 0 })
})

test('a jumping base moves along the lane by tick', () => {
  expect(mobileBasePose(jumping, 370, at)).toEqual({ x: 500, y: 0, jumping: true, angle: 0 })
  expect(mobileBasePose(jumping, 9999, at)?.x).toBe(1000)
})

test('a base in an unknown system is not placed', () => {
  expect(mobileBasePose({ ...parked, system_id: 'gamma' }, 0, at)).toBeNull()
  expect(mobileBasePose({ ...jumping, to_system: 'gamma' }, 0, at)).toBeNull()
})

test('status and label describe the base', () => {
  expect(mobileBaseStatus(jumping, (id) => id.toUpperCase())).toBe('Jumping ALPHA → BETA')
  expect(mobileBaseStatus({ ...parked, lifecycle: 'jump_preparing' })).toBe('Preparing to jump')
  expect(mobileBaseStatus({ ...parked, wrecked: true })).toBe('Wrecked')
  expect(mobileBaseStatus({ base_id: 'frontier_station', name: 'Frontier Station', kind: 'capital', wrecked: false })).toBe('On patrol')
  expect(mobileBaseLabel(parked)).toBe('[DRFT] Civitas')
})

test('the capital names its next patrol stop and when it leaves', () => {
  const capital: PublicMobileBase = {
    base_id: 'frontier_station', name: 'Frontier Station', kind: 'capital', system_id: 'alpha',
    next_system: 'beta', depart_tick: 1000, wrecked: false,
  }
  expect(mobileBaseStatus(capital, (id) => id.toUpperCase(), 100)).toBe('Next stop: BETA in ~2h 30m')
  expect(mobileBaseStatus(capital)).toBe('Next stop: beta')
  expect(mobileBasePose(capital, 500, at)).toEqual({ x: 0, y: 0, jumping: false, angle: 0 })
})

test('maps keep only fixed stations for system rings', () => {
  expect(fixedStations([{ id: 'a' }, { id: 'b', mobile: true }])).toEqual([{ id: 'a' }])
})
