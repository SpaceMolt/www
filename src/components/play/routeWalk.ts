import type { RouteStep } from '@spacemolt/lib'
import type { AccountStore, RunMutation } from '@/lib/spacemolt'
import { errorMessage } from './shared'
import type { PlannedRoute } from './panels/GalaxyPanel'

type Account = AccountStore['account']

/** A wormhole hop is taken by jumping to its entrance POI from the previous system. */
export function jumpTarget(step: Pick<RouteStep, 'system_id' | 'via_wormhole' | 'entrance_poi'>): string {
  return step.via_wormhole && step.entrance_poi ? step.entrance_poi : step.system_id
}

/** Server route (includes known wormholes) to a system, POI, or base ID; null when none exists. */
export async function findRoute(account: Account, id: string): Promise<PlannedRoute | null> {
  const data = (await account.commands.spacemolt.find_route({ id })).structuredContent
  if (!data?.found) return null
  return {
    route: data.route,
    totalJumps: data.total_jumps,
    targetSystem: data.target_system,
    fuelPerJump: data.fuel_per_jump,
    estimatedFuel: data.estimated_fuel,
    fuelAvailable: data.fuel_available,
    targetPoi: data.target_poi,
  }
}

/** The speed the server times trips with: ship speed after crew efficiency. */
export const travelSpeed = (ship: { speed?: number; operational_speed?: number } | null | undefined): number =>
  ship?.operational_speed || ship?.speed || 1

/** A jump: 7 − speed ticks, cut to whole ticks as the server does, at least one. Disruption, skills and wormholes change it. */
export function jumpEstimateMs(shipSpeed: number): number {
  return Math.max(1, Math.trunc(7 - shipSpeed)) * 10_000
}

type Position = { x?: number; y?: number } | undefined

/** Beyond this many AU, the server charges an in-system trip less than its real distance. */
const LONG_TRIP_AU = 4

/** The distance the server charges for an in-system trip: the real AU up to 4, sqrt(4 x AU) beyond. */
export const chargedAU = (distance: number): number => (distance <= LONG_TRIP_AU ? distance : Math.sqrt(LONG_TRIP_AU * distance))

/** The real distance that a charged distance covers: the inverse of chargedAU. */
export const reachAU = (charged: number): number => (charged <= LONG_TRIP_AU ? charged : charged ** 2 / LONG_TRIP_AU)

/** In-system travel: one 10 s tick per charged distance/speed unit, at least one tick. */
export function travelEstimateMs(from: Position, to: Position, shipSpeed: number): number {
  const distance = Math.hypot((to?.x ?? 0) - (from?.x ?? 0), (to?.y ?? 0) - (from?.y ?? 0))
  return Math.max(1, Math.ceil(chargedAU(distance) / Math.max(0.1, shipSpeed))) * 10_000
}

/** Refuel at this system's station, travelling there first. Returns the station name, or null when there is none. */
async function refuelAtStation(account: Account, run: RunMutation): Promise<string | null> {
  const data = (await account.commands.spacemolt.get_system()).structuredContent
  const station = data && 'system' in data ? data.system.pois.find((p) => p.has_base) : undefined
  if (!station) return null
  if (account.location?.poi_id !== station.id) {
    await run((c) => c.spacemolt.travel({ id: station.id }), { label: 'travel' })
  }
  await run((c) => c.spacemolt.refuel(), { label: 'refuel' })
  return station.base_name || station.name
}

interface WalkOptions {
  fuelPerJump: number
  shipSpeed: number
  /** Returns a reason to stop (abort request, combat), or null to keep going. */
  stopReason: () => string | null
  onJumpStart?: (jumpIndex: number) => void
  onJumpDone?: (jumpIndex: number) => void
  onRefuel?: (where: string) => void
}

/**
 * Jump along a find_route route (first step = current system). Takes wormhole
 * hops via their entrance POI and stops to refuel when the tank cannot cover
 * the rest of the route. Returns null on arrival or the reason it stopped.
 */
export async function walkRoute(
  account: Account,
  run: RunMutation,
  route: RouteStep[],
  { fuelPerJump, shipSpeed, stopReason, onJumpStart, onJumpDone, onRefuel }: WalkOptions,
): Promise<string | null> {
  for (let i = 1; i < route.length; i++) {
    const stop = stopReason()
    if (stop) return stop

    const fuel = account.ship?.fuel ?? 0
    if (fuel < fuelPerJump * (route.length - i)) { // tank cannot cover the rest
      try {
        const station = await refuelAtStation(account, run)
        if (station) onRefuel?.(station)
        else if (fuel < fuelPerJump) {
          // No station here: burn fuel cells from cargo, the only option left.
          await run((c) => c.spacemolt.refuel(), { label: 'refuel' })
          onRefuel?.('fuel cells')
        }
      } catch (err) {
        if (fuel < fuelPerJump) return `Out of fuel at ${route[i - 1].name}: ${errorMessage(err)}`
      }
    }

    onJumpStart?.(i - 1)
    try {
      await run((c) => c.spacemolt.jump({ id: jumpTarget(route[i]) }), { label: 'jump', estimatedMs: jumpEstimateMs(shipSpeed), target: route[i].name })
    } catch (err) {
      return `Jump to ${route[i].name} failed: ${errorMessage(err)}`
    }
    const afterJump = stopReason()
    if (afterJump) return afterJump
    onJumpDone?.(i - 1)
  }
  return null
}
