import { describe, it, expect } from 'bun:test'
import fs from 'fs'
import path from 'path'
import en from './en.json'
import { CANONICAL_EMPIRE_IDS, EMPIRE_ID_TO_I18N_SUFFIX } from '@/test/canonicalEmpires'

/*
 * Every locale JSON under src/i18n/translations/ duplicates a `ships.empireX`
 * shortname entry per empire (X = the PascalCase suffix in
 * EMPIRE_ID_TO_I18N_SUFFIX, e.g. "Solarian" / "OuterRim"). Values are
 * legitimately translated per-locale, but the *key set* must stay exactly the
 * 5 canonical empires in every locale — a typo'd or missing key here silently
 * breaks that locale's ship-codex empire filter/labels.
 */

const TRANSLATIONS_DIR = path.join(process.cwd(), 'src', 'i18n', 'translations')

const localeFiles = fs.readdirSync(TRANSLATIONS_DIR).filter((f) => f.endsWith('.json'))

const expectedShipsEmpireKeys = CANONICAL_EMPIRE_IDS.map((id) => `empire${EMPIRE_ID_TO_I18N_SUFFIX[id]}`).sort()

describe('locale ships.empire* key parity', () => {
  it('found at least the known locale files (sanity check the glob itself)', () => {
    expect(localeFiles.length).toBeGreaterThanOrEqual(14)
  })

  for (const file of localeFiles) {
    it(`${file}: ships.empire* has exactly the 5 canonical empire keys`, () => {
      const locale = JSON.parse(fs.readFileSync(path.join(TRANSLATIONS_DIR, file), 'utf-8'))
      const shipsEmpireKeys = Object.keys(locale.ships ?? {})
        .filter((k) => k.startsWith('empire'))
        .sort()
      expect(shipsEmpireKeys).toEqual(expectedShipsEmpireKeys)
    })
  }
})

describe('en.json home.empire*Name key parity', () => {
  it('has exactly the 5 canonical empire full-name keys', () => {
    const homeEmpireNameKeys = Object.keys(en.home)
      .filter((k) => k.startsWith('empire') && k.endsWith('Name'))
      .sort()
    const expected = CANONICAL_EMPIRE_IDS.map((id) => `empire${EMPIRE_ID_TO_I18N_SUFFIX[id]}Name`).sort()
    expect(homeEmpireNameKeys).toEqual(expected)
  })
})
