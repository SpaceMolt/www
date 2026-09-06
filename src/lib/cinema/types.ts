import type { BattleLogEntry, BattleSummary } from '../battle/types'
import type { CinemaWeaponFamily } from './weapons'

export type CinemaFate = 'survived' | 'destroyed' | 'knocked_out' | 'escaped' | 'captured' | 'withdrawn'
export type CinemaCueKind = 'weapon' | 'death' | 'knockout' | 'escape' | 'capture' | 'arrival' | 'burn' | 'repair' | 'disable' | 'cloak' | 'drain'
export type CinemaShotKind = 'reveal' | 'tracking' | 'broadside' | 'pursuit' | 'impact' | 'aftermath'

export interface CinemaHealth {
  time: number
  /** Fractions of maximum capacity, clamped to 0–1. */
  hull: number
  shield: number
}

/** Source range progress: outer=0, mid=1/3, inner=2/3, engaged=1. */
export interface CinemaMotion {
  time: number
  position: number
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
  /** Compact source movement with constant holds preserved between transitions. */
  motion?: CinemaMotion[]
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
  weaponFamily?: CinemaWeaponFamily
  ammoName?: string
  critical?: boolean
  /** Observed recipient-local restoration; a remote source is not public. */
  repairKind?: 'hull' | 'shield'
  /** The resource actually removed from the target. */
  drainKind?: 'hull' | 'shield'
  /** True only when the record confirms a beneficiary received the resource. */
  drainTransferred?: boolean
}

export type CinemaShotRole = 'geography' | 'protagonist' | 'opposition' | 'setup' | 'fire' | 'impact' | 'reaction' | 'montage' | 'resolution'

/** Canonical pair orientation; reciprocal firing never reverses screen geography. */
export interface CinemaAxis {
  from: string
  to: string
  side: 1 | -1
}

export interface CinemaSequence {
  id: string
  start: number
  end: number
  kind: 'confrontation' | 'reversal' | 'climax' | 'montage'
  attacker?: string
  defender?: string
  causeCueId?: string
  eventCueId?: string
  actionTime: number
  impactTime: number
  consequenceTime?: number
  axis?: CinemaAxis
}

export interface CinemaStory {
  protagonistId?: string
  adversaryId?: string
  climaxCueId?: string
  sequences: CinemaSequence[]
}

export interface CinemaShot {
  start: number
  end: number
  kind: CinemaShotKind
  role?: CinemaShotRole
  sequenceId?: string
  axis?: CinemaAxis
  /** Recorded action this shot anticipates or follows. */
  actionTime?: number
  /** Consequential subjects in this shot; frame only upcoming/recent events within this group. */
  focusIds?: string[]
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
  story?: CinemaStory
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
