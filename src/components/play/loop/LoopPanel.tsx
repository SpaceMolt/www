'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Play, Plus, Repeat, Save, Square, Trash2, X } from 'lucide-react'
import { fetchStations } from '@spacemolt/lib'
import { useAccountStore, useCargo, useLocationState, usePendingAction, usePlayer, useSystem } from '@/lib/spacemolt'
import { Credits, Panel, shared } from '../shared'
import { hasMineableResources } from '../LeftSidebar'
import { loadKnownPois, loadPlans, mergePois, mineSellPreset, savePlans, stepLabel, type KnownPoi, type LoopPlan, type LoopStep } from './loopPlan'
import { useLoop } from './useLoopRunner'
import styles from './Loop.module.css'

type StepKind = LoopStep['kind']

const KIND_LABELS: Record<StepKind, string> = {
  goto: 'Travel / jump to POI',
  mine: 'Mine until full',
  sell_all: 'Sell all cargo',
  sell: 'Sell selected items',
  deposit: 'Deposit cargo',
  refuel: 'Refuel',
  repair: 'Repair',
  craft: 'Craft',
  wait: 'Wait',
}

const EMPTY_PLAN: LoopPlan = { name: 'My loop', steps: [], repeat: 0 }

const GAMESERVER_URL = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/**
 * Goto destinations: POIs remembered from visited systems plus the public
 * station directory, and faction intel for the picked system. The server has
 * no other way to list POIs outside the current system.
 */
