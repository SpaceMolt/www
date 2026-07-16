/**
 * Wires an Account's push notifications into the uiStore: chat, trades,
 * battle state, craft jobs, and human-readable event-log entries. Returns a
 * composite unsubscribe. Formatting is intentionally terse here; panels that
 * need richer presentation read the typed payloads themselves.
 */
import type { Account, LoggedInPayload } from '@spacemolt/lib'
import type { UiStore } from './uiStore'

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

export function wireNotifications(account: Account, store: UiStore): () => void {
  const log = (kind: 'info' | 'success' | 'warning' | 'danger' | 'chat' | 'combat', text: string) =>
    store.dispatch({ type: 'event', kind, text })

  const unsubscribers = [
    account.on('chat_message', (msg) => {
      store.dispatch({ type: 'chat', message: msg })
    }),

    account.on('trade_offer_received', (trade) => {
      store.dispatch({ type: 'trade_received', trade })
      log('info', `Trade offer received from ${str(trade.offerer_name) || 'another player'}`)
    }),
    account.on('trade_complete', (trade) => {
      store.dispatch({ type: 'trade_closed', tradeId: str(trade.trade_id) })
      log('success', 'Trade completed')
    }),
    account.on('trade_declined', (trade) => {
      store.dispatch({ type: 'trade_closed', tradeId: str(trade.trade_id) })
      log('info', 'Trade declined')
    }),
    account.on('trade_cancelled', (trade) => {
      store.dispatch({ type: 'trade_closed', tradeId: str(trade.trade_id) })
      log('info', 'Trade cancelled')
    }),

    account.on('battle_started', () => log('combat', 'Battle started')),
    account.on('battle_update', (battle) => store.dispatch({ type: 'battle_update', battle })),
    account.on('battle_ended', () => {
      store.dispatch({ type: 'battle_ended' })
      log('combat', 'Battle ended')
    }),
    account.on('battle_alert', () => log('warning', 'Battle alert: you are under attack')),

    account.on('player_died', (death) => {
      store.dispatch({ type: 'battle_ended' })
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
      if (Array.isArray(update.jobs)) store.dispatch({ type: 'set_craft_jobs', jobs: update.jobs })
    }),

    account.on('drone_update', () => log('info', 'Drone status updated')),
    account.on('drone_destroyed', () => log('warning', 'A drone was destroyed')),
    account.on('base_raid_update', () => log('warning', 'Base raid in progress')),
    account.on('base_destroyed', () => log('danger', 'A base was destroyed')),
    account.on('station_repaired', () => log('info', 'Station repaired')),
    account.on('pirate_radio', (radio) => log('chat', `Pirate radio: ${str(radio.message)}`)),
    account.on('pirate_destroyed', () => log('combat', 'Pirate destroyed')),
    account.on('reconnected', () => log('info', 'Reconnected to the server')),

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
  ]

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}
