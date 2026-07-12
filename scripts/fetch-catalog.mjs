#!/usr/bin/env node

/**
 * Fetches the full game catalog from the SpaceMolt game server and splits it
 * into TWO data files.
 *
 * Primary source: the one-shot dump at GET /api/catalog.json, which returns
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
 * THREE LEVELS OF FALLBACK — both JSON files are gitignored, so a CI build
 * starts with nothing on disk and one failed request is a failed build:
 *
 *   1. GET /api/catalog.json (with retry/backoff). Everything, one request.
 *   2. The old paged path: POST /api/v2/session, then page
 *      POST /api/v2/spacemolt_catalog for items/recipes/ships. Production still
 *      rate limits the dump to 1 req/min/IP and Vercel can build the same branch
 *      twice inside that window, so this keeps the build alive when the dump
 *      429s. It serves NO skills and NO facilities — on this path we write an
 *      EMPTY reference file (unless a previous build left a good one, in which
 *      case stale beats empty), and the codex skills + facilities pages render
 *      an "unavailable" state rather than crashing the build.
 *   3. Whatever's already on disk from a previous build.
 *
 * Run as a prebuild step — requires no login (the paged path needs only an
 * anonymous session).
 *
 * Usage: node scripts/fetch-catalog.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/** The dump endpoint is rate limited; a concurrent build can bounce us off a 429. */
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 20_000

/** Page size for the fallback paged endpoint. */
const PAGE_SIZE = 50

/** The two files we emit, and the dump sections that go into each. */
const OUTPUTS = {
  'catalog.json': ['items', 'recipes', 'ships'],
  'catalog-reference.json': ['skills', 'facilities'],
}

/** Sections the paged fallback cannot supply — there is no endpoint for them. */
const PAGED_CANNOT_SUPPLY = ['skills', 'facilities']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const dataPath = (filename) => resolve(import.meta.dirname, '..', 'src', 'data', filename)

// ── Source 1: the one-shot dump ─────────────────────────────────────────

