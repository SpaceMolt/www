#!/usr/bin/env node

/**
 * Rebuilds scripts/fixtures/catalog-dump.json, the offline catalog that
 * `CATALOG_FIXTURE=1 node scripts/fetch-catalog.mjs` reads.
 *
 * Keeps each catalog entry whose id a test file quotes, the first two entries
 * of every section (so none is empty), each kept ship's default modules, and
 * each kept recipe's inputs and outputs. Rerun it when a test starts naming a
 * catalog entry the fixture lacks.
 *
 * Usage: curl -s --compressed https://game.spacemolt.com/api/catalog.json -o dump.json
 *        node scripts/trim-catalog-fixture.mjs dump.json
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SECTIONS = ['ships', 'items', 'recipes', 'skills', 'facilities', 'achievements', 'faction_achievements']

const dump = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const tests = execSync("git ls-files 'src/**/*.test.ts' 'src/**/*.test.tsx'", { encoding: 'utf8' }).trim().split('\n')
const quoted = new Set(tests.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/['"`]([a-z0-9_]+)['"`]/g)].map((m) => m[1])))

const keep = Object.fromEntries(SECTIONS.map((s) => [s, new Map()]))
const add = (section, entry) => entry && keep[section].set(entry.id, entry)
for (const s of SECTIONS) {
  for (const e of dump[s]) if (quoted.has(e.id)) add(s, e)
  for (const e of dump[s].slice(0, 2)) add(s, e)
}
const items = new Map(dump.items.map((e) => [e.id, e]))
for (const ship of keep.ships.values()) for (const id of ship.default_modules ?? []) add('items', items.get(id))
for (const r of keep.recipes.values()) for (const x of [...(r.inputs ?? []), ...(r.outputs ?? [])]) add('items', items.get(x.item_id))

const out = { ...dump, ...Object.fromEntries(SECTIONS.map((s) => [s, [...keep[s].values()]])) }
const path = resolve(import.meta.dirname, 'fixtures', 'catalog-dump.json')
writeFileSync(path, JSON.stringify(out, null, 1) + '\n')
console.log(`Wrote ${path}:`, SECTIONS.map((s) => `${out[s].length} ${s}`).join(', '))
