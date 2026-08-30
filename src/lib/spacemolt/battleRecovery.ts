import type { GetBattleStatusResponse } from '@spacemolt/lib'
import type { AccountStore } from './accountStore'
import type { BattleView, UiStore } from './uiStore'

/** Status is a snapshot, unlike battle_update, and may describe a nearby spectator fight. */
export function battleViewFromStatus(status: GetBattleStatusResponse, playerId: string, tick: number): BattleView | null {
  if (!status.is_participant) return null
  const self = status.participants?.find((participant) => participant.player_id === playerId)
  if (!self) return null
  return {
    battle_id: status.battle_id,
    tick,
    auto_pilot: self.auto_pilot,
    your_side_id: self.side_id,
    your_zone: self.zone ?? '',
    your_stance: self.stance ?? '',
    your_target_id: self.target_id,
    participants: (status.participants ?? []).map((participant) => ({
      ...participant, zone: participant.zone ?? '',
    })),
    sides: status.sides ?? [],
  }
}

/** Recover on ready, with bounded retries on the existing game connection. */
export function wireBattleRecovery(accountStore: AccountStore, uiStore: UiStore, retryDelayMs = 5_000): () => void {
  let disposed = false
  let generation = 0
  let previousPhase: ReturnType<AccountStore['getPhase']> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  const clearRetry = () => {
    clearTimeout(retryTimer)
    retryTimer = undefined
  }
  let observedRevision = uiStore.getState().battleRevision
  const unsubscribeUi = uiStore.subscribe(() => {
    const revision = uiStore.getState().battleRevision
    if (revision !== observedRevision) clearRetry()
    observedRevision = revision
  })

  const onPhase = () => {
    const phase = accountStore.getPhase()
    if (phase === previousPhase) return
    previousPhase = phase
    clearRetry()
    const requestGeneration = ++generation
    uiStore.dispatch({ type: 'battle_sync_pending' })
    if (phase !== 'ready') return
    const revision = uiStore.getState().battleRevision
    const isCurrent = () => !disposed && generation === requestGeneration &&
      accountStore.getPhase() === 'ready' && uiStore.getState().battleRevision === revision

    let attempts = 0
    const recover = async () => {
      if (!isCurrent()) return
      attempts++
      try {
        const result = await accountStore.account.commands.spacemolt_battle.status()
        if (!isCurrent()) return
        const status = result.structuredContent
        if (!status) throw new Error('Battle status unavailable')
        if (!status.is_participant) {
          uiStore.dispatch({ type: 'battle_left' })
          return
        }
        const playerId = accountStore.account.state.player?.id ?? accountStore.account.loginPayload?.player?.id ?? ''
        const battle = battleViewFromStatus(status, playerId, accountStore.getCurrentTick())
        if (battle) uiStore.dispatch({ type: 'battle_update', battle })
        else uiStore.dispatch({ type: 'battle_started', battleId: status.battle_id })
      } catch (error: unknown) {
        if (!isCurrent()) return
        if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'not_in_battle') {
          uiStore.dispatch({ type: 'battle_left' })
        } else if (attempts < 3) {
          // Keep the replay, but not command authority, until a current answer arrives.
          retryTimer = setTimeout(() => { retryTimer = undefined; void recover() }, retryDelayMs)
        }
      }
    }
    void recover()
  }

  const unsubscribe = accountStore.subscribe('phase', onPhase)
  onPhase()
  return () => {
    disposed = true
    generation++
    clearRetry()
    unsubscribeUi()
    unsubscribe()
  }
}