function useDestinations(systemId: string, here: KnownPoi[]): { pois: KnownPoi[]; systems: { id: string; name: string }[] } {
  const store = useAccountStore()
  const [base, setBase] = useState<KnownPoi[]>(() => loadKnownPois())
  const [intel, setIntel] = useState<KnownPoi[]>([])

  useEffect(() => {
    fetchStations(GAMESERVER_URL)
      .then(({ stations }) => setBase((known) => mergePois(
        stations.map((s) => ({ id: s.poi_id, name: s.name, systemId: s.system_id, systemName: s.system_name })),
        known, // remembered names win over directory names
      )))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setIntel([])
    if (!systemId) return
    let cancelled = false
    store.account.commands.spacemolt_intel.query_intel({ system_id: systemId, limit: 1 })
      .then((r) => {
        const entry = r.structuredContent?.entries?.[0]
        if (!cancelled && entry) setIntel((entry.pois ?? []).map((p) => ({ id: p.id, name: p.base_name || p.name, systemId, systemName: entry.name })))
      })
      .catch(() => {}) // not in a faction, or no intel yet
    return () => { cancelled = true }
  }, [systemId, store])

  const pois = mergePois(mergePois(base, intel), here)
  const systems = [...new Map(pois.map((p) => [p.systemId, { id: p.systemId, name: p.systemName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
  return { pois: pois.filter((p) => p.systemId === systemId), systems }
}

/** Live progress strip under every panel while a loop runs or after it ends. */
export function LoopBanner() {
  const { state, stop, dismiss } = useLoop()
  const player = usePlayer()
  if (!state) return null
  const earned = (player?.credits ?? state.startCredits) - state.startCredits
  const running = state.status === 'running'
  const mined = Object.entries(state.mined)
  return (
    <div className={`${styles.banner} ${running ? '' : state.haltReason ? styles.bannerHalted : styles.bannerDone}`}>
      <div className={styles.bannerTop}>
        <Repeat size={13} />
        <span className={styles.bannerName}>{state.plan.name}</span>
        <span className={styles.bannerMeta}>
          Loop {state.loop}{state.plan.repeat > 0 ? `/${state.plan.repeat}` : ''} · Step {state.stepIndex + 1}/{state.plan.steps.length}
        </span>
        <span className={styles.bannerMeta}>{earned >= 0 ? '+' : ''}<Credits amount={earned} /></span>
        {running ? (
          <button className={shared.dangerBtn} onClick={stop} disabled={state.stopRequested} type="button">
            <Square size={11} /> {state.stopRequested ? 'Stopping after this action' : 'Stop'}
          </button>
        ) : (
          <button className={shared.subtleBtn} onClick={dismiss} type="button" aria-label="Dismiss loop result">
            <X size={11} />
          </button>
        )}
      </div>
      <div className={styles.bannerDetail}>
        {running ? stepLabel(state.plan.steps[state.stepIndex]) : state.haltReason ?? 'Loop finished'}
        {mined.length > 0 && ` · Mined ${mined.map(([name, qty]) => `${qty} ${name}`).join(', ')}`}
      </div>
      {state.log.length > 0 && <div className={styles.bannerLog}>{state.log[state.log.length - 1]}</div>}
    </div>
  )
}

function StepEditor({ onAdd }: { onAdd: (step: LoopStep) => void }) {
  const [kind, setKind] = useState<StepKind>('goto')
  const location = useLocationState()
  const [systemId, setSystemId] = useState(location?.system_id ?? '')
  const [poiId, setPoiId] = useState('')
  const [itemIds, setItemIds] = useState<string[]>([])
  const [target, setTarget] = useState<'storage' | 'faction'>('storage')
  const [recipeId, setRecipeId] = useState('')
  const [count, setCount] = useState('1')
  const [seconds, setSeconds] = useState('30')
  const systemData = useSystem().data
  const here = systemData && 'system' in systemData
    ? systemData.system.pois.map((p) => ({ id: p.id, name: p.base_name || p.name, systemId: systemData.system.id, systemName: systemData.system.name }))
    : []
  const destinations = useDestinations(systemId, here)
  const cargo = useCargo() ?? []

  const build = (): LoopStep | null => {
    switch (kind) {
      case 'goto': {
        const poi = destinations.pois.find((p) => p.id === poiId)
        return poi ? { kind, poiId: poi.id, label: poi.systemId === location?.system_id ? poi.name : `${poi.name} (${poi.systemName})` } : null
      }
      case 'sell': return itemIds.length ? { kind, itemIds } : null
      case 'deposit': return { kind, target }
      case 'craft': return recipeId.trim() ? { kind, recipeId: recipeId.trim(), count: Math.max(1, parseInt(count, 10) || 1) } : null
      case 'wait': return { kind, seconds: Math.max(1, parseInt(seconds, 10) || 1) }
      default: return { kind }
    }
  }
  const step = build()

  return (
    <div className={styles.editor}>
      <select className={shared.selectInput} value={kind} onChange={(e) => setKind(e.target.value as StepKind)} aria-label="Step type">
        {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      {kind === 'goto' && (
        <>
          <select className={shared.selectInput} value={systemId} onChange={(e) => { setSystemId(e.target.value); setPoiId('') }} aria-label="Destination system">
            <option value="">Pick a system</option>
            {destinations.systems.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === location?.system_id ? ' (here)' : ''}</option>)}
          </select>
          <select className={shared.selectInput} value={poiId} onChange={(e) => setPoiId(e.target.value)} aria-label="Destination">
            <option value="">Pick a POI</option>
            {destinations.pois.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </>
      )}
      {kind === 'sell' && (
        <div className={styles.itemChecks}>
          {cargo.length === 0 && <span className={styles.hint}>Cargo is empty. Load the items to sell first.</span>}
          {cargo.map((c) => (
            <label key={c.item_id} className={styles.check}>
              <input
                type="checkbox"
                checked={itemIds.includes(c.item_id)}
                onChange={(e) => setItemIds((ids) => (e.target.checked ? [...ids, c.item_id] : ids.filter((id) => id !== c.item_id)))}
              />
              {c.item_name}
            </label>
          ))}
        </div>
      )}
      {kind === 'deposit' && (
        <select className={shared.selectInput} value={target} onChange={(e) => setTarget(e.target.value as 'storage' | 'faction')} aria-label="Deposit to">
          <option value="storage">Personal storage</option>
          <option value="faction">Faction storage</option>
        </select>
      )}
      {kind === 'craft' && (
        <>
          <input className={shared.textInput} placeholder="Recipe ID" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} />
          <input className={shared.textInput} type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} aria-label="Count" />
        </>
      )}
      {kind === 'wait' && (
        <input className={shared.textInput} type="number" min={1} value={seconds} onChange={(e) => setSeconds(e.target.value)} aria-label="Seconds" />
      )}
      <button className={shared.accentBtn} disabled={!step} onClick={() => step && onAdd(step)} type="button">
        <Plus size={12} /> Add step
      </button>
    </div>
  )
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function LoopPanel() {
  const { start, isActive } = useLoop()
  const pending = usePendingAction()
  const location = useLocationState()
  const systemData = useSystem().data
  const [plans, setPlans] = useState<LoopPlan[]>(() => loadPlans())
  const [draft, setDraft] = useState<LoopPlan>(EMPTY_PLAN)

  const pois = systemData && 'system' in systemData ? systemData.system.pois : []
  const station = pois.find((p) => p.has_base)
  const minePoi = hasMineableResources(location) && location ? { id: location.poi_id, name: location.poi_name } : null
  const canRun = !isActive && pending === null // HUD also blocks start() during auto-travel

  const persist = (next: LoopPlan[]) => { setPlans(next); savePlans(next) }
  const saveDraft = () => persist([...plans.filter((p) => p.name !== draft.name), draft])
  const setSteps = (steps: LoopStep[]) => setDraft((d) => ({ ...d, steps }))

  return (
    <Panel title="Autopilot" icon={<Repeat size={14} />}>
      <p className={styles.hint}>
        Loops run in this browser tab and stop when you close it. Docking and undocking happen automatically.
      </p>

      {minePoi && station && (
        <>
          <div className={shared.sectionTitle}>Presets</div>
          <div className={styles.row}>
            <button className={shared.subtleBtn} onClick={() => setDraft(mineSellPreset({ minePoi, station: { id: station.id, name: station.base_name || station.name } }))} type="button">
              Mine here, sell at {station.base_name || station.name}
            </button>
            <button className={shared.subtleBtn} onClick={() => setDraft(mineSellPreset({ minePoi, station: { id: station.id, name: station.base_name || station.name }, deposit: true }))} type="button">
              Mine here, store at {station.base_name || station.name}
            </button>
          </div>
        </>
      )}

      <div className={shared.sectionTitle}>Saved loops</div>
      {plans.length === 0 && <div className={shared.emptyState}>No saved loops yet</div>}
      {plans.map((plan) => (
        <div key={plan.name} className={styles.planRow}>
          <span className={styles.planName}>{plan.name}</span>
          <span className={styles.hint}>{plan.steps.length} steps · {plan.repeat > 0 ? `${plan.repeat}x` : 'forever'}</span>
          <button className={shared.confirmBtn} disabled={!canRun} onClick={() => start(plan)} type="button"><Play size={11} /> Run</button>
          <button className={shared.subtleBtn} onClick={() => setDraft(plan)} type="button">Edit</button>
          <button className={shared.iconBtn} onClick={() => persist(plans.filter((p) => p !== plan))} type="button" aria-label={`Delete ${plan.name}`}><Trash2 size={12} /></button>
        </div>
      ))}

      <div className={shared.sectionTitle}>Build a loop</div>
      <div className={styles.row}>
        <input className={shared.textInput} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} aria-label="Loop name" />
        <label className={styles.check}>
          Repeat
          <input
            className={`${shared.textInput} ${styles.repeatInput}`}
            type="number"
            min={0}
            value={draft.repeat}
            onChange={(e) => setDraft((d) => ({ ...d, repeat: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
          />
          {draft.repeat === 0 ? 'forever' : 'times'}
        </label>
      </div>
      <ol className={styles.steps}>
        {draft.steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <span className={styles.stepLabel}>{stepLabel(step)}</span>
            <button className={shared.iconBtn} onClick={() => setSteps(move(draft.steps, i, i - 1))} type="button" aria-label="Move up"><ArrowUp size={12} /></button>
            <button className={shared.iconBtn} onClick={() => setSteps(move(draft.steps, i, i + 1))} type="button" aria-label="Move down"><ArrowDown size={12} /></button>
            <button className={shared.iconBtn} onClick={() => setSteps(draft.steps.filter((_, j) => j !== i))} type="button" aria-label="Remove step"><Trash2 size={12} /></button>
          </li>
        ))}
      </ol>
      <StepEditor onAdd={(step) => setSteps([...draft.steps, step])} />
      <div className={styles.row}>
        <button className={shared.confirmBtn} disabled={!canRun || draft.steps.length === 0} onClick={() => start(draft)} type="button">
          <Play size={12} /> Run
        </button>
        <button className={shared.actionBtn} disabled={!draft.name.trim() || draft.steps.length === 0} onClick={saveDraft} type="button">
          <Save size={12} /> Save
        </button>
        <button className={shared.subtleBtn} onClick={() => setDraft(EMPTY_PLAN)} type="button">Clear</button>
      </div>
    </Panel>
  )
}
