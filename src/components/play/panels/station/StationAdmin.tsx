'use client'

import { useState } from 'react'
import { Save, X, Ban, UserPlus, Users, RotateCcw, PackageOpen } from 'lucide-react'
import type { StationConfigResponse } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { ConfirmAction, Loading, errorMessage, shared } from '../../shared'
import fac from '../facilities/facilities.module.css'
import { GATED_SERVICES, SERVICE_ACCESS, feePercent, parseAmount, parseItemIds } from './adminInputs'
import styles from './station.module.css'

type RunMutation = ReturnType<typeof useCommandMutation>

/** A text input with a Save button; the value resets when `initial` changes. */
function SaveField({ label, initial, onSave, type = 'text', disabled }: {
  label: string
  initial: string
  onSave: (value: string) => void
  type?: 'text' | 'number' | 'textarea'
  disabled: boolean
}) {
  const [value, setValue] = useState(initial)
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) { setSeen(initial); setValue(initial) }
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {type === 'textarea'
        ? <textarea className={shared.textInput} rows={2} value={value} onChange={(e) => setValue(e.target.value)} />
        : <input className={shared.textInput} type={type} min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} />}
      <button className={shared.actionBtn} disabled={disabled || value === initial} onClick={() => onSave(value)} type="button" aria-label={`Save ${label}`}>
        <Save size={11} />
      </button>
    </div>
  )
}

/** Names on an allow/ban list, each removable, plus an input to add one. */
function NameList({ label, names, addLabel, onAdd, onRemove, disabled }: {
  label: string
  names: string[]
  addLabel: string
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState('')
  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.chips}>
          {names.length === 0 && <span className={styles.hint}>none</span>}
          {names.map((n) => (
            <span key={n} className={styles.chip}>
              {n}
              <button className={shared.iconBtn} disabled={disabled} onClick={() => onRemove(n)} type="button" aria-label={`Remove ${n}`}>
                <X size={10} />
              </button>
            </span>
          ))}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label} />
        <input className={shared.textInput} type="text" placeholder={addLabel} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button
          className={shared.actionBtn}
          disabled={disabled || !draft.trim()}
          onClick={() => { onAdd(draft.trim()); setDraft('') }}
          type="button"
          aria-label={addLabel}
        >
          <UserPlus size={11} />
        </button>
      </div>
    </div>
  )
}

/**
 * Every `station` admin action for a station or outpost the player's faction
 * owns. Outposts support only rename and description. The server enforces the
 * ManageBases permission and returns a readable error without it.
 */
