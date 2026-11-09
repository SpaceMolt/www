import { expect, it } from 'bun:test'
import { shortcutKey } from './shortcuts'

const key = (k: string, extra: Partial<Parameters<typeof shortcutKey>[0]> = {}) =>
  shortcutKey({ key: k, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'DIV' } as unknown as EventTarget, ...extra })

it('returns the lowercased key for plain presses', () => {
  expect(key('D')).toBe('d')
  expect(key('?')).toBe('?')
})

it('ignores presses while typing or with a modifier', () => {
  expect(key('d', { target: { tagName: 'INPUT' } as unknown as EventTarget })).toBeNull()
  expect(key('d', { target: { isContentEditable: true } as unknown as EventTarget })).toBeNull()
  expect(key('r', { ctrlKey: true })).toBeNull()
})
