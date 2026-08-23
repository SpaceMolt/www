/**
 * Provenance for the two generated catalog files — when each was fetched, from
 * which server, at which game version. Written by scripts/fetch-catalog.mjs.
 *
 * ⚠️ SERVER-ONLY, AND THAT IS THE POINT.
 * These files carry a fresh `fetchedAt` on every build, so whatever inlines them
 * re-hashes on every build. `catalog.json` (1.2 MB) is inlined into the client
 * bundle, so if provenance lived there — as it used to, under `_meta` — every
 * player re-downloaded the whole catalog on every deploy even when no game data
 * moved. Keeping it here means the big file's bytes only move when the data does.
 *
 * Do NOT re-export any of this from src/data/catalog.ts.
 */

import 'server-only'

import rawCatalogMeta from './catalog-meta.json'
import rawReferenceMeta from './catalog-reference-meta.json'
import type { CatalogMeta } from './catalog'

type ReferenceMeta = CatalogMeta<{
  skills: number
  facilities: number
  achievements: number
  faction_achievements: number
}> & {
  /** How many player achievements are secret (withheld from the dump) */
  hidden_achievement_count?: number
  /** How many faction achievements are secret (withheld from the dump) */
  hidden_faction_achievement_count?: number
}

/** Provenance for catalog.json — items, recipes, ships. */
export const catalogMeta = rawCatalogMeta as unknown as Readonly<
  CatalogMeta<{ items: number; recipes: number; ships: number }>
>

/** Provenance for catalog-reference.json — skills, facilities, achievements. */
export const referenceMeta = rawReferenceMeta as unknown as Readonly<ReferenceMeta>
