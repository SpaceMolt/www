import { describe, it, expect } from 'bun:test'
import { catalogPayload, isSameCatalogData } from './fetch-catalog.mjs'

/**
 * These cover the build-cache property: a build that fetches the same catalog
 * data as the previous build must leave the generated JSON byte-identical.
 *
 * Why it matters: catalog.json is a static `import` inlined into the client
 * bundle, and catalog-reference.json feeds every /codex page. If the file
 * changes on every build — which it did, because `_meta.fetchedAt` was a fresh
 * timestamp each run — the module hash changes, the client bundle hash changes,
 * and every player re-downloads 1.2 MB on every deploy for no reason. It also
 * moved every codex route's sitemap `lastModified`, telling crawlers 4,500
 * pages changed when none had.
 */

const SECTIONS = ['items', 'recipes', 'ships']

const dump = () => ({
  items: [{ id: 'ore', name: 'Ore' }],
  recipes: [{ id: 'plate', name: 'Plate' }],
  ships: [{ id: 'zoea', name: 'Zoea' }],
})

describe('catalogPayload', () => {
  it('keys each section by id', () => {
    const payload = catalogPayload(SECTIONS, dump())
    expect(payload.items).toEqual({ ore: { id: 'ore', name: 'Ore' } })
    expect(payload.ships.zoea.name).toBe('Zoea')
  })

  it('yields an empty map for a section the source did not supply', () => {
    const payload = catalogPayload(SECTIONS, { items: [], recipes: [], ships: [] })
    expect(payload.items).toEqual({})
  })
})

describe('isSameCatalogData', () => {
  it('is true when only _meta differs — the whole point', () => {
    const payload = catalogPayload(SECTIONS, dump())
    const previous = {
      ...payload,
      _meta: { fetchedAt: '2020-01-01T00:00:00.000Z', version: '0.1.0', source: 'dump' },
    }
    expect(isSameCatalogData(previous, payload, SECTIONS)).toBe(true)
  })

  it('is false when an entry gained a field', () => {
    const payload = catalogPayload(SECTIONS, dump())
    const changed = structuredClone(payload)
    changed.items.ore.mass = 10
    expect(isSameCatalogData({ ...changed, _meta: {} }, payload, SECTIONS)).toBe(false)
  })

  it('is false when an entry is added or removed', () => {
    const payload = catalogPayload(SECTIONS, dump())
    const extra = structuredClone(payload)
    extra.ships.nova = { id: 'nova', name: 'Nova' }
    expect(isSameCatalogData({ ...extra, _meta: {} }, payload, SECTIONS)).toBe(false)

    const fewer = structuredClone(payload)
    delete fewer.recipes.plate
    expect(isSameCatalogData({ ...fewer, _meta: {} }, payload, SECTIONS)).toBe(false)
  })

  it('is false when a value changed', () => {
    const payload = catalogPayload(SECTIONS, dump())
    const renamed = structuredClone(payload)
    renamed.items.ore.name = 'Ore II'
    expect(isSameCatalogData({ ...renamed, _meta: {} }, payload, SECTIONS)).toBe(false)
  })

  it('ignores key order within an entry', () => {
    const payload = catalogPayload(SECTIONS, dump())
    const reordered = structuredClone(payload)
    reordered.items.ore = { name: 'Ore', id: 'ore' }
    expect(isSameCatalogData({ ...reordered, _meta: {} }, payload, SECTIONS)).toBe(true)
  })

  it('is false when there is no previous file', () => {
    const payload = catalogPayload(SECTIONS, dump())
    expect(isSameCatalogData(undefined, payload, SECTIONS)).toBe(false)
    expect(isSameCatalogData(null, payload, SECTIONS)).toBe(false)
  })

  it('is false when the previous file is missing a section entirely', () => {
    const payload = catalogPayload(SECTIONS, dump())
    const { ships, ...withoutShips } = payload
    expect(isSameCatalogData({ ...withoutShips, _meta: {} }, payload, SECTIONS)).toBe(false)
  })

  it('only compares the sections it was asked about', () => {
    const payload = catalogPayload(['items'], dump())
    const previous = { ...payload, ships: { junk: {} }, _meta: {} }
    expect(isSameCatalogData(previous, payload, ['items'])).toBe(true)
  })
})
