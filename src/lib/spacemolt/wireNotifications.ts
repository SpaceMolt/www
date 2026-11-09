/**
 * Wires an Account's push notifications into the uiStore: chat, trades,
 * battle state, craft jobs, and human-readable event-log entries. Returns a
 * composite unsubscribe. Formatting is intentionally terse here; panels that
 * need richer presentation read the typed payloads themselves.
 */
import type { Account, GetTradesResponse, LoggedInPayload } from '@spacemolt/lib'
import type { EventKind, TradeOffer, UiStore } from './uiStore'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

export function seedFromLogin(store: UiStore, login: LoggedInPayload | null): void {
  if (!login) return
  if (Array.isArray(login.recent_chat)) {
    store.dispatch({ type: 'seed_chat', messages: login.recent_chat })
  }
  if (Array.isArray(login.pending_trades)) {
    store.dispatch({
      type: 'seed_trades',
      trades: login.pending_trades.map((trade) => ({ trade_id: trade.id, ...trade })),
    })
  }
}

/**
 * Replace pending incoming trades with a get_trades snapshot. Trades we already hold keep their
 * richer push/login payload (station-sale fields); trades the server no longer lists drop out.
 */
export function mergeTradeSnapshot(current: TradeOffer[], incoming: GetTradesResponse['incoming']): TradeOffer[] {
  return incoming.map((entry) => current.find((t) => t.trade_id === entry.trade_id) ?? { offerer_id: '', ...entry })
}

/** Resync pending trades after a reconnect (pushes sent while offline are lost). */
async function resyncTrades(account: Account, store: UiStore): Promise<void> {
  const snapshot = (await account.commands.spacemolt_transfer.get_trades()).structuredContent
  if (snapshot) store.dispatch({ type: 'seed_trades', trades: mergeTradeSnapshot(store.getState().pendingTrades, snapshot.incoming) })
}

