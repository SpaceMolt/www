export type CinemaRenderQuality = 'high' | 'medium' | 'low'

/** Start before measurements exist without spending the highest GPU budget. */
export function initialCinemaQuality(width: number): CinemaRenderQuality {
  return width < 760 ? 'low' : 'medium'
}

export interface CinemaRenderSettings {
  pixelRatio: number
  samples: number
  bloom: boolean
  shadows: boolean
  shadowMapSize: number
}

/** Preserve native resolution when it fits, but cap actual GPU target allocation. */
export function cinemaRenderSettings(quality: CinemaRenderQuality, devicePixelRatio: number, maxSamples: number,
  viewport: { width: number; height: number; maxTextureSize?: number } = { width: 1, height: 1 }): CinemaRenderSettings {
  const dpr = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : 1
  const supportedSamples = Number.isFinite(maxSamples) ? Math.max(0, Math.floor(maxSamples)) : 0
  const high = quality === 'high'
  const low = quality === 'low'
  const width = Number.isFinite(viewport.width) ? Math.max(1, viewport.width) : 1
  const height = Number.isFinite(viewport.height) ? Math.max(1, viewport.height) : 1
  const maxTextureSize = Number.isFinite(viewport.maxTextureSize) ? Math.max(1, viewport.maxTextureSize!) : 4096
  const pixelBudget = high ? 4_194_304 : low ? 1_048_576 : 2_097_152
  const pixelRatio = Math.min(low ? 1 : Math.min(dpr, high ? 2 : 1.5),
    Math.sqrt(pixelBudget / (width * height)), maxTextureSize / Math.max(width, height))
  return {
    pixelRatio,
    samples: low ? 0 : Math.min(supportedSamples, high ? 4 : 2),
    bloom: !low,
    shadows: !low,
    // Low does not allocate a shadow map, but retains a valid size if reused.
    shadowMapSize: high ? 2048 : low ? 512 : 1024,
  }
}
