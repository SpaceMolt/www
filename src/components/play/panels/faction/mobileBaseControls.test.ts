import { expect, test } from 'bun:test'
import type { FactionInfoResponse, MobileBaseInfo } from '@spacemolt/lib'
import { canManageMobileBase, formatTicksLeft, mobileBasePosition, mobileBaseProgress, parseMoveTarget } from './mobileBaseControls'

const moving: MobileBaseInfo = {
  archetype_id: 'civitas', base_id: 'drft_civitas', poi_id: 'drft_civitas', name: 'Civitas',
  lifecycle: 'in_system_transit', current_system_id: 'sol', current_position: { x: 1, y: 0 },
  origin: { system_id: 'sol', position: { x: 0, y: 0 } },
  destination: { system_id: 'sol', position: { x: 4, y: 0 } },
  state_started_tick: 100, state_complete_tick: 200, wrecked: false,
}

test('move targets must be numbers inside the 10 AU radius', () => {
  expect(parseMoveTarget('3', '-4')).toEqual({ x: 3, y: -4 })
  expect(parseMoveTarget('8', '8')).toBeNull()
  expect(parseMoveTarget('', '1')).toBeNull()
  expect(parseMoveTarget('abc', '1')).toBeNull()
})

test('progress and position follow the ticks', () => {
  expect(mobileBaseProgress(moving, 150)).toEqual({ fraction: 0.5, ticksLeft: 50 })
  expect(mobileBasePosition(moving, 150)).toEqual({ x: 2, y: 0 })
  expect(mobileBasePosition(moving, 999)).toEqual({ x: 4, y: 0 })
  expect(mobileBaseProgress({ ...moving, lifecycle: 'stationary' }, 150)).toBeNull()
})

test('countdown reads in minutes and hours', () => {
  expect(formatTicksLeft(90)).toBe('~15m')
  expect(formatTicksLeft(540)).toBe('~1h 30m')
})

test('only the leader or a manage_bases role can command the base', () => {
  const info = {
    leader_id: 'lead',
    members: [{ player_id: 'pilot', role: 'officer' }, { player_id: 'grunt', role: 'member' }],
    roles: [
      { id: 'officer', name: 'Officer', priority: 2, permissions: { manage_bases: true } },
      { id: 'member', name: 'Member', priority: 0, permissions: { manage_bases: false } },
    ],
  } as unknown as FactionInfoResponse
  expect(canManageMobileBase(info, 'lead')).toBe(true)
  expect(canManageMobileBase(info, 'pilot')).toBe(true)
  expect(canManageMobileBase(info, 'grunt')).toBe(false)
  expect(canManageMobileBase(info, undefined)).toBe(false)
  expect(canManageMobileBase(info, 'unlisted')).toBe(true)
})
