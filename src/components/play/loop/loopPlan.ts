/**
 * Pure model for the client-side task loop runner: step types, presets,
 * position advance, error outcomes, and saved-plan storage.
 */

export type LoopStep =
  | { kind: 'mine' }
  | { kind: 'goto'; poiId: string; label: string }
  | { kind: 'sell_all' }
  | { kind: 'sell'; itemIds: string[] }
  | { kind: 'deposit'; target: 'storage' | 'faction' }
  | { kind: 'refuel' }
  | { kind: 'repair' }
  | { kind: 'craft'; recipeId: string; count: number }
  | { kind: 'wait'; seconds: number }

export interface LoopPlan {
  name: string
  steps: LoopStep[]
  /** Number of full passes; 0 runs until stopped. */
  repeat: number
}

export interface LoopPosition {
  stepIndex: number
  /** 1-based pass number. */
  loop: number
}

export function stepLabel(step: LoopStep): string {
  switch (step.kind) {
    case 'mine': return 'Mine until full'
    case 'goto': return `Go to ${step.label}`
    case 'sell_all': return 'Sell all cargo'
    case 'sell': return `Sell ${step.itemIds.join(', ')}`
    case 'deposit': return step.target === 'faction' ? 'Deposit cargo to faction' : 'Deposit cargo to storage'
    case 'refuel': return 'Refuel'
    case 'repair': return 'Repair'
    case 'craft': return `Craft ${step.count} x ${step.recipeId}`
    case 'wait': return `Wait ${step.seconds}s`
  }
}

/** Next position after a finished step, or null when the plan is done. */
export function advance({ stepIndex, loop }: LoopPosition, { steps, repeat }: LoopPlan): LoopPosition | null {
  if (stepIndex + 1 < steps.length) return { stepIndex: stepIndex + 1, loop }
  if (repeat > 0 && loop >= repeat) return null
  return { stepIndex: 0, loop: loop + 1 }
}

/** Codes that mean the ship is not free to act; the whole loop aborts. */
export const ABORT_CODES = new Set(['in_battle', 'in_combat', 'ship_incapacitated', 'in_fleet'])

const EMPTY_DEPOSIT_CODES = new Set(['depleted', 'no_resources', 'deposit_too_sparse'])

/**
 * What a failed step means for the loop. `halt: false` moves on to the next
 * step; `halt: true` stops the loop with `reason`.
 */
export function errorOutcome(
  step: LoopStep,
  { code = '', message = 'Action failed', cargoUsed = 0 }: { code?: string; message?: string; cargoUsed?: number } = {},
): { halt: boolean; reason: string } {
  if (ABORT_CODES.has(code)) return { halt: true, reason: `Aborted: ${message}` }
  if (code === 'cargo_full') return { halt: false, reason: 'Cargo full' }
  if (step.kind === 'mine' && EMPTY_DEPOSIT_CODES.has(code)) {
    // With ore aboard, carry on to sell it; with an empty hold the loop would spin.
    return cargoUsed > 0
      ? { halt: false, reason: `Deposit empty, moving on: ${message}` }
      : { halt: true, reason: `Deposit empty: ${message}` }
  }
  if (code === 'fuel_full' || code === 'hull_full') return { halt: false, reason: message }
  return { halt: true, reason: message }
}

/** Mine here, sell at a station, refuel, repeat. Starts with a goto so it works from either end. */
export function mineSellPreset(
  { minePoi, station, deposit = false }: { minePoi: { id: string; name: string }; station: { id: string; name: string }; deposit?: boolean },
): LoopPlan {
  return {
    name: `Mine ${minePoi.name} -> ${deposit ? 'store' : 'sell'} at ${station.name}`,
    repeat: 0,
    steps: [
      { kind: 'goto', poiId: minePoi.id, label: minePoi.name },
      { kind: 'mine' },
      { kind: 'goto', poiId: station.id, label: station.name },
      deposit ? { kind: 'deposit', target: 'storage' } : { kind: 'sell_all' },
      { kind: 'refuel' },
    ],
  }
}

// Per player: characters sharing a browser keep their own plans and maps.
const STORAGE_KEY = 'spacemolt.play.loopPlans'

export function loadPlans(playerId: string | undefined, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): LoopPlan[] {
  if (!playerId) return []
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(`${STORAGE_KEY}.${playerId}`) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isPlan) : []
  } catch {
    return []
  }
}

export function savePlans(playerId: string | undefined, plans: LoopPlan[], storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  if (!playerId) return
  try {
    storage?.setItem(`${STORAGE_KEY}.${playerId}`, JSON.stringify(plans))
  } catch {
    // Private mode or full storage: plans live for this tab only.
  }
}

/** A POI the player can pick for a goto step: seen in a visited system, a public station, or faction intel. */
export interface KnownPoi {
  id: string
  name: string
  systemId: string
  systemName: string
}

const POIS_KEY = 'spacemolt.play.knownPois'

export function loadKnownPois(playerId: string | undefined, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): KnownPoi[] {
  if (!playerId) return []
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(`${POIS_KEY}.${playerId}`) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p?.id === 'string' && typeof p?.systemId === 'string') : []
  } catch {
    return []
  }
}

/** Merge newly seen POIs into the remembered list (newer entries replace older ones with the same id). */
export function mergePois(known: KnownPoi[], seen: KnownPoi[]): KnownPoi[] {
  const ids = new Set(seen.map((p) => p.id))
  return [...known.filter((p) => !ids.has(p.id)), ...seen]
}

export function rememberPois(playerId: string | undefined, seen: KnownPoi[], storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage): void {
  if (!playerId) return
  try {
    storage?.setItem(`${POIS_KEY}.${playerId}`, JSON.stringify(mergePois(loadKnownPois(playerId, storage), seen)))
  } catch {
    // Storage unavailable: the picker falls back to stations and intel.
  }
}

const STEP_KINDS = new Set<string>(['mine', 'goto', 'sell_all', 'sell', 'deposit', 'refuel', 'repair', 'craft', 'wait'])

function isPlan(value: unknown): value is LoopPlan {
  const plan = value as LoopPlan
  return typeof plan?.name === 'string' && typeof plan.repeat === 'number' &&
    Array.isArray(plan.steps) && plan.steps.every((s) => STEP_KINDS.has(s?.kind))
}
