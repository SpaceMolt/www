import { expect, test } from 'bun:test'
import { objectKey } from './objectKey'

test('objectKey is stable per object and distinct across objects', () => {
  const a = { kind: 'mine' }
  const b = { kind: 'mine' }
  expect(objectKey(a)).toBe(objectKey(a))
  expect(objectKey(a)).not.toBe(objectKey(b))
})
