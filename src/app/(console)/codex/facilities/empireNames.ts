/*
 * Empire id -> display shortname for the Facilities codex, split out from
 * page.tsx so it can be unit-tested without pulling in the server-only
 * catalog data (page.tsx -> ./chains -> @/data/catalogReference imports
 * `server-only`, which throws if evaluated outside a Server Component).
 */

import { titleCase } from '@/lib/format'

// Same shortnames the Ships codex shows in its table rows (see
// EMPIRE_SHORT_KEYS in codex/ships/shipMeta.ts) — kept as plain strings
// here since this is a server component with no i18n context.
export const EMPIRE_SHORT_NAMES: Record<string, string> = {
  solarian: 'Solarian',
  voidborn: 'Voidborn',
  crimson: 'Crimson',
  nebula: 'Nebula',
  outerrim: 'Outer Rim',
}

/** Display name for an empire id — falls back to a title-cased id for anything unmapped. */
export function empireShortName(empire: string): string {
  return EMPIRE_SHORT_NAMES[empire] ?? titleCase(empire.replace(/_/g, ' '))
}
