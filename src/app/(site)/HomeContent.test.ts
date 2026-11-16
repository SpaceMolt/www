import { describe, it, expect } from 'bun:test'
import fs from 'fs'
import path from 'path'
import { empireCards, pilotCards } from './HomeContent'
import { EMPIRE_ID_TO_I18N_SUFFIX } from '@/test/canonicalEmpires'

// Both arrays key off the PascalCase i18n suffix (e.g. "OuterRim", not the
// lowercase "outerrim" id) used to look up `home.empire<Key>Name` etc.
const CANONICAL_SUFFIXES = Object.values(EMPIRE_ID_TO_I18N_SUFFIX).sort()

describe('HomeContent empireCards', () => {
  it('has exactly the 5 canonical empires as keys (no stray, typo\'d, or missing entries)', () => {
    expect(empireCards.map((c) => c.key).sort()).toEqual(CANONICAL_SUFFIXES)
  })

  it('every empire card image also appears in the empires doc', () => {
    const doc = fs.readFileSync(path.join(process.cwd(), 'public/docs/empires.md'), 'utf8')
    for (const card of empireCards) {
      expect(doc).toContain(`](${card.image})`)
    }
  })
})

describe('HomeContent pilotCards', () => {
  it('only references the 5 canonical empires (no stray/typo\'d empire values)', () => {
    for (const pilot of pilotCards) {
      expect(CANONICAL_SUFFIXES).toContain(pilot.empire)
    }
  })
})
