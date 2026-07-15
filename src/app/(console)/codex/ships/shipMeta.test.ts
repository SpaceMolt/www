import { describe, it, expect } from 'bun:test'
import en from '@/i18n/translations/en.json'
import { EMPIRE_NAMES } from './shipMeta'

// The five empire ids and their canonical full names, per en.json's
// `empireXName` keys (source of truth: gameserver's data/empires.yaml).
const CANONICAL_EMPIRE_NAMES: Record<string, string> = {
  solarian: en.home.empireSolarianName,
  voidborn: en.home.empireVoidbornName,
  crimson: en.home.empireCrimsonName,
  nebula: en.home.empireNebulaName,
  outerrim: en.home.empireOuterRimName,
}

describe('shipMeta EMPIRE_NAMES', () => {
  it('matches the canonical full empire names from en.json for every empire', () => {
    for (const [id, canonicalName] of Object.entries(CANONICAL_EMPIRE_NAMES)) {
      expect(EMPIRE_NAMES[id]).toBe(canonicalName)
    }
  })
})
