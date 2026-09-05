import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const translationsDir = path.dirname(import.meta.path)
const english = JSON.parse(fs.readFileSync(path.join(translationsDir, 'en.json'), 'utf8')) as Record<string, unknown>
const localeFiles = fs.readdirSync(translationsDir).filter(file => file.endsWith('.json'))

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

  it('localizes every new replay identity, fate, and boarding event key in every locale', () => {
    const replayKeys = [
      'battles.capturedIntact',
      'battles.capturedIntactBy',
      'battles.capturedIntactCount',
      'battles.selfDestructed',
      'battles.identityPirateBoss',
      'battles.identityNpcBoss',
      'battles.identityPirate',
      'battles.identityPolice',
      'battles.identityIntactPrize',
      'battles.identityPrize',
      'battles.identityNpc',
      'battles.identityDrone',
      'battles.identityWildlife',
      'battles.identityStation',
    ]
    const eventKeys = Object.keys(getValue(english, 'battles.events') as Record<string, unknown>)
      .map(key => `battles.events.${key}`)
    const requiredKeys = [...replayKeys, ...eventKeys]

    expect(localeFiles).toHaveLength(14)
    for (const file of localeFiles) {
      const locale = JSON.parse(fs.readFileSync(path.join(translationsDir, file), 'utf8')) as Record<string, unknown>
      for (const key of requiredKeys) {
        const translated = getValue(locale, key)
        expect(typeof translated, `${file}: ${key}`).toBe('string')
        expect(translated, `${file}: ${key}`).toBeTruthy()

        const englishValue = String(getValue(english, key))
        const placeholders = [...englishValue.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
        const translatedPlaceholders = [...String(translated).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
        expect(translatedPlaceholders, `${file}: ${key} placeholders`).toEqual(placeholders)
      }
    }
  })
})
