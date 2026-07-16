/**
 * UI-local types for the /play client. Game entity and command-response types
 * come from @spacemolt/lib (generated from the server's OpenAPI spec); the
 * aliases below extract the row shapes panels pass around, and the crafting
 * types mirror gameserver apiresponses the spec exposes only loosely.
 */
import type { FacilityResponse, GetMissionsResponse } from '@spacemolt/lib'

// Row extracts shared across panels. FacilityResponse is the generated union
// across every spacemolt_facility action; the list variant is the member
// carrying station_facilities (required there, absent elsewhere).
export type FacilityListResponse = Extract<FacilityResponse, { station_facilities: unknown }>
export type Facility = FacilityListResponse['station_facilities'][number]
export type Mission = GetMissionsResponse['missions'][number]

export interface Recipe {
  id: string
  name: string
  description?: string
  category: string
  required_skills: Record<string, number>
  inputs: { item_id: string; quantity: number }[]
  outputs: { item_id: string; quantity: number; quality_mod?: boolean }[]
  crafting_time: number
  base_quality?: number
  skill_quality_mod?: number
}

// Crafting is queued, not instant: a `craft`/`recycle` enqueues a job that runs
// over ticks. These mirror the gameserver apiresponses for craft jobs/quotes
// (internal/apiresponses/facility_jobs.go).
export interface CraftStorageItem {
  item_id: string
  name?: string
  quantity: number
}

// One job in the player's queue (craft action=queue → CraftQueueResponse.jobs).
export interface CraftJobView {
  job_id: string
  venue?: string
  recipe: string
  mode: string // "craft" | "recycle"
  produces?: CraftStorageItem[]
  runs_total: number
  runs_done: number
  runs_remaining: number
  progress: number // 0..1 of the in-flight run
  eta_ticks: number
  position: number
  orderer: string
  external?: boolean
  status: string
  facility_id: string
  // last_sync_tick is client-only: the currentTick at the moment this job's
  // runs_done/progress were last confirmed by the server (a fetch or a
  // crafting_update push). Used to interpolate live progress between syncs —
  // see estimateJobProgress in panels/craftProgress.ts.
  last_sync_tick?: number
}

// Result of a dry_run craft/recycle: a cost + time quote, nothing queued.
export interface CraftQuote {
  recipe: string
  mode: string
  quantity: number
  runs: number
  venue: string
  venue_type: string // "workshop" | "facility"
  external?: boolean
  produces?: CraftStorageItem[]
  cost: { inputs?: CraftStorageItem[]; labor?: number; fee?: number }
  credits_total: number
  have_inputs: boolean
  have_credits: boolean
  effective_time_per_run: number
  est_completion_tick: number
  message: string
}
