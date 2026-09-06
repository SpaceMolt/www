import { describe, expect, it } from 'bun:test'
import { cinemaRenderSettings, type CinemaRenderQuality } from './quality'

const tiers: CinemaRenderQuality[] = ['high', 'medium', 'low']

describe('cinema rendering quality', () => {
  it('keeps Low at native CSS resolution instead of enlarging a 70-percent render', () => {
    for (const dpr of [0.5, 1, 1.5, 2, 3]) {
      const settings = cinemaRenderSettings('low', dpr, 8)
      expect(settings.pixelRatio).toBe(1)
      expect(1920 * settings.pixelRatio).toBe(1920)
      expect(875 * settings.pixelRatio).toBe(875)
      expect(settings.samples).toBe(0)
      expect(settings.bloom).toBe(false)
      expect(settings.shadows).toBe(false)
    }
  })

  it('uses bounded supersampling and multisampling for High and Medium', () => {
    expect(cinemaRenderSettings('high', 3, 8)).toEqual({ pixelRatio: 2, samples: 4, bloom: true, shadows: true, shadowMapSize: 2048 })
    expect(cinemaRenderSettings('medium', 3, 8)).toEqual({ pixelRatio: 1.5, samples: 2, bloom: true, shadows: true, shadowMapSize: 1024 })
    expect(cinemaRenderSettings('high', 1.25, 4).pixelRatio).toBe(1.25)
    expect(cinemaRenderSettings('medium', 1.25, 4).pixelRatio).toBe(1.25)
  })

  it('never requests more MSAA samples than the device supports', () => {
    for (const maxSamples of [0, 1, 2, 3, 4, 8]) {
      for (const tier of tiers) {
        const settings = cinemaRenderSettings(tier, 2, maxSamples)
        expect(settings.samples).toBeLessThanOrEqual(maxSamples)
        expect(Number.isInteger(settings.samples)).toBe(true)
      }
    }
    expect(cinemaRenderSettings('high', 2, 2.8).samples).toBe(2)
    expect(cinemaRenderSettings('medium', 2, 1.9).samples).toBe(1)
  })

  it('normalizes invalid and sub-native ratios without creating an invalid target', () => {
    for (const tier of tiers) {
      for (const dpr of [NaN, Infinity, -Infinity, -2, 0, 0.5]) {
        const settings = cinemaRenderSettings(tier, dpr, 4)
        expect(settings.pixelRatio).toBe(1)
        expect(Number.isFinite(settings.pixelRatio)).toBe(true)
        expect(settings.shadowMapSize).toBeGreaterThan(0)
      }
      for (const samples of [NaN, Infinity, -Infinity, -4, 0.5]) {
        expect(cinemaRenderSettings(tier, 2, samples).samples).toBe(0)
      }
    }
  })

  it('degrades effects without increasing allocation settings when changing tiers', () => {
    const settings = tiers.map(tier => cinemaRenderSettings(tier, 2, 4))
    for (let index = 1; index < settings.length; index++) {
      expect(settings[index].pixelRatio).toBeLessThanOrEqual(settings[index - 1].pixelRatio)
      expect(settings[index].samples).toBeLessThanOrEqual(settings[index - 1].samples)
      expect(settings[index].shadowMapSize).toBeLessThanOrEqual(settings[index - 1].shadowMapSize)
    }
  })
})
