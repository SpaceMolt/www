'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, MapPin, PackageCheck, RotateCcw, Send, Truck, Undo2, X } from 'lucide-react'
import type {
  ShippingActiveContract,
  ShippingListing,
  ShippingQuote,
  ShippingSettlementResponse,
  ShippingTrackResponse,
  ViewStorageResponse,
} from '@spacemolt/lib'
import { useAccountStore, useCargo, useCommandMutation, useCommandQuery, useLocationState, usePendingAction, usePlayer, useStations } from '@/lib/spacemolt'
import { ConfirmAction, Credits, shared, useAction } from '../../shared'
import { packageOptions, settleBlock, shipFormError, type ShipForm } from './logic'
import css from './missions.module.css'

type Actor = 'player' | 'faction'
type View = 'board' | 'hauls' | 'ship' | 'record'

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'board', label: 'Board' },
  { id: 'hauls', label: 'My hauls' },
  { id: 'ship', label: 'Ship a package' },
  { id: 'record', label: 'Carrier record' },
]

const PER_PAGE = 10

/** "42 ticks (~7m)" at the default 10 s tick. */
const ticks = (n: number) => `${n} ticks (~${Math.max(1, Math.round((n * 10) / 60))}m)`

export function ShippingTab() {
  const player = usePlayer()
  const dockedAt = useLocationState()?.docked_at ?? null
  const [view, setView] = useState<View>('board')
  const [actor, setActor] = useState<Actor>('player')
  const hasFaction = Boolean(player?.faction_id)

  return (
    <>
      <div className={`${css.row} ${css.spread}`}>
        <div className={css.subTabs}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`${css.subTab} ${view === v.id ? css.subTabActive : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        {hasFaction && (
          <select
            className={shared.selectInput}
            value={actor}
            onChange={(e) => setActor(e.target.value as Actor)}
            aria-label="Act as"
            title="Who carries or ships: you, or your faction (needs Manage Treasury and a local Market Runner)"
          >
            <option value="player">As me</option>
            <option value="faction">As faction</option>
          </select>
        )}
      </div>
      {view === 'board' && <Board actor={actor} dockedAt={dockedAt} />}
      {view === 'hauls' && <Hauls dockedAt={dockedAt} />}
      {view === 'ship' && <ShipPackage actor={actor} dockedAt={dockedAt} />}
      {view === 'record' && <CarrierRecord actor={actor} dockedAt={dockedAt} />}
    </>
  )
}

/** Public station directory (base id, name, system), loaded once per mount. */
function useStationDirectory() {
  return (useStations().data ?? []).filter((s) => !s.wrecked).map((s) => ({ base_id: s.base_id, base_name: s.name, system_name: s.system_name }))
}

function Board({ actor, dockedAt }: { actor: Actor; dockedAt: string | null }) {
  const mutate = useCommandMutation()
  const { run } = useAction()
  const pending = usePendingAction() !== null
  const [sort, setSort] = useState<'reward' | 'distance' | 'age'>('reward')
  const [level, setLevel] = useState<'' | 'standard' | 'priority'>('')
  const [destInput, setDestInput] = useState('')
  const stationNames = new Map(useStationDirectory().map((st) => [st.base_id, st.base_name]))
  const [dest, setDest] = useState('')
  const [page, setPage] = useState(1)

  const q = useCommandQuery(
    async (a) =>
      (
        await a.commands.spacemolt_shipping.list({
          eligible_as: actor,
          sort,
          page,
          per_page: PER_PAGE,
          ...(level ? { filter_service_level: level } : {}),
          ...(dest ? { filter_destination: dest } : {}),
        })
      ).structuredContent,
    [actor, sort, level, dest, page, dockedAt],
    { enabled: Boolean(dockedAt) },
  )

  if (!dockedAt) return <div className={shared.dockedOnly}>Dock at a station with a mission service to see its freight board.</div>

  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PER_PAGE))
  const applyDest = () => {
    setPage(1)
    setDest(destInput.trim())
  }

  const accept = async (id: string) => {
    const r = await run(
      'accept',
      () => mutate((c) => c.spacemolt_shipping.accept({ shipment_id: id, carrier: actor }), { label: 'shipping_accept' }),
      (r) => `Freight accepted. Package ${r.delta.details?.contract.package_id ?? ''} is in your ${actor === 'faction' ? 'faction ' : ''}storage here: withdraw it to haul.`,
    )
    if (r) q.refetch()
  }

  return (
    <>
      <div className={css.row}>
        <select className={shared.selectInput} value={sort} onChange={(e) => { setPage(1); setSort(e.target.value as typeof sort) }} aria-label="Sort by">
          <option value="reward">Highest reward</option>
          <option value="distance">Fewest jumps</option>
          <option value="age">Oldest first</option>
        </select>
        <select className={shared.selectInput} value={level} onChange={(e) => { setPage(1); setLevel(e.target.value as typeof level) }} aria-label="Service level">
          <option value="">Any service</option>
          <option value="standard">Standard</option>
          <option value="priority">Priority</option>
        </select>
        <input
          className={shared.textInput}
          placeholder="Destination station id"
          aria-label="Destination station id"
          value={destInput}
          onChange={(e) => setDestInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyDest()}
          onBlur={applyDest}
        />
        <button type="button" className={shared.refreshBtn} onClick={q.refetch} title="Refresh board">
          <RotateCcw size={12} />
        </button>
      </div>

      {q.loading && !q.data && <div className={css.hint}><span className={shared.spinner} /> Loading freight board...</div>}
      {q.error && <div className={css.hint}>{q.error}</div>}
      {q.data && q.data.shipments.length === 0 && (
        <div className={shared.emptyState}>{q.data.empty_reason ?? 'No freight posted here.'}</div>
      )}

      {q.data?.shipments.map((l) => (
        <ListingCard key={l.contract.id} listing={l} destName={stationNames.get(l.contract.destination_base_id)} disabled={pending || !l.eligible} onAccept={() => accept(l.contract.id)} />
      ))}

      {pages > 1 && (
        <div className={`${css.row} ${css.spread}`}>
          <button type="button" className={shared.subtleBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={12} /> Prev
          </button>
          <span className={css.meta}>Page {page} / {pages} ({q.data?.total} runs)</span>
          <button type="button" className={shared.subtleBtn} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}
    </>
  )
}

function ListingCard({ listing: l, destName, disabled, onAccept }: { listing: ShippingListing; destName?: string; disabled: boolean; onAccept: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const c = l.contract
  return (
    <div className={css.card}>
      <div className={`${css.row} ${css.spread}`}>
        <span className={css.name}><MapPin size={11} /> To {destName ?? c.destination_base_id}</span>
        <span className={`${css.value} ${css.good}`}>
          <Credits amount={c.base_reward} />{c.max_speed_bonus > 0 && <> + up to <Credits amount={c.max_speed_bonus} /></>}
        </span>
      </div>
      <div className={css.row}>
        <span className={css.meta}>{c.route_hops ?? '?'} jumps</span>
        <span className={css.meta}>{c.service_level}</span>
        <span className={css.meta}>tier {c.risk_band}</span>
        <span className={css.meta}>{c.insurable && c.covered_value ? <>insured <Credits amount={c.covered_value} /></> : 'uninsured'}</span>
      </div>
      <div className={css.meta}>
        Full bonus within {ticks(l.target_ticks)}; deadline {ticks(l.deadline_ticks)}; recovery {ticks(l.recovery_ticks)} after that.
      </div>
      {!l.eligible && l.reason && <div className={`${css.hint} ${css.warn}`}>{l.reason}</div>}
      {confirming ? (
        <ConfirmAction
          variant="accent"
          message={`Accept? If you break the seal, lose the box or miss the recovery window you owe ${c.failure_debt.toLocaleString()} cr freight debt.`}
          confirmLabel="Accept"
          onConfirm={() => {
            setConfirming(false)
            onAccept()
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <button type="button" className={shared.accentBtn} disabled={disabled} onClick={() => setConfirming(true)}>
          <Truck size={12} /> Accept haul
        </button>
      )}
    </div>
  )
}

type Settle = 'deliver' | 'return' | 'cancel'

function settlementText(kind: Settle, d?: ShippingSettlementResponse): string {
  if (!d) return `Shipment ${kind} done.`
  const parts = [
    d.carrier_payout ? `paid ${d.carrier_payout.toLocaleString()} cr` : '',
    d.shipper_refund ? `refunded ${d.shipper_refund.toLocaleString()} cr to the shipper` : '',
    d.debt_created ? `late fee ${d.debt_created.toLocaleString()} cr added as freight debt` : '',
  ].filter(Boolean)
  const verb = { deliver: 'Delivered', return: 'Returned', cancel: 'Canceled' }[kind]
  return `${verb}${d.late ? ' late' : ''}${parts.length ? `: ${parts.join(', ')}` : ''}.`
}

function Hauls({ dockedAt }: { dockedAt: string | null }) {
  const q = useCommandQuery(
    async (a) => (await a.commands.spacemolt_shipping.active()).structuredContent,
    [],
    { refreshOnSections: ['cargo', 'location'] },
  )
  const shipments = q.data?.shipments ?? []

  return (
    <>
      {q.loading && !q.data && <div className={css.hint}><span className={shared.spinner} /> Loading your contracts...</div>}
      {q.error && <div className={css.hint}>{q.error}</div>}
      {q.data && shipments.length === 0 && (
        <div className={shared.emptyState}>{q.data.message ?? 'No live freight contracts. Accept a haul from a station board, or ship a package.'}</div>
      )}
      {shipments.map((s) => (
        <HaulCard key={s.contract.id} entry={s} dockedAt={dockedAt} onSettled={q.refetch} />
      ))}
    </>
  )
}

function HaulCard({ entry: s, dockedAt, onSettled }: { entry: ShippingActiveContract; dockedAt: string | null; onSettled: () => void }) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { run } = useAction()
  const pending = usePendingAction() !== null
  const [confirmKind, setConfirmKind] = useState<Settle | null>(null)
  const [tracked, setTracked] = useState<ShippingTrackResponse | null>(null)

  const settle = async (kind: Settle) => {
    setConfirmKind(null)
    const r = await run(
      kind,
      () => mutate((c) => c.spacemolt_shipping[kind]({ shipment_id: s.contract.id }), { label: `shipping_${kind}` }),
      (r) => settlementText(kind, r.delta.details),
    )
    if (r) onSettled()
  }

  const track = () =>
    run('track', async () => setTracked((await store.account.commands.spacemolt_shipping.track({ shipment_id: s.contract.id, limit: 20 })).structuredContent ?? null))

  const c = s.contract
  const isCarrier = s.role === 'carrier' && c.status === 'in_transit'
  const canCancel = s.role === 'shipper' && c.status === 'posted'
  const destination = s.destination_name ?? c.destination_base_id
  const origin = s.origin_name ?? c.origin_base_id
  const deliverBlock = settleBlock({ station: c.destination_base_id, stationName: destination, dockedAt, hasPackage: s.package_in_your_cargo })
  const returnBlock = settleBlock({ station: c.origin_base_id, stationName: origin, dockedAt, hasPackage: s.package_in_your_cargo })
  const lateFee = s.late_fee_if_delivered_now ?? 0
  const confirmText: Record<Settle, string> = {
    deliver: `Deliver late? You get no reward and owe a ${lateFee.toLocaleString()} cr late fee (instead of ${s.failure_debt.toLocaleString()} cr on default).`,
    return: s.late
      ? `Return to ${origin}? You get no reward and owe a ${lateFee.toLocaleString()} cr late fee.`
      : `Return to ${origin}? You give up the ${c.base_reward.toLocaleString()} cr reward.`,
    cancel: `Cancel this posting? Reward, bonus and premium are refunded; the ${c.service_fee.toLocaleString()} cr service fee is not.`,
  }

  return (
    <div className={`${css.card} ${s.late ? css.cardWarn : ''}`}>
      <div className={`${css.row} ${css.spread}`}>
        <span className={css.name}>{origin} &rarr; {destination}</span>
        <span className={shared.badge}>{s.role.replace('_', ' ')} / {c.status.replace('_', ' ')}</span>
      </div>
      <div className={css.row}>
        <span className={css.meta}>pkg {c.package_id}</span>
        {s.destination_system && <span className={css.meta}>[{s.destination_system}]</span>}
        {c.status === 'in_transit' && (
          <span className={css.meta}>
            {s.late ? `overdue: ${ticks(s.ticks_to_recovery_deadline)} left to recover` : `${ticks(s.ticks_to_deadline)} to deadline`}
          </span>
        )}
        {c.status === 'in_transit' && !s.late && (
          <span className={`${css.value} ${css.good}`}>pays <Credits amount={s.payout_if_delivered_now} /> now</span>
        )}
        {s.last_known_location && <span className={css.meta}>last seen {s.last_known_location}</span>}
      </div>
      <div className={css.hint}>{s.next_step}</div>

      {confirmKind ? (
        <ConfirmAction
          message={confirmText[confirmKind]}
          confirmLabel={{ deliver: 'Deliver', return: 'Return', cancel: 'Cancel posting' }[confirmKind]}
          cancelLabel="Back"
          onConfirm={() => settle(confirmKind)}
          onCancel={() => setConfirmKind(null)}
        />
      ) : (
        <div className={css.row}>
          {isCarrier && (
            <button
              type="button"
              className={shared.confirmBtn}
              disabled={pending || Boolean(deliverBlock)}
              title={deliverBlock ?? undefined}
              onClick={() => (s.late ? setConfirmKind('deliver') : settle('deliver'))}
            >
              <PackageCheck size={12} /> Deliver
            </button>
          )}
          {isCarrier && (
            <button
              type="button"
              className={shared.subtleBtn}
              disabled={pending || Boolean(returnBlock)}
              title={returnBlock ?? undefined}
              onClick={() => setConfirmKind('return')}
            >
              <Undo2 size={12} /> Return
            </button>
          )}
          {canCancel && (
            <button type="button" className={shared.dangerBtn} disabled={pending} onClick={() => setConfirmKind('cancel')}>
              <X size={12} /> Cancel posting
            </button>
          )}
          <button type="button" className={shared.subtleBtn} onClick={tracked ? () => setTracked(null) : track}>
            <MapPin size={12} /> {tracked ? 'Hide track' : 'Track'}
          </button>
        </div>
      )}
      {isCarrier && deliverBlock && <div className={css.hint}>To deliver: {deliverBlock}</div>}

      {tracked && (
        <div className={css.events}>
          {tracked.events.length === 0 && <span className={css.meta}>No beacon samples yet.</span>}
          {tracked.events.map((e) => (
            <span key={e.id} className={css.meta}>
              tick {e.observed_tick}: {e.class.replace(/_/g, ' ')}
              {e.base_id ? ` @ ${e.base_id}` : e.poi_id ? ` @ ${e.poi_id}` : ''}
              {e.system_id ? ` [${e.system_id}]` : ''}
              {e.custodian ? ` held by ${e.custodian.kind} ${e.custodian.id}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

type ShipFormState = ShipForm & {
  serviceLevel: 'standard' | 'priority'
  insured: boolean
  invitedType: Actor
}

const EMPTY_FORM: ShipFormState = {
  packageId: '',
  destination: '',
  baseReward: '',
  speedBonus: '',
  visibility: 'public',
  invitedId: '',
  serviceLevel: 'standard',
  insured: false,
  invitedType: 'player',
}

function ShipPackage({ actor, dockedAt }: { actor: Actor; dockedAt: string | null }) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const pending = usePendingAction() !== null
  const cargo = useCargo()
  const [form, setForm] = useState<ShipFormState>(EMPTY_FORM)
  const [quote, setQuote] = useState<{ key: string; quote: ShippingQuote } | null>(null)
  const { busy, run } = useAction()
  const quoting = busy === 'quote'
  const [confirming, setConfirming] = useState(false)

  const storageQ = useCommandQuery(
    async (a) => (await a.commands.spacemolt_storage.view()).structuredContent as ViewStorageResponse | undefined,
    [dockedAt],
    { enabled: Boolean(dockedAt), refreshOnSections: ['cargo'] },
  )
  const options = packageOptions({ cargo: cargo ?? [], storage: storageQ.data?.items ?? [] })
  // Every public station is a destination; the field still takes any typed id.
  const directory = useStationDirectory()
  const stations = [...new Map([...(storageQ.data?.locations ?? []), ...directory].map((s) => [s.base_id, s])).values()]
    .sort((a, b) => a.base_name.localeCompare(b.base_name))

  if (!dockedAt) return <div className={shared.dockedOnly}>Dock at a station with a mission service to ship a package from it.</div>

  const set = <K extends keyof ShipFormState>(k: K, v: ShipFormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const formError = shipFormError(form)
  const source = options.find((o) => o.item_id === form.packageId)?.source ?? 'cargo'
  const params = {
    package_id: form.packageId,
    destination_base_id: form.destination.trim(),
    base_reward: Number(form.baseReward),
    ...(form.speedBonus.trim() ? { speed_bonus: Number(form.speedBonus) } : {}),
    service_level: form.serviceLevel,
    insured: form.insured,
    visibility: form.visibility,
    source,
    shipper: actor,
    ...(form.visibility === 'invited' ? { invited_carrier_type: form.invitedType, invited_carrier_id: form.invitedId.trim() } : {}),
  }
  const key = JSON.stringify(params)
  const current = quote?.key === key ? quote.quote : null

  const getQuote = () =>
    run('quote', async () => {
      const r = await store.account.commands.spacemolt_shipping.quote(params)
      if (r.structuredContent) setQuote({ key, quote: r.structuredContent.quote })
    })

  const post = async (total: number) => {
    setConfirming(false)
    const r = await run(
      'post',
      () => mutate((c) => c.spacemolt_shipping.post({ ...params, max_total_cost: total }), { label: 'shipping_post' }),
      (r) => `Shipment posted (${r.delta.details?.contract.id ?? 'ok'}). Track it under My hauls.`,
    )
    if (!r) return
    setForm(EMPTY_FORM)
    setQuote(null)
    storageQ.refetch()
  }

  return (
    <>
      <div className={css.hint}>
        Seal goods into a package at a Logistics facility first. You pay the reward into escrow, plus a service fee (5% of reward + bonus, 25 cr minimum) and any insurance premium.
      </div>
      <div className={css.form}>
        <span className={css.label}>Package</span>
        <select className={shared.selectInput} value={form.packageId} onChange={(e) => set('packageId', e.target.value)} aria-label="Package">
          <option value="">{options.length ? 'Pick a sealed package' : 'No sealed packages in cargo or storage'}</option>
          {options.map((o) => (
            <option key={`${o.source}:${o.item_id}`} value={o.item_id}>
              {o.label} ({o.source})
            </option>
          ))}
        </select>

        <span className={css.label}>Destination</span>
        <input
          className={shared.textInput}
          list="shipping-stations"
          placeholder="Pick a station, or type a base or POI id"
          aria-label="Destination"
          value={form.destination}
          onChange={(e) => set('destination', e.target.value)}
        />
        <datalist id="shipping-stations">
          {stations.map((s) => (
            <option key={s.base_id} value={s.base_id}>{`${s.base_name} (${s.system_name})`}</option>
          ))}
        </datalist>

        <span className={css.label}>Reward (cr)</span>
        <input className={shared.textInput} inputMode="numeric" value={form.baseReward} onChange={(e) => set('baseReward', e.target.value)} aria-label="Reward (cr)" />

        <span className={css.label}>Speed bonus (cr)</span>
        <input
          className={shared.textInput}
          inputMode="numeric"
          placeholder="optional"
          aria-label="Speed bonus (cr)"
          value={form.speedBonus}
          onChange={(e) => set('speedBonus', e.target.value)}
        />

        <span className={css.label}>Service</span>
        <select className={shared.selectInput} value={form.serviceLevel} onChange={(e) => set('serviceLevel', e.target.value as ShipFormState['serviceLevel'])} aria-label="Service">
          <option value="standard">Standard</option>
          <option value="priority">Priority (tighter window)</option>
        </select>

        <span className={css.label}>Insurance</span>
        <label className={css.meta}>
          <input type="checkbox" checked={form.insured} onChange={(e) => set('insured', e.target.checked)} /> Insure the cargo
        </label>

        <span className={css.label}>Visibility</span>
        <select className={shared.selectInput} value={form.visibility} onChange={(e) => set('visibility', e.target.value as ShipForm['visibility'])} aria-label="Visibility">
          <option value="public">Public</option>
          <option value="faction">Faction</option>
          <option value="allies">Allies</option>
          <option value="invited">Invited carrier only</option>
        </select>

        {form.visibility === 'invited' && (
          <>
            <span className={css.label}>Invited carrier</span>
            <div className={css.row}>
              <select className={shared.selectInput} value={form.invitedType} onChange={(e) => set('invitedType', e.target.value as Actor)} aria-label="Invited carrier type">
                <option value="player">Player</option>
                <option value="faction">Faction</option>
              </select>
              <input className={shared.textInput} placeholder="Player or faction id" value={form.invitedId} onChange={(e) => set('invitedId', e.target.value)} aria-label="Invited carrier id" />
            </div>
          </>
        )}
      </div>

      {formError && <div className={css.hint}>{formError}</div>}
      <div className={css.row}>
        <button type="button" className={shared.actionBtn} disabled={Boolean(formError) || quoting} onClick={getQuote}>
          {quoting ? <span className={shared.spinner} /> : <RotateCcw size={12} />} Get quote
        </button>
      </div>

      {current && <QuoteView quote={current} />}
      {current &&
        (confirming ? (
          <ConfirmAction
            variant="accent"
            message={`Post this shipment for ${current.total_cost.toLocaleString()} cr total?`}
            confirmLabel="Post"
            onConfirm={() => post(current.total_cost)}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <button type="button" className={shared.accentBtn} disabled={pending} onClick={() => setConfirming(true)}>
            <Send size={12} /> Post shipment (<Credits amount={current.total_cost} />)
          </button>
        ))}
      {quote && !current && <div className={css.hint}>The form changed since the last quote. Get a new quote to post.</div>}
    </>
  )
}

function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className={css.kv}>
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <span className={css.label}>{k}</span>
          <span className={css.value}>{v}</span>
        </Fragment>
      ))}
    </div>
  )
}

