'use client'

/**
 * The current system's POI list and the current POI's rich detail
 * (description, base_id, position) — neither is a cached state section, so
 * they are fetched via get_system/get_poi and refreshed when the location
 * section changes (arrival, jump, dock).
 */
import type { GetPoiResponse, GetSystemResponse } from '@spacemolt/lib'
import { useLocationState } from './hooks'
import { useCommandQuery, type CommandQueryResult } from './useCommandQuery'

export function useSystem(): CommandQueryResult<GetSystemResponse | undefined> {
  const location = useLocationState()
  return useCommandQuery(
    async (account) => {
      // The response is a kind-union; the transit variant (mid-jump) carries no
      // system detail, so surface it as "no data" like any other empty state.
      const response = (await account.commands.spacemolt.get_system()).structuredContent
      return response?.kind === 'normal' ? response : undefined
    },
    [location?.system_id],
    { enabled: Boolean(location?.system_id), refreshOnSections: ['location'] },
  )
}

export function usePoi(): CommandQueryResult<GetPoiResponse | undefined> {
  const location = useLocationState()
  return useCommandQuery(
    async (account) => {
      const response = (await account.commands.spacemolt.get_poi()).structuredContent
      return response?.kind === 'normal' ? response : undefined
    },
    [location?.poi_id],
    { enabled: Boolean(location?.poi_id), refreshOnSections: ['location'] },
  )
}
