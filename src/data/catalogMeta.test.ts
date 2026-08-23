import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The one invariant that makes the split worth having: the big generated files
 * carry no build-time provenance. `catalog.json` is inlined into the client
 * bundle, so a per-build timestamp in it re-hashes the bundle and every player
 * re-downloads 1.2 MB on every deploy even when no game data moved.
 *
 * If someone folds `_meta` back into the data file, this fails loudly rather
 * than silently costing every player a download per deploy.
 */

const read = (name: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, name), 'utf8'))

const PROVENANCE = ['_meta', 'fetchedAt', 'server', 'version', 'source', 'partial', 'counts']

describe.each(['catalog.json', 'catalog-reference.json'])('%s', (name) => {
  it('carries data sections only, never provenance', () => {
    expect(Object.keys(read(name)).filter((k) => PROVENANCE.includes(k))).toEqual([])
  })
})

describe.each(['catalog-meta.json', 'catalog-reference-meta.json'])('%s', (name) => {
  it('carries the provenance the codex reports', () => {
    const meta = read(name)
    expect(meta).toHaveProperty('fetchedAt')
    expect(meta).toHaveProperty('version')
  })
})
