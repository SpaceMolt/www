import type { BattleLogEntry, BattleSummary } from '../battle/types'

export type CinemaFate = 'survived' | 'destroyed' | 'knocked_out' | 'escaped' | 'captured' | 'withdrawn'
export type CinemaCueKind = 'weapon' | 'death' | 'knockout' | 'escape' | 'capture' | 'arrival' | 'burn'
export type CinemaShotKind = 'reveal' | 'tracking' | 'broadside' | 'pursuit' | 'impact' | 'aftermath'

export interface CinemaHealth {
  time: number
  /** Fractions of maximum capacity, clamped to 0–1. */
  hull: number
  shield: number
}

/** One appearance of a hull; a pilot returning after loss gets a new ID. */
export interface CinemaShip {
  id: string
  playerId: string
  name: string
  shipClass: string
  kind: string
  sideId: number
  sideIndex: number
  factionId?: string
  start: number
  /** Time the hull stops fighting. Wreck/disabled aftermath can remain visible. */
  end: number
  fate: CinemaFate
  health: CinemaHealth[]
  /** Recorded intact capture metadata, never a destruction. */
  capturedBy?: string
  capturedShipId?: string
}

export interface CinemaCue {
  id: string
  time: number
  duration: number
  tick: number
  kind: CinemaCueKind
  /** Lifecycle IDs, not raw player IDs. */
  from?: string
  to?: string
  damageType?: string
  hit?: boolean
  shieldDamage?: number
  hullDamage?: number
  intensity: number
  secondaryKind?: string
  /** Associates collateral with a primary cue without inventing another gun. */
  parentId?: string
  weaponName?: string
}

export interface CinemaShot {
  start: number
  end: number
  kind: CinemaShotKind
  subject?: string
  target?: string
  intensity: number
}

export interface CinemaSourceSegment {
  start: number
  end: number
  tick: number
}

/** Serializable, renderer-independent edit. All times are seconds. */
export interface CinemaFilm {
  version: number
  battleId: string
  seed: number
  duration: number
  arena: boolean
  outcome: string
  winningSide: number
  systemName: string
  ships: CinemaShip[]
  shots: CinemaShot[]
  cues: CinemaCue[]
  segments: CinemaSourceSegment[]
}

export interface CinemaWorkerRequest {
  summary: BattleSummary
  entries: BattleLogEntry[]
  /** Only the shared loader's complete phase establishes reconciliation. */
  reconciled: true
}

export type CinemaWorkerResponse = { film: CinemaFilm } | { error: string }

export type Film = CinemaFilm