function QuoteView({ quote: q }: { quote: ShippingQuote }) {
  const rows: Array<[string, ReactNode]> = [
    ['Route', `${q.route_hops} jumps, ${q.service_level}`],
    ['Windows', `full bonus ${ticks(q.target_ticks)}, deadline ${ticks(q.deadline_ticks)}, recovery +${ticks(q.recovery_ticks)}`],
    ['Appraised value', <Credits amount={q.appraised_value} />],
    [
      'Insurance',
      q.insurance_selected && q.insurable ? (
        <>covers <Credits amount={q.covered_value} /></>
      ) : (
        q.uninsurable_reason ?? (q.insurable ? 'not selected' : 'not insurable')
      ),
    ],
    ['Reward', <Credits amount={q.base_reward} />],
    ['Speed bonus', <Credits amount={q.max_speed_bonus} />],
    ['Service fee', <Credits amount={q.service_fee} />],
    ['Premium', <Credits amount={q.premium} />],
    ['Total cost', <strong><Credits amount={q.total_cost} /></strong>],
    [
      'Going rate',
      q.estimate_samples > 0 ? (
        <><Credits amount={q.estimated_reward} /> ({q.estimate_samples} recent runs)</>
      ) : (
        'not enough data yet: name your own price'
      ),
    ],
    ['Carrier tier', `${q.required_carrier_tier} or better`],
    ['Carrier liability', <Credits amount={q.failure_debt} />],
  ]
  return (
    <div className={css.card}>
      <KeyValues rows={rows} />
      {q.consequences && <div className={css.hint}>{q.consequences}</div>}
    </div>
  )
}