export function wireNotifications(account: Account, store: UiStore): () => void {
  const log = (kind: EventKind, text: string) => store.dispatch({ type: 'event', kind, text })

  const toast = (kind: EventKind, text: string) => store.dispatch({ type: 'toast', kind, text })

  const unsubscribers = [
    account.on('chat_message', (msg) => {
      store.dispatch({ type: 'chat', message: msg })
    }),

    account.on('trade_offer_received', (trade) => {
      store.dispatch({ type: 'trade_received', trade })
      toast('chat', `Trade offer received from ${str(trade.offerer_name) || 'another player'}`)
    }),
    account.on('trade_complete', (trade) => {
      store.dispatch({ type: 'trade_closed', tradeId: str(trade.trade_id) })
      log('success', 'Trade completed')
      // The push carries no state delta: re-read credits and cargo the trade moved.
      account.refresh().catch(() => {})
    }),
    account.on('trade_declined', (trade) => {
      store.dispatch({ type: 'trade_closed', tradeId: str(trade.trade_id) })
      log('info', 'Trade declined')
    }),
    account.on('trade_cancelled', (trade) => {
      store.dispatch({ type: 'trade_closed', tradeId: str(trade.trade_id) })
      log('info', 'Trade cancelled')
    }),

    account.on('battle_started', (battle) => {
      store.dispatch({ type: 'battle_started', battleId: battle.battle_id })
      log('combat', 'Battle started')
    }),
    account.on('battle_update', (battle) => store.dispatch({ type: 'battle_update', battle })),
    account.on('battle_ended', (battle) => {
      store.dispatch({ type: 'battle_ended', battleId: battle.battle_id })
      log('combat', 'Battle ended')
    }),
    account.on('battle_alert', (battle) => {
      // Also sent to spectators: an alert does not establish participation.
      log('warning', battle.message)
    }),
    account.on('battle_left', (left) => {
      const playerId = account.state.player?.id ?? account.loginPayload?.player?.id
      if (left.player_id !== playerId) return
      store.dispatch({ type: 'battle_left' })
      if (left.reason === 'knocked_out') log('combat', 'Knocked out in the arena — ship and crew restored')
    }),

    account.on('player_died', (death) => {
      store.dispatch({ type: 'battle_left' })
      log('danger', `You were destroyed${str(death.killer_name) ? ` by ${str(death.killer_name)}` : ''}`)
    }),
    account.on('player_kill', (kill) => log('combat', `${str(kill.victim) || 'A player'} was destroyed`)),
    account.on('mining_yield', (yield_) =>
      log('success', `Mined ${yield_.quantity ?? ''} ${str(yield_.resource_name) || 'resources'}`.trim()),
    ),
    account.on('scan_detected', (scan) =>
      log('warning', `${str(scan.scanner_username) || 'Someone'} is scanning your ship`),
    ),
    account.on('pilotless_ship', () => log('warning', 'Your ship is adrift without a pilot')),
    account.on('skill_level_up', (skill) =>
      log('success', `Skill ${str(skill.skill_id)} reached level ${skill.new_level}`),
    ),
    account.on('achievement_unlocked', (payload) => {
      for (const achievement of payload.achievements) {
        log('success', `Achievement unlocked: ${str(achievement.name) || str(achievement.id)}`)
      }
    }),

    account.on('crafting_update', (update) => {
      if (!Array.isArray(update.jobs)) return
      store.dispatch({ type: 'set_craft_jobs', jobs: update.jobs })
      // Each tick a queued job deposits output; surface it so async crafting
      // is visible without polling. The push is a sparse per-tick delta.
      for (const job of update.jobs) {
        const mode = job.mode === 'recycle' ? 'Recycled' : 'Crafted'
        const deposited = (job.deposited ?? [])
          .map((item) => `${item.quantity ?? '?'}x ${item.item_name || item.item_id || 'item'}`)
          .join(', ')
        const remaining = job.runs_remaining ?? 0
        let text = `${mode} ${job.recipe ?? 'job'}`
        if (deposited) text += ` → ${deposited}`
        if (job.completed) text += ' (job complete)'
        else if (remaining > 0) text += ` (${remaining} run${remaining === 1 ? '' : 's'} left)`
        log('success', text)
      }
    }),

    account.on('gift_received', (gift) => {
      store.dispatch({ type: 'storage_changed' })
      log('success', `Gift received from ${gift.sender}`)
    }),
    // battle_damage is per-tick; the Combat panel shows it as a live feed instead.
    account.on('battle_joined', (joined) => log('combat', `${joined.username} joined side ${joined.side_id}`)),
    account.on('ship_captured', (capture) =>
      log('danger', `${capture.captor_username} captured ${capture.former_owner_username}'s ship${capture.prize_poi_name ? ` at ${capture.prize_poi_name}` : ''}`),
    ),
    account.on('prize_update', (prize) => log('info', prize.message)),
    account.on('personnel_update', (update) =>
      log('info', `${update.source_username} ${update.action === 'treatment' ? 'treated' : 'transferred'} personnel on your ship`),
    ),
    account.on('arena_challenge', (challenge) =>
      log('info', `Arena challenge ${challenge.event}: ${challenge.challenger_name} vs ${challenge.challenged_name}`),
    ),
    account.on('arena_objective', (objective) => log('combat', objective.message)),
    account.on('fleet', (push) => {
      const who = 'player_name' in push ? push.player_name : ''
      const fallback = `Fleet: ${push.action.replace('fleet_', '').replaceAll('_', ' ')}${who ? ` (${who})` : ''}`
      log('info', ('message' in push && push.message) || fallback)
    }),

    account.on('drone_update', () => log('info', 'Drone status updated')),
    account.on('drone_destroyed', () => log('warning', 'A drone was destroyed')),
    // Sent every tick of a raid, so it stays 'info' (warning/danger entries toast).
    account.on('base_raid_update', (raid) =>
      log('info', `${raid.base_name} under attack by ${raid.attacker_name}: ${raid.damage} damage, ${raid.current_health}/${raid.max_health} left`),
    ),
    account.on('base_destroyed', (base) => log('danger', `${base.base_name} was destroyed by ${base.attacker_name}`)),
    account.on('station_repaired', (base) => log('success', `${base.base_name} is fully repaired`)),
    account.on('facility_rent_warning', (warning) => log('warning', warning.message)),
    account.on('facility_reclaimed', (reclaimed) => log('danger', reclaimed.message)),
    account.on('pirate_radio', (radio) => log('chat', `Pirate radio: ${str(radio.message)}`)),
    account.on('pirate_destroyed', () => log('combat', 'Pirate destroyed')),
    account.on('reconnected', () => {
      log('info', 'Reconnected to the server')
      resyncTrades(account, store).catch(() => {})
    }),
    account.on('exchange_fill', (fill) => {
      const verb = fill.type === 'buy_filled' ? 'Bought' : 'Sold'
      store.dispatch({
        type: 'toast', kind: 'chat',
        text: `Order filled: ${verb} ${fill.quantity.toLocaleString()} ${fill.item_name} for ${fill.total.toLocaleString()} cr`,
      })
    }),

    // Untyped pushes (no published schema yet — see spacemolt-lib docs/gameserver-todo.md).
    account.on('server_restart_warning', (payload: Record<string, unknown>) =>
      log('warning', str(payload.message) || 'Server restarting soon — brief disconnect expected'),
    ),
    account.on('faction_invite', (payload: Record<string, unknown>) =>
      log('info', str(payload.message) || 'You were invited to a faction'),
    ),
    account.on('faction_war_declared', (payload: Record<string, unknown>) =>
      log('danger', str(payload.message) || 'War declared'),
    ),
    account.on('faction_mobile_base_update', (payload: Record<string, unknown>) =>
      log(
        payload.event === 'jump_cancelled_combat' ? 'warning' : 'info',
        str(payload.message) || 'Faction mobile base updated',
      ),
    ),

    account.on('ship_commission_complete', (ship) =>
      toast('success', `Commission complete: ${ship.ship_name || ship.ship_class} is docked at ${ship.base_name || 'the shipyard'}`),
    ),
    account.on('refueled_by', (fuel) =>
      toast('info', `${fuel.source_username || 'A player'} refueled you: +${fuel.fuel} fuel (${fuel.fuel_now}/${fuel.fuel_max})`),
    ),
    account.on('repaired_by', (repair) =>
      toast('info', `${repair.source_username || 'A player'} repaired you: +${repair.repaired} hull (${repair.hull}/${repair.max_hull})`),
    ),
    account.on('ranch_poached', (ranch) =>
      log('warning', ranch.message || `${ranch.killer_name || 'Someone'} poached your ranch ${ranch.ranch_name}`),
    ),
    account.on('faction_alliance_proposal', (proposal) =>
      // The server message tells agents which command ratifies it (faction.go); players use the Faction tab.
      toast('warning', `${proposal.from_faction_name} proposes an alliance. Accept it in the Faction tab.`),
    ),
    account.on('faction_alliance_formed', (alliance) =>
      toast('success', alliance.message || `Alliance formed with ${alliance.with_faction_name}`),
    ),
    account.on('faction_alliance_broken', (alliance) =>
      log('warning', alliance.message || `${alliance.by_faction_name} broke your alliance`),
    ),
    account.on('faction_peace_proposal', (proposal) =>
      toast('warning', proposal.message || `${proposal.from_faction_name} proposes peace`),
    ),
    account.on('faction_peace_accepted', (peace) =>
      toast('success', peace.message || `${peace.faction_name} accepted your peace proposal`),
    ),
    account.on('hold_update', (payload: Record<string, unknown>) =>
      log(
        payload.event === 'started' ? 'warning' : 'info',
        str(payload.message) || (payload.event === 'started' ? 'A warp scrambler is holding a ship' : 'Warp hold ended'),
      ),
    ),
  ]

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}
