export type CinemaRenderQuality = 'high' | 'medium' | 'low'

export interface CinemaRenderSettings {
  pixelRatio: number
  samples: number
  bloom: boolean
  shadows: boolean
  shadowMapSize: number
}

/** Keep the image at least one rendered pixel per CSS pixel at every tier. */
export function cinemaRenderSettings(quality: CinemaRenderQuality, devicePixelRatio: number, maxSamples: number): CinemaRenderSettings {
  const dpr = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : 1
  const supportedSamples = Number.isFinite(maxSamples) ? Math.max(0, Math.floor(maxSamples)) : 0
  const high = quality === 'high'
  const low = quality === 'low'
  return {
    pixelRatio: low ? 1 : Math.min(dpr, high ? 2 : 1.5),
    samples: low ? 0 : Math.min(supportedSamples, high ? 4 : 2),
    bloom: !low,
    shadows: !low,
    // Low does not allocate a shadow map, but retains a valid size if reused.
    shadowMapSize: high ? 2048 : low ? 512 : 1024,
  }
}