async function fetchDump() {
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

// ── Source 2: the paged API (items / recipes / ships only) ──────────────

/**
 * POST some JSON and get JSON back, retrying on transient failures.
 *
 * The paged path makes ~40 requests where the dump makes one, and every one of
 * them is a chance to lose the build. In practice a single page will now and
 * then die with undici's `terminated` (the server hangs up mid-body) — so each
 * request gets its own short retry rather than taking the whole build down.
 */
async function postJSON(path, body, headers = {}, label = path) {
  const ATTEMPTS = 3
  let lastErr

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(`${GAME_SERVER}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        throw new Error(`POST ${label} returned ${resp.status} ${resp.statusText}`)
      }
      return await resp.json()
    } catch (err) {
      lastErr = err
      if (attempt < ATTEMPTS) await sleep(2000 * attempt)
    }
  }

  throw new Error(`POST ${label} failed after ${ATTEMPTS} attempts: ${lastErr.message}`)
}

async function createSession() {
  const data = await postJSON('/api/v2/session', {})
  const id = data?.session?.id
  if (!id) throw new Error('POST /api/v2/session returned no session id')
  return id
}

async function fetchPaginated(sessionId, params) {
  const all = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const data = await postJSON(
      '/api/v2/spacemolt_catalog',
      { ...params, page, page_size: PAGE_SIZE },
      { 'X-Session-Id': sessionId },
      `/api/v2/spacemolt_catalog (${params.type} page ${page})`,
    )
    const sc = data.structuredContent || {}

    all.push(...(sc.items || sc.recipes || sc.ships || []))

    totalPages = sc.total_pages || 1
    page++
  }

  return all
}

/** Same shape as the dump, minus the sections the paged API cannot serve. */
async function fetchPaged() {
  const sessionId = await createSession()
  console.log('  Session created')

  const [items, recipes, ships] = await Promise.all([
    fetchPaginated(sessionId, { type: 'items', search: '' }),
    fetchPaginated(sessionId, { type: 'recipes' }),
    fetchPaginated(sessionId, { type: 'ships' }),
  ])

  return { version: null, items, recipes, ships, skills: [], facilities: [] }
}

// ── Writing ─────────────────────────────────────────────────────────────

/** Turn a flat array of `{ id, ... }` entries into an id-keyed map. */
function byId(entries) {
  const map = {}
  for (const entry of entries ?? []) {
    map[entry.id] = entry
  }
  return map
}

/**
 * Write one output file. `allowEmpty` names the sections this source is known
 * not to carry — those may come out empty (and stamp the file `partial`) instead
 * of failing the build.
 */
function writeOutput(filename, sections, dump, { fetchedAt, version, source, allowEmpty }) {
  const data = {}
  const counts = {}
  let partial = false

  for (const section of sections) {
    data[section] = byId(dump[section])
    counts[section] = Object.keys(data[section]).length

    if (counts[section] === 0) {
      // A truncated or garbage response should fail the build (and fall through
      // to the last good file) rather than silently shipping an empty catalog —
      // unless this source simply has no such section to give.
      if (!allowEmpty.includes(section)) {
        throw new Error(`catalog ${source} contained no ${section}`)
      }
      partial = true
    }
  }

  const json = JSON.stringify({
    ...data,
    _meta: { fetchedAt, server: GAME_SERVER, version, counts, source, partial },
  })

  writeFileSync(dataPath(filename), json)

  const size = (json.length / 1024).toFixed(0)
  const summary = sections.map((s) => `${counts[s]} ${s}`).join(', ')
  console.log(`  Written to src/data/${filename} (${size} KB) — ${summary}${partial ? ' [PARTIAL]' : ''}`)
}

/** True if the file on disk already holds real data for every one of `sections`. */
function hasGoodData(filename, sections) {
  try {
    const existing = JSON.parse(readFileSync(dataPath(filename), 'utf8'))
    return sections.every((s) => Object.keys(existing[s] ?? {}).length > 0)
  } catch {
    return false
  }
}

async function main() {
  let dump
  let source

  console.log(`Fetching catalog from ${GAME_SERVER}/api/catalog.json...`)

  try {
    dump = await fetchDump()
    source = 'dump'
  } catch (err) {
    console.warn(`  Catalog dump unavailable (${err.message})`)
    console.warn(`  Falling back to the paged API at ${GAME_SERVER}/api/v2/spacemolt_catalog...`)
    dump = await fetchPaged()
    source = 'paged'
    console.warn('  NOTE: the paged API serves no skills and no facilities — those codex')
    console.warn('        pages will render an "unavailable" state on this build.')
  }

  const fetchedAt = new Date().toISOString()
  const version = dump.version ?? null
  const allowEmpty = source === 'paged' ? PAGED_CANNOT_SUPPLY : []

  console.log(`  Source: ${source}${version ? `, game version: ${version}` : ''}`)

  for (const [filename, sections] of Object.entries(OUTPUTS)) {
    // A degraded source has nothing to say about skills/facilities. If the last
    // build left a complete file there, keep it — stale beats empty.
    const degrades = sections.some((s) => allowEmpty.includes(s))
    if (degrades && hasGoodData(filename, sections)) {
      console.log(`  Keeping existing src/data/${filename} — the paged API cannot refresh it`)
      continue
    }

    writeOutput(filename, sections, dump, { fetchedAt, version, source, allowEmpty })
  }
}

main().catch((err) => {
  console.error('Failed to fetch catalog:', err.message)

  const missing = Object.keys(OUTPUTS).filter((f) => !existsSync(dataPath(f)))

  if (missing.length === 0) {
    console.log(`  Using stale ${Object.keys(OUTPUTS).join(' + ')} from previous build`)
    process.exit(0)
  } else {
    console.error(`  Missing ${missing.join(', ')} — build cannot proceed without catalog data`)
    process.exit(1)
  }
})
