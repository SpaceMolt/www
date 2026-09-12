import { describe, expect, test } from 'bun:test'
import { MAX_BINARY_BYTES, oversizedBinaryChanges, parseNumstat } from './check-binary-size.mjs'

describe('large binary change guard', () => {
  test('parses text and binary numstat records', () => {
    expect(parseNumstat('12\t4\tsrc/page.tsx\0-\t-\tstatic/hero.jpg\0')).toEqual([
      { added: '12', deleted: '4', path: 'src/page.tsx' },
      { added: '-', deleted: '-', path: 'static/hero.jpg' },
    ])
  })

  test('reports only changed binaries above the limit', () => {
    const entries = parseNumstat('-\t-\tstatic/small.webp\0-\t-\tstatic/large.webp\0' + '100\t1\tsrc/data.json\0')
    const sizes = { 'static/small.webp': MAX_BINARY_BYTES, 'static/large.webp': MAX_BINARY_BYTES + 1 }

    expect(oversizedBinaryChanges(entries, (path) => sizes[path] ?? 10)).toEqual([
      { path: 'static/large.webp', size: MAX_BINARY_BYTES + 1 },
    ])
  })
})
