import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import nextConfig from '../../next.config'
import { hasImage, imageUrl } from './images'

test('mobile base art resolves to local public files without CDN redirects', async () => {
  for (const id of ['civitas', 'siege_foundry', 'foundation', 'here_to_stay', 'emanation']) {
    const path = imageUrl(`ships/catalog/${id}.webp`)
    const response = await unstable_getResponseFromNextConfig({ url: `https://www.spacemolt.com${path}`, nextConfig })
    expect(getRedirectUrl(response)).toBeNull()
    expect(existsSync(resolve(import.meta.dir, '../../public', `.${path}`))).toBe(true)
  }
})

test('mobile bases use local art while existing capital art stays on the CDN', () => {
  for (const id of ['civitas', 'siege_foundry', 'foundation', 'here_to_stay', 'emanation']) {
    const path = `ships/catalog/${id}.webp`
    expect(hasImage(path)).toBe(true)
    expect(imageUrl(path)).toBe(`/ship-art/mobile-bases/${id}.webp`)
  }
  expect(imageUrl('ships/catalog/magnum_opus.webp')).toBe(
    'https://assets.spacemolt.com/images/ships/catalog/magnum_opus.webp',
  )
  expect(hasImage('ships/catalog/missing_hull.webp')).toBe(false)
})
