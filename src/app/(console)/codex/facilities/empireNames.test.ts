import { describe, it, expect } from 'bun:test'
import { empireShortName } from './empireNames'

// Same shortnames shown in the Ships codex table rows (en.json's `empireX`
// keys) — the facilities empire column and filter must agree with them
// instead of title-casing the raw empire id (which turned "outerrim" into
// "Outerrim" and "crimson" into "Crimson Pact"-less plain "Crimson", losing
// consistency across the codex).
describe('empireShortName', () => {
  it('maps every canonical empire id to its shortname', () => {
    expect(empireShortName('solarian')).toBe('Solarian')
    expect(empireShortName('voidborn')).toBe('Voidborn')
    expect(empireShortName('crimson')).toBe('Crimson')
    expect(empireShortName('nebula')).toBe('Nebula')
    expect(empireShortName('outerrim')).toBe('Outer Rim')
  })

  it('does not mangle "outerrim" into "Outerrim" via raw title-casing', () => {
    expect(empireShortName('outerrim')).not.toBe('Outerrim')
  })
})
