'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccountStore, useCommandQuery, useLocationState, useMap, useModules, usePlayer } from '@/lib/spacemolt'
import { parseSightings, starRays, TELESCOPES, type Observation, type StarClasses, type TelescopeControl } from './telescope'

// What this browser keeps for the pilot: the suns of visited systems, and pinned observations.
const CLASSES_KEY = 'spacemolt.play.starClasses'
const PINS_KEY = 'spacemolt.play.telescopePins'

function load<T>(key: string, playerId: string | undefined, empty: T): T {
  try { return JSON.parse(localStorage.getItem(`${key}.${playerId}`) ?? 'null') ?? empty } catch { return empty }
}
function save(key: string, playerId: string | undefined, value: unknown) {
  if (!playerId) return
  try { localStorage.setItem(`${key}.${playerId}`, JSON.stringify(value)) } catch { /* private mode or full storage: this tab only */ }
}

const sunClasses = (pois: { type: string; class?: string }[] = []) => pois.flatMap((p) => (p.type === 'sun' && p.class ? [p.class] : []))

/** Keep the suns of a visited system, so a later sighting can be matched to it. */
export function rememberStars(playerId: string | undefined, system: { id: string; pois: { type: string; class?: string }[] }) {
  const suns = sunClasses(system.pois)
  const known = load<StarClasses>(CLASSES_KEY, playerId, {})
  if (suns.length && known[system.id]?.join() !== suns.join()) save(CLASSES_KEY, playerId, { ...known, [system.id]: suns })
}

const isAt = (a: Observation, b: Observation) => a.x === b.x && a.y === b.y

/** The telescope overlay for both maps, or undefined when no telescope is fitted. */
export function useTelescope(): TelescopeControl | undefined {
  const store = useAccountStore()
  const location = useLocationState()
  const player = usePlayer()
  const map = useMap().data
  // A better telescope reads the same sky again.
  const scopes = useModules()?.map((m) => m.type_id).filter((id) => TELESCOPES.includes(id)).join() ?? ''
  const fitted = scopes !== ''
  const [on, setOn] = useState(false)
  const [intel, setIntel] = useState<StarClasses | null>(null)
  const [pins, setPins] = useState<Observation[]>([])
  const playerId = player?.id
  const factionId = player?.faction_id
  const active = on && fitted

  useEffect(() => { setPins(load(PINS_KEY, playerId, [])) }, [playerId])
  useEffect(() => { if (!fitted) setOn(false) }, [fitted])

  // Faction intel names the suns of systems the pilot never visited. Read it once, on first use.
  useEffect(() => {
    if (!active || !factionId || intel) return
    let cancelled = false
    const read = async () => {
      const found: StarClasses = {}
      // ponytail: 100 systems a page, 20 pages at most. Raise the cap when intel outgrows 2,000 systems.
      for (let offset = 0, total = 1; offset < total && offset < 2000; offset += 100) {
        const page = (await store.account.commands.spacemolt_intel.query_intel({ limit: 100, offset })).structuredContent
        for (const entry of page?.entries ?? []) {
          const suns = sunClasses(entry.pois)
          if (suns.length) found[entry.system_id] = suns
        }
        total = page?.total ?? 0
      }
      return found
    }
    read().then((found) => { if (!cancelled) setIntel(found) }).catch(() => { if (!cancelled) setIntel({}) }) // no intel terminal: visited systems only
    return () => { cancelled = true }
  }, [active, factionId, intel, store])

  // Only get_location carries the sightings. A drift moves each tick, so it reads again each tick.
  const { data: observation } = useCommandQuery(async (account): Promise<Observation | undefined> => {
    const here = (await account.commands.spacemolt.get_location()).structuredContent?.location
    if (!here) return undefined
    const at = here.transit_type === 'pathfinder' ? { x: here.transit_x ?? 0, y: here.transit_y ?? 0 } : here.in_transit ? undefined : map?.system(here.system_id)
    return at && { x: at.x, y: at.y, sightings: parseSightings(here) }
  }, [map, scopes, location?.system_id, location?.in_transit, location?.transit_x, location?.transit_y], { enabled: active && Boolean(map) })

  const rays = useMemo(() => {
    if (!active || !map) return []
    const classes = { ...intel, ...load<StarClasses>(CLASSES_KEY, playerId, {}) }
    return [
      ...(observation ? starRays(observation, map.systems, classes, false) : []),
      ...pins.filter((pin) => !observation || !isAt(pin, observation)).flatMap((pin) => starRays(pin, map.systems, classes, true)),
    ]
  }, [active, map, intel, playerId, observation, pins])

  if (!fitted) return undefined
  const setAndSavePins = (next: Observation[]) => { setPins(next); save(PINS_KEY, playerId, next) }
  return {
    on,
    onToggle: () => setOn((v) => !v),
    rays,
    canPin: active && Boolean(observation?.sightings.length) && !pins.some((pin) => isAt(pin, observation!)),
    pins: pins.length,
    onPin: () => observation && setAndSavePins([...pins, observation]),
    onClearPins: () => setAndSavePins([]),
  }
}
