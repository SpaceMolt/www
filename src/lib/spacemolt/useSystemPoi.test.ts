import { expect, test } from 'bun:test'
import type { Account } from '@spacemolt/lib'
import { shareRead } from './useSystemPoi'

test('shareRead sends one request per account and key inside the window', async () => {
  const account = {} as Account
  let calls = 0
  const read = async () => ++calls
  const [a, b] = await Promise.all([shareRead(account, 'system:sol', read), shareRead(account, 'system:sol', read)])
  expect([a, b, calls]).toEqual([1, 1, 1])
  expect(await shareRead(account, 'system:alpha', read)).toBe(2)
  expect(await shareRead({} as Account, 'system:sol', read)).toBe(3)
})
