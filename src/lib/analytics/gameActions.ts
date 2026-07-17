/**
 * Instruments the Account command facade so every player-initiated mutation
 * emits one `game_action`, from a single place.
 *
 * The facade is two levels deep across ~12 namespaces:
 *
 *   commands.spacemolt.jump({ id })
 *   commands.spacemolt_market.create_sell_order({ ... })
 *
 * so the Proxy is two levels deep too: a `get` on the facade returns a
 * per-namespace Proxy, whose `get` on a method returns a wrapped function.
 *
 * Why here and not in useCommandMutation: that hook is the *intended* write
 * choke point, but ~7 call sites bypass it and reach account.commands directly
 * (useAutoTravel, CombatPanel, FactionPanel, InfoPanel, TradesList, ChatPanel,
 * SettingsPanel). Auto-travel is the flow we most want to see. Proxying the
 * facade catches every call site without touching 23 files, and nothing added
 * later can bypass it.
 */

export interface GameActionEvent {
  /** Method name, e.g. 'undock'. */
  command: string
  /** Facade namespace, e.g. 'spacemolt_market'. Method names collide across
   *  namespaces (spacemolt.sell vs spacemolt_salvage.sell), so both are needed. */
  namespace: string
  outcome: 'ok' | 'error'
  duration_ms: number
}

export type GameActionEmitter = (event: GameActionEvent) => void

/**
 * `namespace.method` pairs that represent a deliberate player action.
 *
 * This allowlist is a privacy control, not just a volume filter. Command
 * arguments carry chat text, note bodies, and captain's log entries; we capture
 * only the name, and a newly added command stays invisible to analytics until
 * someone puts it here on purpose. Reads and polling are omitted deliberately —
 * they'd dominate the event count and tell us nothing.
 */
export const TRACKED_COMMANDS: ReadonlySet<string> = new Set([
  // Movement
  'spacemolt.undock',
  'spacemolt.dock',
  'spacemolt.travel',
  'spacemolt.jump',
  'spacemolt.survey_system',
  'spacemolt.scan',
  'spacemolt.cloak',
  'spacemolt.refuel',
  // Industry
  'spacemolt.mine',
  'spacemolt.craft',
  'spacemolt.recycle',
  'spacemolt.repair',
  'spacemolt.repair_module',
  'spacemolt.install_mod',
  'spacemolt.uninstall_mod',
  'spacemolt.use_item',
  'spacemolt.jettison',
  'spacemolt.self_destruct',
  // NPC market
  'spacemolt.buy',
  'spacemolt.sell',
  // Missions
  'spacemolt.accept_mission',
  'spacemolt.complete_mission',
  'spacemolt.abandon_mission',
  // Combat
  'spacemolt.attack',
  'spacemolt_battle.advance',
  'spacemolt_battle.retreat',
  'spacemolt_battle.stance',
  'spacemolt_battle.reload',
  // Player market
  'spacemolt_market.create_buy_order',
  'spacemolt_market.create_sell_order',
  'spacemolt_market.modify_order',
  'spacemolt_market.cancel_order',
  // Direct trade
  'spacemolt_transfer.trade_accept',
  'spacemolt_transfer.trade_decline',
  // Storage
  'spacemolt_storage.deposit',
  'spacemolt_storage.withdraw',
  // Ships
  'spacemolt_ship.switch_ship',
  'spacemolt_ship.refit_ship',
  'spacemolt_ship.rename_ship',
  'spacemolt_ship.scrap_ship',
  'spacemolt_ship.buy_listed_ship',
  'spacemolt_ship.list_ship_for_sale',
  'spacemolt_ship.cancel_ship_listing',
  'spacemolt_ship.commission_ship',
  'spacemolt_ship.supply_commission',
  'spacemolt_ship.cancel_commission',
  // Salvage
  'spacemolt_salvage.loot',
  'spacemolt_salvage.scrap',
  'spacemolt_salvage.tow',
  'spacemolt_salvage.sell',
  'spacemolt_salvage.release',
  // Facilities
  'spacemolt_facility.build',
  'spacemolt_facility.upgrade',
  'spacemolt_facility.transfer',
  'spacemolt_facility.set_access',
  'spacemolt_facility.set_output_price',
  'spacemolt_facility.job_cancel',
  'spacemolt_facility.job_reorder',
  'spacemolt_facility.personal_build',
  'spacemolt_facility.personal_decorate',
  'spacemolt_facility.faction_build',
  'spacemolt_facility.faction_upgrade',
  // Factions
  'spacemolt_faction.create',
  'spacemolt_faction.join',
  'spacemolt_faction.leave',
  'spacemolt_faction.invite',
  'spacemolt_faction.accept_invite',
  'spacemolt_faction.decline_invite',
  'spacemolt_faction.kick',
  'spacemolt_faction.declare_war',
  'spacemolt_faction.propose_peace',
  'spacemolt_faction.accept_peace',
  'spacemolt_faction.propose_ally',
  'spacemolt_faction.set_enemy',
  // Social
  'spacemolt_social.create_note',
  'spacemolt_intel.submit_intel',
])

function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Wraps one namespace object. Method wrappers are memoised so repeated property
 * access returns a stable reference — call sites hold onto these (useCallback
 * deps, effect deps), and a fresh function per `get` would silently defeat them.
 */
function wrapNamespace(
  namespace: string,
  target: Record<PropertyKey, unknown>,
  emit: GameActionEmitter,
  now: () => number,
): Record<PropertyKey, unknown> {
  const wrapped = new Map<string, unknown>()

  return new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver)
      if (typeof key !== 'string' || typeof value !== 'function') return value
      if (!TRACKED_COMMANDS.has(`${namespace}.${key}`)) return value

      const cached = wrapped.get(key)
      if (cached) return cached

      const instrumented = (...args: unknown[]) => {
        const startedAt = now()
        const record = (outcome: 'ok' | 'error') => {
          emit({ command: key, namespace, outcome, duration_ms: now() - startedAt })
        }

        // Commands are async, but call through synchronously so a non-promise
        // return (or a sync throw) can't be swallowed by an await.
        let result: unknown
        try {
          result = (value as (...a: unknown[]) => unknown).apply(obj, args)
        } catch (err) {
          record('error')
          throw err
        }
        if (!(result instanceof Promise)) {
          record('ok')
          return result
        }
        return result.then(
          (resolved) => {
            record('ok')
            return resolved
          },
          (err: unknown) => {
            record('error')
            throw err
          },
        )
      }

      wrapped.set(key, instrumented)
      return instrumented
    },
  })
}

/**
 * Returns a transparent proxy of the command facade. Untracked commands, reads,
 * and non-function properties pass through untouched; only TRACKED_COMMANDS emit.
 *
 * `emit` is injected rather than importing capture() directly so the whole thing
 * is testable without a PostHog instance.
 */
export function instrumentCommands<T extends object>(
  commands: T,
  emit: GameActionEmitter,
  now: () => number = Date.now,
): T {
  const namespaces = new Map<string, unknown>()

  return new Proxy(commands, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if (typeof key !== 'string' || !isPlainObject(value)) return value

      const cached = namespaces.get(key)
      if (cached) return cached

      const wrapped = wrapNamespace(key, value, emit, now)
      namespaces.set(key, wrapped)
      return wrapped
    },
  })
}
