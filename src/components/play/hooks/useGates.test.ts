import { expect, test } from 'bun:test'
import { roleCan } from './useGates'

const info = {
  roles: [
    { id: 'leader', name: 'Leader', permissions: { invite: true, manage_treasury: true } },
    { id: 'member', name: 'Member', permissions: { invite: false } },
  ],
} as unknown as Parameters<typeof roleCan>[0]

test('reads the permission from the role named by faction_rank', () => {
  expect(roleCan(info, 'leader', 'manage_treasury')).toBe(true)
  expect(roleCan(info, 'member', 'invite')).toBe(false)
  expect(roleCan(info, 'member', 'manage_treasury')).toBe(false)
  expect(roleCan(info, 'Member', 'invite')).toBe(false)
})

test('an unknown role allows, so the server decides', () => {
  expect(roleCan(info, 'custom_role_x', 'kick')).toBe(true)
})
