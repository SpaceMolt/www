import type { Commands, FactionCreateRolePermissions } from '@spacemolt/lib'

type PostMissionParams = Parameters<Commands['spacemolt_faction_admin']['post_mission']>[0]

/** Server page cap for faction members and the faction list. */
export const FACTION_PAGE_SIZE = 50

/** Prev/next state for an offset-paged list. */
export function pageState({ offset = 0, limit = FACTION_PAGE_SIZE, total = 0 }: { offset?: number; limit?: number; total?: number }) {
  const size = limit > 0 ? limit : FACTION_PAGE_SIZE
  return {
    page: Math.floor(offset / size) + 1,
    pages: Math.max(1, Math.ceil(total / size)),
    prevOffset: offset > 0 ? Math.max(0, offset - size) : null,
    nextOffset: offset + size < total ? offset + size : null,
  }
}

export const PERMISSION_LABELS: Record<keyof FactionCreateRolePermissions, string> = {
  invite: 'Invite',
  kick: 'Kick',
  promote: 'Promote',
  manage_roles: 'Manage roles',
  manage_diplomacy: 'Diplomacy',
  manage_treasury: 'Treasury',
  manage_bases: 'Bases',
  manage_facilities: 'Facilities',
  officer_room_access: 'Officer rooms',
}

export const NO_PERMISSIONS: FactionCreateRolePermissions = {
  invite: false,
  kick: false,
  promote: false,
  manage_roles: false,
  manage_diplomacy: false,
  manage_treasury: false,
  manage_bases: false,
  manage_facilities: false,
  officer_room_access: false,
}

/** License cost (credits) by hull tier, from the buy_ship_license notes. */
export const LICENSE_COST_BY_TIER: Record<number, number> = {
  1: 1_000_000,
  2: 5_000_000,
  3: 10_000_000,
  4: 20_000_000,
  5: 50_000_000,
}

export const MISSION_TYPES = ['delivery', 'mining', 'combat', 'exploration', 'crafting', 'trading', 'equipment', 'bounty'] as const
export const OBJECTIVE_TYPES = ['deliver_item', 'kill_pirate', 'kill_player', 'visit_system', 'dock_at_base'] as const

export interface ObjectiveDraft {
  type: (typeof OBJECTIVE_TYPES)[number]
  description: string
  item_id: string
  quantity: string
  /** target_base_id, system_id, target_id or pirate_tier, depending on type. */
  target: string
}

export const TARGET_FIELD: Record<ObjectiveDraft['type'], 'target_base_id' | 'target_id' | 'system_id' | 'pirate_tier'> = {
  deliver_item: 'target_base_id',
  dock_at_base: 'target_base_id',
  kill_player: 'target_id',
  visit_system: 'system_id',
  kill_pirate: 'pirate_tier',
}

export interface MissionDraft {
  title: string
  description: string
  type: (typeof MISSION_TYPES)[number]
  objectives: ObjectiveDraft[]
  credits: string
  expirationHours: string
  openToAll: boolean
}

const positive = (text: string) => {
  const n = Math.floor(Number(text))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Turns the post-mission form into command params; blank fields are left out for the server defaults. */
export function buildMissionParams(draft: MissionDraft): PostMissionParams {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    type: draft.type,
    objectives: draft.objectives.map((o) => ({
      type: o.type,
      description: o.description.trim(),
      ...(o.item_id.trim() && { item_id: o.item_id.trim() }),
      ...(positive(o.quantity) && { quantity: positive(o.quantity) }),
      ...(o.target.trim() && { [TARGET_FIELD[o.type]]: o.target.trim() }),
    })),
    rewards: positive(draft.credits) ? { credits: positive(draft.credits) } : {},
    ...(positive(draft.expirationHours) && { expiration_hours: positive(draft.expirationHours) }),
    ...(draft.openToAll && { triggers: ['open_to_all'] }),
  }
}