function CarrierRecord({ actor, dockedAt }: { actor: Actor; dockedAt: string | null }) {
  const mutate = useCommandMutation()
  const { run } = useAction()
  const pending = usePendingAction() !== null
  const [amount, setAmount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const q = useCommandQuery(
    async (a) => (await a.commands.spacemolt_shipping.profile({ carrier: actor })).structuredContent,
    [actor],
  )

  if (q.loading && !q.data) return <div className={css.hint}><span className={shared.spinner} /> Loading carrier record...</div>
  if (q.error) return <div className={css.hint}>{q.error}</div>
  if (!q.data) return null

  const { profile: p, progression: g, capacity: cap, debts } = q.data
  const owed = p.outstanding_debt
  const amountValid = !amount.trim() || (/^\d+$/.test(amount.trim()) && Number(amount) > 0)
  const payAmount = amount.trim() ? Math.min(Number(amount), owed) : owed

  const pay = async () => {
    setConfirming(false)
    const r = await run(
      'pay',
      () => mutate((c) => c.spacemolt_shipping.pay_debt({ carrier: actor, ...(amount.trim() ? { amount: Number(amount) } : {}) }), { label: 'shipping_pay_debt' }),
      (r) => `Paid ${(r.delta.details?.amount_paid ?? 0).toLocaleString()} cr of freight debt.`,
    )
    if (!r) return
    setAmount('')
    q.refetch()
  }

  const rows: Array<[string, ReactNode]> = [
    ['Tier', p.tier],
    ['Delivered', `${p.successful_deliveries} runs (${p.priority_deliveries} priority), ${p.delivered_value.toLocaleString()} cr value`],
    ['Late / returns', `${p.late_deliveries} late, ${p.returns} returned`],
    ['Breaches / defaults', `${p.breaches} / ${p.defaults}`],
    [
      'Next tier',
      g.at_maximum_tier
        ? 'at maximum tier'
        : `${g.next_tier}: ${g.remaining_successful_deliveries} more runs, ${g.remaining_delivered_value.toLocaleString()} cr more value`,
    ],
    [
      'Contracts',
      cap.active_contracts_unlimited ? `${cap.active_contracts} active` : `${cap.active_contracts} / ${cap.active_contract_limit ?? '?'} active`,
    ],
    [
      'Liability',
      cap.liability_unlimited
        ? `${cap.active_liability.toLocaleString()} cr (no limit)`
        : `${cap.active_liability.toLocaleString()} / ${(cap.aggregate_liability_limit ?? 0).toLocaleString()} cr, per package ${(cap.single_package_liability_limit ?? 0).toLocaleString()} cr`,
    ],
    ['Outstanding debt', <Credits amount={owed} />],
  ]

  return (
    <>
      <div className={css.card}>
        <KeyValues rows={rows} />
      </div>
      {q.data.debt_blocks_acceptance && <div className={`${css.hint} ${css.warn}`}>{q.data.debt_block_reason ?? 'Unpaid freight debt blocks new hauls.'}</div>}

      {debts.filter((d) => d.outstanding > 0).map((d) => (
        <div key={d.id} className={css.card}>
          <div className={`${css.row} ${css.spread}`}>
            <span className={css.meta}>Shipment {d.shipment_id}</span>
            <span className={`${css.value} ${css.warn}`}><Credits amount={d.outstanding} /> of <Credits amount={d.original} /></span>
          </div>
          <span className={css.meta}>owed to {d.creditor.kind} {d.creditor.id}</span>
        </div>
      ))}

      {owed > 0 && (
        <>
          <div className={css.row}>
            <input
              className={shared.textInput}
              inputMode="numeric"
              placeholder={`Amount (blank = all ${owed.toLocaleString()} cr)`}
              aria-label="Amount to settle"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!confirming && (
              <button
                type="button"
                className={shared.warningBtn}
                disabled={pending || !dockedAt || !amountValid}
                onClick={() => setConfirming(true)}
              >
                Pay debt
              </button>
            )}
          </div>
          {!dockedAt && <div className={css.hint}>Pay at any station with a mission service.</div>}
          {confirming && (
            <ConfirmAction
              variant="accent"
              message={`Pay ${payAmount.toLocaleString()} cr of freight debt?`}
              confirmLabel="Pay"
              onConfirm={pay}
              onCancel={() => setConfirming(false)}
            />
          )}
        </>
      )}
    </>
  )
}
