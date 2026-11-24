'use client'

/**
 * The current system's POI list and the current POI's rich detail
 * (description, base_id, position) — neither is a cached state section, so
 * they are fetched via get_system/get_poi and refreshed when the location
 * section changes (arrival, jump, dock).
 */
import type { Account, GetPoiResponse, GetSystemResponse } from '@spacemolt/lib'
import { useLocationState } from './hooks'
import { useCommandQuery, type CommandQueryResult } from './useCommandQuery'

/**
 * Descriptions of the POIs this browser has visited. get_system charts carry none, and get_poi
 * only answers for the POI you are at, so the map shows what you have seen before.
 */
const DESCRIPTIONS_KEY = 'spacemolt.poiDescriptions'
let descriptions: Record<string, string> | undefined
const loadDescriptions = () => {
  if (!descriptions) {
    try { descriptions = JSON.parse(localStorage.getItem(DESCRIPTIONS_KEY) ?? '{}') } catch { descriptions = {} }
  }
  return descriptions!
}
function rememberPoiDescription(id: string, description?: string) {
  if (!description || loadDescriptions()[id] === description) return
  loadDescriptions()[id] = description
  try { localStorage.setItem(DESCRIPTIONS_KEY, JSON.stringify(descriptions)) } catch { /* storage full or blocked: keep it for this session */ }
}
export const knownPoiDescription = (id: string): string | undefined => loadDescriptions()[id]

/**
 * Several panels mount useSystem/usePoi at once, and each re-runs on the same
 * location change. Share one request per account and key for a short window so
 * they cost one get_system/get_poi, not one each.
 */
const SHARE_MS = 2_000
const shared = new WeakMap<Account, Map<string, { at: number; result: Promise<unknown> }>>()
export const shareRead = <T,>(account: Account, key: string, read: () => Promise<T>): Promise<T> => {
  const reads = shared.get(account) ?? new Map<string, { at: number; result: Promise<unknown> }>()
  shared.set(account, reads)
  const hit = reads.get(key)
  if (hit && Date.now() - hit.at < SHARE_MS) return hit.result as Promise<T>
  const result = read()
  reads.set(key, { at: Date.now(), result })
  return result
}

export function useSystem(): CommandQueryResult<GetSystemResponse | undefined> {
  const location = useLocationState()
  return useCommandQuery(
    async (account) => {
      // The response is a kind-union; the transit variant (mid-jump) carries no
      // system detail, so surface it as "no data" like any other empty state.
      const response = (await shareRead(account, `system:${location?.system_id}`, () => account.commands.spacemolt.get_system())).structuredContent
      return response?.kind === 'normal' ? response : undefined
    },
    [location?.system_id],
    { enabled: Boolean(location?.system_id), refreshOnSections: ['location'] },
  )
}

export function usePoi(): CommandQueryResult<GetPoiResponse | undefined> {
  const location = useLocationState()
  const query = useCommandQuery(
    async (account) => {
      const response = (await shareRead(account, `poi:${location?.poi_id}`, () => account.commands.spacemolt.get_poi())).structuredContent
      if (response?.kind !== 'normal') return undefined
      rememberPoiDescription(response.poi.id, response.poi.description)
      return response
    },
    [location?.poi_id],
    { enabled: Boolean(location?.poi_id), refreshOnSections: ['location'] },
  )
  // Adrift (no POI, e.g. after an outpost is dismantled) the last POI's data would linger; drop it.
  return location?.poi_id ? query : { ...query, data: undefined }
}
