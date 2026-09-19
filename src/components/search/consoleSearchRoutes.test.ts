import { describe, expect, it } from 'bun:test'
import { shouldShowConsoleSearchField } from './consoleSearchRoutes'

describe('console search field visibility', () => {
  it('leaves the full-page battle header clear, including trailing slash URLs', () => {
    expect(shouldShowConsoleSearchField('/battles/battle-123')).toBe(false)
    expect(shouldShowConsoleSearchField('/battles/battle-123/')).toBe(false)
  })

  it('keeps the battle listing and unrelated or nested routes searchable', () => {
    for (const pathname of ['/battles', '/battles/', '/docs', '/battle-123', '/battles/battle-123/details']) {
      expect(shouldShowConsoleSearchField(pathname)).toBe(true)
    }
  })

  it('preserves the Recon workspace exception without excluding neighboring routes', () => {
    expect(shouldShowConsoleSearchField('/intel')).toBe(false)
    expect(shouldShowConsoleSearchField('/intel/other')).toBe(true)
  })
})
