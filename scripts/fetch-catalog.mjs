#!/usr/bin/env node

/**
 * Fetches the full game catalog from the SpaceMolt game server and splits it
 * into TWO data files.
 *
 * Source: the one-shot dump at GET /api/catalog.json, which returns
 * `{ version, ships, skills, recipes, items, facilities }` as flat arrays.
 * (`items` includes modules.) The payload is ~4.9 MB raw, gzipped on the wire,
 * ETag'd and cached for 1h, so a single request replaces the ~40 paginated
 * POSTs to /api/v2/spacemolt_catalog we used to make. The per-entry shapes are
 * identical (modulo key order) to what the paged endpoint returned for
 * items/recipes/ships, so existing /play consumers are unaffected.
 *
 * WHY TWO FILES — this split is load-bearing, do not merge them back:
 *
 *   src/data/catalog.json           { items, recipes, ships, _meta }   ~1.2 MB
 *     Consumed by src/data/catalog.ts, which six 'use client' components in
 *     /play import. A static JSON import is inlined wholesale into the client
 *     bundle, so EVERY BYTE IN THIS FILE IS DOWNLOADED BY EVERY PLAYER loading
 *     the web client. Keep it to data /play actually uses.
 *
 *   src/data/catalog-reference.json { skills, facilities, _meta }      ~2.2 MB
 *     Consumed only by src/data/catalogReference.ts, which is marked
 *     `import 'server-only'`. Used by the /codex/* pages, which are
 *     server-rendered at build time — so this never reaches the browser.
 *
 * Run as a prebuild step — requires no session and no auth.
 *
 * Usage: node scripts/fetch-catalog.mjs
 */

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/** The endpoint is rate limited; a concurrent build can bounce us off a 429. */
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 20_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchCatalog() {
  let lastErr

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(`${GAME_SERVER}/api/catalog.json`, {
        headers: { Accept: 'application/json' },
      })
      if (!resp.ok) {
        throw new Error(`GET /api/catalog.json returned ${resp.status} ${resp.statusText}`)
      }
      return await resp.json()
    } catch (err) {
      lastErr = err
      if (attempt < MAX_ATTEMPTS) {
        console.log(`  Attempt ${attempt} failed (${err.message}) — retrying in ${RETRY_DELAY_MS / 1000}s...`)
        await sleep(RETRY_DELAY_MS)
      }
    }
  }

  throw lastErr
}

/** Turn a flat array of `{ id, ... }` entries into an id-keyed map. */
function byId(entries) {
  const map = {}
  for (const entry of entries ?? []) {
    map[entry.id] = entry
  }
  return map
}

/** The two files we emit, and the dump sections that go into each. */
const OUTPUTS = {
  'catalog.json': ['items', 'recipes', 'ships'],
  'catalog-reference.json': ['skills', 'facilities'],
}

async function main() {
  console.log(`Fetching catalog from ${GAME_SERVER}/api/catalog.json...`)

  const dump = await fetchCatalog()

  const { writeFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const fetchedAt = new Date().toISOString()
  const version = dump.version ?? null

  console.log(`  Game version: ${version}`)

  for (const [filename, sections] of Object.entries(OUTPUTS)) {
    const data = {}
    const counts = {}

    for (const section of sections) {
      data[section] = byId(dump[section])
      counts[section] = Object.keys(data[section]).length

      // A truncated or garbage response should fail the build (and fall back to
      // the last good file) rather than silently shipping an empty catalog.
      if (counts[section] === 0) {
        throw new Error(`catalog dump contained no ${section}`)
      }
    }

    const json = JSON.stringify({
      ...data,
      _meta: { fetchedAt, server: GAME_SERVER, version, counts },
    })

    writeFileSync(resolve(import.meta.dirname, '..', 'src', 'data', filename), json)

    const size = (json.length / 1024).toFixed(0)
    const summary = sections.map((s) => `${counts[s]} ${s}`).join(', ')
    console.log(`  Written to src/data/${filename} (${size} KB) — ${summary}`)
  }
}

main().catch(async (err) => {
  console.error('Failed to fetch catalog:', err.message)
  const { existsSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const dataPath = (f) => resolve(import.meta.dirname, '..', 'src', 'data', f)
  const missing = Object.keys(OUTPUTS).filter((f) => !existsSync(dataPath(f)))

  if (missing.length === 0) {
    console.log(`  Using stale ${Object.keys(OUTPUTS).join(' + ')} from previous build`)
    process.exit(0)
  } else {
    console.error(`  Missing ${missing.join(', ')} — build cannot proceed without catalog data`)
    process.exit(1)
  }
})
