/**
 * Canonical empire-id source of truth for tests.
 *
 * There is intentionally no single canonical list of empire ids in production
 * code — nearly every codex/dashboard/panel file that needs a `solarian |
 * voidborn | crimson | nebula | outerrim` lookup defines its own small
 * `Record<string, T>` literal (see grep for `EMPIRE_NAMES` / `EMPIRE_COLORS` /
 * etc. across `src/`). That's existing architecture, not something this file
 * changes. What it does fix is that every one of those maps previously had no
 * test verifying its *key set* — only whether known-good ids produced
 * known-good output — which is exactly how a typo'd extra key like
 * `outer_rim` alongside the correct `outerrim` slipped through undetected.
 *
 * Import `CANONICAL_EMPIRE_IDS` + `expectExactEmpireKeys` in any test that
 * touches one of these maps so every test agrees on the same 5 ids instead of
 * each hardcoding (and risking drift in) its own copy.
 *
 * Canonical display names are derived from en.json (the actual source of
 * truth for player-facing strings) rather than re-hardcoded here.
 */
import { expect } from 'bun:test'
import en from '@/i18n/translations/en.json'

export const CANONICAL_EMPIRE_IDS = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim'] as const

export type CanonicalEmpireId = (typeof CANONICAL_EMPIRE_IDS)[number]

/** PascalCase i18n key suffix per empire id, e.g. crimson -> 'Crimson', outerrim -> 'OuterRim'. */
export const EMPIRE_ID_TO_I18N_SUFFIX: Record<CanonicalEmpireId, string> = {
  solarian: 'Solarian',
  voidborn: 'Voidborn',
  crimson: 'Crimson',
  nebula: 'Nebula',
  outerrim: 'OuterRim',
}

/** Full display names, e.g. "Crimson Pact" — from en.json's `home.empireXName` keys. */
export const CANONICAL_EMPIRE_FULL_NAMES: Record<CanonicalEmpireId, string> = {
  solarian: en.home.empireSolarianName,
  voidborn: en.home.empireVoidbornName,
  crimson: en.home.empireCrimsonName,
  nebula: en.home.empireNebulaName,
  outerrim: en.home.empireOuterRimName,
}

/** Short display names, e.g. "Crimson" / "Outer Rim" — from en.json's `ships.empireX` keys. */
export const CANONICAL_EMPIRE_SHORT_NAMES: Record<CanonicalEmpireId, string> = {
  solarian: en.ships.empireSolarian,
  voidborn: en.ships.empireVoidborn,
  crimson: en.ships.empireCrimson,
  nebula: en.ships.empireNebula,
  outerrim: en.ships.empireOuterRim,
}

/**
 * Assert that `keys` (typically `Object.keys(SomeEmpireMap)`) is EXACTLY the
 * 5 canonical empire ids plus any explicitly allowed extras (e.g.
 * leaderboard's `pirate` bucket) — no more, no fewer. Order-independent.
 */
export function expectExactEmpireKeys(keys: string[], extraAllowedKeys: readonly string[] = []): void {
  const expected = [...CANONICAL_EMPIRE_IDS, ...extraAllowedKeys].sort()
  expect([...keys].sort()).toEqual(expected)
}
