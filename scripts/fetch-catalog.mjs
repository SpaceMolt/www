#!/usr/bin/env node

/**
 * Fetches the full game catalog (items, modules, recipes, ships) from the
 * SpaceMolt game server and writes it to src/data/catalog.json.
 *
 * Run as a prebuild step — requires only an anonymous session (no login).
 *
 * Usage: node scripts/fetch-catalog.mjs
 */

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const PAGE_SIZE = 50

async function createSession() {
  const resp = await fetch(`${GAME_SERVER}/api/v2/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const data = await resp.json()
  return data.session.id
}

async function fetchPaginated(sessionId, params) {
  const all = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const resp = await fetch(`${GAME_SERVER}/api/v2/spacemolt_catalog/help`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({ ...params, page, page_size: PAGE_SIZE }),
    })
    const data = await resp.json()
    const sc = data.structuredContent || {}

    const items = sc.items || sc.recipes || sc.ships || []
    all.push(...items)

    totalPages = sc.total_pages || 1
    page++
  }

  return all
}

async function main() {
  console.log(`Fetching catalog from ${GAME_SERVER}...`)

  const sessionId = await createSession()
  console.log('  Session created')

  // Fetch all catalog types in parallel (items search includes modules)
  const [items, recipes, ships] = await Promise.all([
    fetchPaginated(sessionId, { type: 'items', search: '' }),
    fetchPaginated(sessionId, { type: 'recipes' }),
    fetchPaginated(sessionId, { type: 'ships' }),
  ])

  console.log(`  Items: ${items.length}, Recipes: ${recipes.length}, Ships: ${ships.length}`)

  const itemMap = {}
  for (const item of items) {
    itemMap[item.id] = item
  }

  const recipeMap = {}
  for (const recipe of recipes) {
    recipeMap[recipe.id] = recipe
  }

  const shipMap = {}
  for (const ship of ships) {
    shipMap[ship.id] = ship
  }

  const catalog = {
    items: itemMap,
    recipes: recipeMap,
    ships: shipMap,
    _meta: {
      fetchedAt: new Date().toISOString(),
      server: GAME_SERVER,
      counts: {
        items: Object.keys(itemMap).length,
        recipes: Object.keys(recipeMap).length,
        ships: Object.keys(shipMap).length,
      },
    },
  }

  const { writeFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const outPath = resolve(import.meta.dirname, '..', 'src', 'data', 'catalog.json')
  writeFileSync(outPath, JSON.stringify(catalog))

  const size = (JSON.stringify(catalog).length / 1024).toFixed(0)
  console.log(`  Written to src/data/catalog.json (${size} KB)`)
  console.log(`  Total: ${Object.keys(itemMap).length} items, ${Object.keys(recipeMap).length} recipes, ${Object.keys(shipMap).length} ships`)
}

main().catch((err) => {
  console.error('Failed to fetch catalog:', err.message)
  // Don't fail the build — stale catalog is better than no build
  process.exit(0)
})