export function StationAdmin({ isOutpost, onChanged }: { isOutpost: boolean; onChanged: () => void }) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [busy, setBusy] = useState(false)
  const [confirmDismantle, setConfirmDismantle] = useState(false)

  const { data: cfg, loading, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.station_info()).structuredContent,
    [],
  )

  const toast = (err: unknown) => uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })

  const run = async (label: string, fn: Parameters<RunMutation>[0]) => {
    setBusy(true)
    try {
      const result = await mutate(fn, { label })
      const message = (result.delta.details as StationConfigResponse | undefined)?.message
      if (message) uiStore.dispatch({ type: 'event', kind: 'success', text: message })
      refetch()
      onChanged()
    } catch (err) {
      toast(err)
    } finally {
      setBusy(false)
    }
  }

  // station_set_name runs as a query on the server, not a queued mutation.
  const rename = async (name: string) => {
    setBusy(true)
    try {
      await store.account.commands.spacemolt_facility.station_set_name({ name })
      refetch()
      onChanged()
    } catch (err) {
      toast(err)
    } finally {
      setBusy(false)
    }
  }

  const amount = (label: string, text: string, send: (n: number) => void) => {
    const n = parseAmount(text)
    if (n === null) uiStore.dispatch({ type: 'toast', kind: 'danger', text: `${label} must be a number of 0 or more` })
    else send(n)
  }

  const dismantleOutpost = async () => {
    setConfirmDismantle(false)
    setBusy(true)
    try {
      await mutate((c) => c.spacemolt_facility.dismantle_outpost(), { label: 'dismantle_outpost' })
      uiStore.dispatch({ type: 'event', kind: 'info', text: 'Outpost packed into an Outpost Kit in your cargo' })
    } catch (err) {
      toast(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !cfg) return <Loading message="Loading station settings..." />
  if (!cfg) return null

  return (
    <div className={styles.form}>
      <SaveField label="Name" initial={cfg.name} disabled={busy} onSave={rename} />
      <SaveField
        label="Description"
        type="textarea"
        initial={cfg.description ?? ''}
        disabled={busy}
        onSave={(description) => run('station_set_description', (c) => c.spacemolt_facility.set_description({ description }))}
      />

      {isOutpost ? (
        confirmDismantle ? (
          <ConfirmAction
            message="Pack this outpost back into an Outpost Kit? Faction storage must be empty. The founding fee is not refunded."
            confirmLabel="Dismantle"
            onConfirm={dismantleOutpost}
            onCancel={() => setConfirmDismantle(false)}
          />
        ) : (
          <div className={styles.row}>
            <button className={shared.dangerBtn} disabled={busy} onClick={() => setConfirmDismantle(true)} type="button">
              <PackageOpen size={11} /> Dismantle Outpost
            </button>
          </div>
        )
      ) : (
        <>
          <div className={fac.sectionHeader}>Access</div>
          <label className={styles.row}>
            <input type="checkbox" checked={cfg.public_access} disabled={busy}
              onChange={(e) => run('station_set_public', (c) => c.spacemolt_facility.set_public({ public: e.target.checked }))} />
            Public docking (off: only your faction, allowed factions and allowed players)
          </label>
          <label className={styles.row}>
            <input type="checkbox" checked={cfg.allow_outsider_facilities} disabled={busy}
              onChange={(e) => run('station_set_build_policy', (c) => c.spacemolt_facility.set_build_policy({ allow_outsiders: e.target.checked }))} />
            Let outsiders build facilities here (they pay rent to your treasury)
          </label>
          <label className={styles.row}>
            <input type="checkbox" checked={cfg.auto_buy_fuel} disabled={busy}
              onChange={(e) => run('station_set_auto_buy_fuel', (c) => c.spacemolt_facility.set_auto_buy_fuel({ auto_buy_fuel: e.target.checked }))} />
            Buy fuel from docked pilots (paid from your treasury)
          </label>
          {GATED_SERVICES.map((service) => (
            <div key={service} className={styles.row}>
              <span className={styles.label}>{service.replace(/_/g, ' ')}</span>
              <select
                className={shared.selectInput}
                value={cfg.service_access?.[service] ?? 'public'}
                disabled={busy}
                onChange={(e) => run('station_set_service_access', (c) =>
                  c.spacemolt_facility.set_service_access({ service, access: e.target.value as (typeof SERVICE_ACCESS)[number] }))}
              >
                {SERVICE_ACCESS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          ))}

          <div className={fac.sectionHeader}>Prices</div>
          <SaveField label="Market fee %" type="number" initial={String(feePercent(cfg.market_fee_bps))} disabled={busy}
            onSave={(v) => amount('Market fee', v, (fee_percent) => run('station_set_market_fee', (c) => c.spacemolt_facility.set_market_fee({ fee_percent })))} />
          <SaveField label="Refuel / unit" type="number" initial={String(cfg.refuel_price_each ?? 0)} disabled={busy}
            onSave={(v) => amount('Refuel price', v, (price) => run('station_set_refuel_price', (c) => c.spacemolt_facility.set_refuel_price({ price })))} />
          <SaveField label="Repair / hull" type="number" initial={String(cfg.repair_price_per_hull ?? 0)} disabled={busy}
            onSave={(v) => amount('Repair price', v, (price) => run('station_set_repair_price', (c) => c.spacemolt_facility.set_repair_price({ price })))} />

          <div className={fac.sectionHeader}>Contraband ({cfg.contraband_mode})</div>
          <SaveField label="Item ids" type="textarea" initial={(cfg.contraband_items ?? []).join(', ')} disabled={busy}
            onSave={(v) => run('station_set_contraband', (c) => c.spacemolt_facility.set_contraband({ contraband_items: parseItemIds(v) }))} />
          <div className={styles.row}>
            <span className={styles.label} />
            <span className={styles.hint}>Save an empty list to allow every item.</span>
            <button className={shared.subtleBtn} disabled={busy} onClick={() => run('station_reset_contraband', (c) => c.spacemolt_facility.reset_contraband())} type="button">
              <RotateCcw size={11} /> Reset to default
            </button>
          </div>

          <div className={fac.sectionHeader}><Users size={11} /> Dock lists</div>
          <NameList label="Allowed players" names={cfg.allowed_players ?? []} addLabel="Allow player (name or id)" disabled={busy}
            onAdd={(player) => run('station_allow_player', (c) => c.spacemolt_facility.allow_player({ player }))}
            onRemove={(player) => run('station_remove_player', (c) => c.spacemolt_facility.remove_player({ player }))} />
          <NameList label="Allowed factions" names={cfg.allowed_factions ?? []} addLabel="Allow faction (id)" disabled={busy}
            onAdd={(faction) => run('station_allow_faction', (c) => c.spacemolt_facility.allow_faction({ faction }))}
            onRemove={(faction) => run('station_remove_faction', (c) => c.spacemolt_facility.remove_faction({ faction }))} />
          <NameList label={'Banned players'} names={cfg.banned_players ?? []} addLabel="Ban player (name or id)" disabled={busy}
            onAdd={(player) => run('station_ban', (c) => c.spacemolt_facility.ban({ player }))}
            onRemove={(player) => run('station_unban', (c) => c.spacemolt_facility.unban({ player }))} />
          <div className={styles.hint}><Ban size={10} /> A ban also removes the player from the allow list and blocks docking at once.</div>
        </>
      )}
    </div>
  )
}
