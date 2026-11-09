'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { SpacemoltError, type MineResponse } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, type AccountStore, type RunMutation } from '@/lib/spacemolt'
import { formatItemId } from '@/data/catalog'
import { errorMessage } from '../shared'
import { findRoute, walkRoute } from '../routeWalk'
import { ABORT_CODES, advance, errorOutcome, stepLabel, type LoopPlan, type LoopPosition, type LoopStep } from './loopPlan'

type Account = AccountStore['account']

export interface LoopRunState extends LoopPosition {
  plan: LoopPlan
  status: 'running' | 'done' | 'halted'
  stopRequested: boolean
  haltReason: string | null
  /** Wallet at start; earnings = current credits - this. */
  startCredits: number
  mined: Record<string, number>
  log: string[]
}

export interface LoopRunner {
  state: LoopRunState | null
  isActive: boolean
  start: (plan: LoopPlan) => void
  stop: () => void
  dismiss: () => void
}

const LOG_LIMIT = 6
const BAY_CHUNK = 100 // storage deposit takes at most 100 entries per call

/** Pushes that end a loop: the ship's situation changed under it. */
const HALT_PUSHES: Record<string, string> = {
  battle_started: 'Battle started',
  player_died: 'Ship destroyed',
  server_restart_warning: 'Server restart announced',
  reconnected: 'Connection dropped and was restored',
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const codeOf = (err: unknown) => (err instanceof SpacemoltError ? err.code : '')

function isCargoFull(account: Account): boolean {
  const ship = account.ship
  return Boolean(ship && ship.cargo_capacity > 0 && ship.cargo_used >= ship.cargo_capacity)
}

interface StepContext {
  account: Account
  run: RunMutation
  haltReason: () => string | null
  log: (line: string) => void
  onMined: (itemId: string, quantity: number) => void
}

async function mineUntilFull({ account, run, haltReason, log, onMined }: StepContext) {
  while (!haltReason() && !isCargoFull(account)) {
    const result = await run((c) => c.spacemolt.mine(), { label: 'mine' })
    const details = result.delta.details as MineResponse | undefined
    if (details && 'resource_id' in details) {
      onMined(details.resource_name || formatItemId(details.resource_id), details.quantity)
    } else if (details?.message) {
      log(details.message)
    }
  }
}

async function goTo({ account, run, haltReason, log }: StepContext, poiId: string) {
  if (account.location?.poi_id === poiId) return
  const route = await findRoute(account, poiId)
  if (!route) throw new Error('No known route to that location')
  const stop = await walkRoute(account, run, route.route, {
    fuelPerJump: route.fuelPerJump,
    shipSpeed: account.ship?.speed ?? 1,
    stopReason: haltReason,
    onRefuel: (where) => log(`Refueled at ${where}`),
  })
  if (stop) throw new Error(stop)
  if (!haltReason() && account.location?.poi_id !== poiId) {
    await run((c) => c.spacemolt.travel({ id: route.targetPoi ?? poiId }), { label: 'travel' })
  }
}

/** Sell each matching cargo stack. One stack failing (no buyers) moves on to the next. */
async function sellCargo({ account, run, haltReason, log }: StepContext, itemIds?: string[]) {
  const stacks = (account.cargo ?? []).filter((c) => !itemIds || itemIds.includes(c.item_id))
  for (const { item_id, item_name, quantity } of stacks) {
    if (haltReason()) return
    try {
      await run((c) => c.spacemolt.sell({ id: item_id, quantity }), { label: 'sell' })
    } catch (err) {
      if (ABORT_CODES.has(codeOf(err))) throw err
      log(`${item_name}: ${errorMessage(err)}`)
    }
  }
}

async function depositCargo({ account, run }: StepContext, target: 'storage' | 'faction') {
  const items = (account.cargo ?? []).map(({ item_id, quantity }) => ({ item_id, quantity }))
  for (let i = 0; i < items.length; i += BAY_CHUNK) {
    const chunk = items.slice(i, i + BAY_CHUNK)
    await run((c) => c.spacemolt_storage.deposit({ items: chunk, ...(target === 'faction' && { target: 'faction' }) }), { label: 'deposit' })
  }
}

async function runStep(step: LoopStep, ctx: StepContext): Promise<void> {
  const { account, run, haltReason } = ctx
  const ship = account.ship
  switch (step.kind) {
    case 'mine': return mineUntilFull(ctx)
    case 'goto': return goTo(ctx, step.poiId)
    case 'sell_all': return sellCargo(ctx)
    case 'sell': return sellCargo(ctx, step.itemIds)
    case 'deposit': return depositCargo(ctx, step.target)
    case 'refuel':
      if (ship && ship.fuel >= ship.max_fuel) return
      await run((c) => c.spacemolt.refuel(), { label: 'refuel' })
      return
    case 'repair':
      if (ship && ship.hull >= ship.max_hull) return
      await run((c) => c.spacemolt.repair(), { label: 'repair' })
      return
    case 'craft':
      await run((c) => c.spacemolt.craft({ id: step.recipeId, count: step.count }), { label: 'craft' })
      return
    case 'wait':
      for (let s = 0; s < step.seconds && !haltReason(); s++) await sleep(1000)
      return
  }
}

export function useLoopRunner(): LoopRunner {
  const store = useAccountStore()
  const run = useCommandMutation()
  const [state, setState] = useState<LoopRunState | null>(null)
  const activeRef = useRef(false)
  const haltRef = useRef<string | null>(null)

  useEffect(() => {
    const offs = Object.entries(HALT_PUSHES).map(([type, reason]) =>
      store.account.on(type, () => {
        if (activeRef.current && !haltRef.current) haltRef.current = reason
      }),
    )
    return () => offs.forEach((off) => off())
  }, [store])

  const start = useCallback((plan: LoopPlan) => {
    if (activeRef.current || plan.steps.length === 0) return
    activeRef.current = true
    haltRef.current = null
    const { account } = store
    const patch = (p: Partial<LoopRunState>) => setState((s) => s && { ...s, ...p })
    const log = (line: string) => setState((s) => s && { ...s, log: [...s.log, line].slice(-LOG_LIMIT) })
    const ctx: StepContext = {
      account,
      run,
      haltReason: () => haltRef.current,
      log,
      onMined: (name, quantity) => setState((s) => s && { ...s, mined: { ...s.mined, [name]: (s.mined[name] ?? 0) + quantity } }),
    }

    setState({
      plan, stepIndex: 0, loop: 1, status: 'running', stopRequested: false, haltReason: null,
      startCredits: account.player?.credits ?? 0, mined: {}, log: [],
    })

    ;(async () => {
      let pos: LoopPosition | null = { stepIndex: 0, loop: 1 }
      while (pos && !haltRef.current) {
        patch(pos)
        const step = plan.steps[pos.stepIndex]
        try {
          await runStep(step, ctx)
        } catch (err) {
          const outcome = errorOutcome(step, { code: codeOf(err), message: errorMessage(err), cargoUsed: account.ship?.cargo_used })
          if (outcome.halt) haltRef.current ??= `${stepLabel(step)}: ${outcome.reason}`
          else log(outcome.reason)
        }
        if (!haltRef.current) pos = advance(pos, plan)
      }
      activeRef.current = false
      const reason = haltRef.current
      patch({ status: reason ? 'halted' : 'done', haltReason: reason })
    })()
  }, [store, run])

  const stop = useCallback(() => {
    if (!activeRef.current) return
    haltRef.current ??= 'Stopped'
    setState((s) => s && { ...s, stopRequested: true })
  }, [])

  const dismiss = useCallback(() => {
    if (!activeRef.current) setState(null)
  }, [])

  return { state, isActive: state?.status === 'running', start, stop, dismiss }
}

export const LoopRunnerContext = createContext<LoopRunner | null>(null)

export function useLoop(): LoopRunner {
  const runner = useContext(LoopRunnerContext)
  if (!runner) throw new Error('useLoop must be used inside LoopRunnerContext')
  return runner
}
