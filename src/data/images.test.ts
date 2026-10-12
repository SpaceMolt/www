import { expect, test } from 'bun:test'
import { hasImage, imageUrl } from './images'

test('mobile bases use local art while existing capital art stays on the CDN', () => {
  for (const id of ['civitas', 'siege_foundry', 'nebula_foundation', 'here_to_stay', 'emanation']) {
    const path = `ships/catalog/${id}.webp`
    expect(hasImage(path)).toBe(true)
    expect(imageUrl(path)).toBe(`/images/ships/mobile-bases/${id}.webp`)
  }
  expect(imageUrl('ships/catalog/magnum_opus.webp')).toBe(
    'https://assets.spacemolt.com/images/ships/catalog/magnum_opus.webp',
  )
  expect(hasImage('ships/catalog/missing_hull.webp')).toBe(false)
})
