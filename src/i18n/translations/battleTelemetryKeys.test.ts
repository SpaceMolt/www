import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const translationsDir = path.dirname(import.meta.path)
const english = JSON.parse(fs.readFileSync(path.join(translationsDir, 'en.json'), 'utf8')) as Record<string, unknown>

function getValue(root: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[segment]
  }, root)
}

describe('battle telemetry translations', () => {
  it('defines every feed and telemetry namespace used by the battle viewer', () => {
    expect(getValue(english, 'battles.feedShowDetail')).toBeTruthy()
    expect(getValue(english, 'battles.feedHideDetail')).toBeTruthy()
    expect(getValue(english, 'battles.telemetry')).toBeTruthy()
    expect(getValue(english, 'battles.telemetry.effect')).toBeTruthy()
  })
})
