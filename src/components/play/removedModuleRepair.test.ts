import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (...parts: string[]) => readFileSync(join(import.meta.dir, ...parts), 'utf8')

describe('removed module repair and wear contract', () => {
  test('does not expose the removed repair_module command through the UI or analytics', () => {
    const sources = [
      read('panels', 'ShipPanel.tsx'),
      read('ActionBanner.tsx'),
      read('..', '..', 'lib', 'analytics', 'gameActions.ts'),
    ]

    for (const source of sources) {
      expect(source).not.toContain('repair_module')
    }
  })

  test('does not render module wear that the server no longer provides', () => {
    expect(read('panels', 'ShipPanel.tsx')).not.toMatch(/\b(?:mod|m)\.wear(?:_status)?\b/)
    expect(read('panels', 'SalvagePanel.tsx')).not.toMatch(/\b(?:mod|m)\.wear(?:_status)?\b/)
  })
})
