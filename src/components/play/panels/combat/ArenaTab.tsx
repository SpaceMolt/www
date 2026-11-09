'use client'

import { useEffect, useState } from 'react'
import { Check, Crown, Lock, RefreshCw, Swords, Trophy, Wind, X } from 'lucide-react'
import type { ArenaChallengeInfo } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery, useLocationState } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { errorMessage, shared } from '../../shared'
import { objectiveText, rulesText } from './combatLogic'
import { titleCase } from '@/lib/format'
import styles from '../CombatPanel.module.css'

/** Shown when the server result carries no message. */
const ARENA_DONE: Record<string, string> = {
  arena_accept: 'Challenge accepted',
  arena_decline: 'Challenge declined',
  arena_cancel: 'Challenge cancelled',
  arena_challenge: 'Challenge sent',
  arena_fight: 'Fight started',
}

export function ArenaTab({ inCombat }: { inCombat: boolean }) {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState('')
  const [sideSize, setSideSize] = useState(1)

  // A live NPC match changes every tick, so follow battle_update only in battle.
  const status = useCommandQuery(
    async (account) => (await account.commands.spacemolt_arena.status()).structuredContent,
    [],
    {
      refreshOnSections: ['location'],
      refreshOnEvents: ['arena_challenge', 'arena_objective', 'battle_ended', ...(inCombat ? ['battle_update'] : [])],
    },
  )
  const defs = useCommandQuery(
    async (account) => (await account.commands.spacemolt_arena.challenges()).structuredContent,
    [],
    { refreshOnSections: ['location'], refreshOnEvents: ['arena_objective', 'battle_ended'] },
  )
  const s = status.data

  useEffect(() => {
    const offChallenge = store.account.on('arena_challenge', (p) => {
      const text = {
        received: `${p.challenger_name} challenged ${p.challenged_name} (${sideLabel(p.max_side_size)})`,
        accepted: `${p.challenged_name} accepted ${p.challenger_name}'s challenge`,
        declined: `${p.challenged_name} declined ${p.challenger_name}'s challenge`,
        cancelled: `${p.challenger_name} cancelled the challenge to ${p.challenged_name}`,
      }[p.event]
      setNotice(text)
    })
    const offObjective = store.account.on('arena_objective', (p) => setNotice(p.message))
    return () => {
      offChallenge()
      offObjective()
    }
  }, [store])

  const run = async (label: string, call: Parameters<typeof mutate>[0]) => {
    setBusy(true)
    try {
      const result = await mutate(call, { label })
      const details = result.delta.details as { message?: string } | undefined
      uiStore.dispatch({ type: 'event', kind: 'success', text: details?.message ?? ARENA_DONE[label] ?? 'Done' })
      status.refetch()
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const atArena = Boolean(s?.at_arena) && !isDocked
  const hasPending = Boolean(s?.incoming || s?.outgoing)
  const inArenaBattle = Boolean(s?.battle_id) || inCombat
  const arenas = [...new Set((defs.data?.challenges ?? []).map((d) => d.poi_name))]
  const pilots = (location?.nearby_players ?? []).filter((p) => p.username)
  const challengeBlock = !atArena
    ? 'Undock at an arena to challenge a pilot.'
    : inArenaBattle
      ? 'Finish your current battle first.'
      : hasPending
        ? 'You already have a pending challenge.'
        : null

  return (
    <>
      <div className={styles.participantHeader}>
        <div className={shared.sectionTitle}><Trophy size={12} /> Arena</div>
        <button className={shared.refreshBtn} onClick={() => { status.refetch(); defs.refetch() }} title="Refresh arena" type="button">
          <RefreshCw size={14} />
        </button>
      </div>

      {notice && (
        <div className={styles.notice}>
          <span>{notice}</span>
          <button className={shared.subtleBtn} onClick={() => setNotice(null)} type="button" title="Dismiss"><X size={12} /></button>
        </div>
      )}

      {status.error && <div className={shared.emptyState}>{status.error}</div>}

      {s && (
        <div className={styles.reloadCard}>
          <div className={styles.reloadWeaponName}>
            {atArena ? 'You are at an arena.' : 'You are not at an arena.'}
          </div>
          {!atArena && (
            <small className={styles.hint}>
              Arena fights need you undocked at an arena POI
              {arenas.length ? `: ${arenas.join(', ')}` : ' (the Blood Arena in Krynn)'}. Find it on the Galaxy map and travel there.
              Arena fights are consequence-free: knocked-out ships are restored, but ammo and fuel are spent.
            </small>
          )}
          <div className={styles.statRow}>
            <span>Wins {s.arena_wins}</span>
            <span>Losses {s.arena_losses}</span>
            <span>Knockouts {s.arena_knockouts}</span>
          </div>
          {Object.keys(s.xp_used_today).length > 0 && (
            <small className={styles.hint}>
              Arena XP today (cap {s.xp_cap_per_skill} per skill):{' '}
              {Object.entries(s.xp_used_today).map(([skill, xp]) => `${skill} ${xp}`).join(', ')}
            </small>
          )}
        </div>
      )}

      {s?.match && (
        <div className={styles.reloadCard}>
          <div className={styles.reloadWeaponName}><Swords size={12} /> {s.match.name}</div>
          <small className={styles.hint}>Objective: {objectiveText(s.match.objective)}</small>
          <div className={styles.statRow}>
            <span>Tick {s.match.elapsed_ticks}</span>
            {s.match.ticks_remaining !== undefined && <span>{s.match.ticks_remaining} ticks left</span>}
            <span>{s.match.enemies_remaining} enemies left</span>
            <span>{s.match.waves_remaining} waves due</span>
          </div>
          <small className={styles.hint}>Fight it with the Battle tab controls.</small>
        </div>
      )}
      {s?.battle_id && !s.match && (
        <div className={styles.hint}>Arena duel in progress. Fight it with the Battle tab controls.</div>
      )}

      {s?.incoming && (
        <PendingCard label="Incoming challenge" info={s.incoming}>
          <button className={shared.confirmBtn} disabled={busy || !atArena} onClick={() => run('arena_accept', (c) => c.spacemolt_arena.accept())} type="button">
            <Check size={12} /> Accept
          </button>
          <button className={shared.dangerBtn} disabled={busy} onClick={() => run('arena_decline', (c) => c.spacemolt_arena.decline())} type="button">
            <X size={12} /> Decline
          </button>
        </PendingCard>
      )}
      {s?.outgoing && (
        <PendingCard label="Your challenge" info={s.outgoing}>
          <button className={shared.dangerBtn} disabled={busy} onClick={() => run('arena_cancel', (c) => c.spacemolt_arena.cancel())} type="button">
            <X size={12} /> Cancel
          </button>
        </PendingCard>
      )}

      <div>
        <div className={shared.sectionTitle}>Challenge a pilot</div>
        <form
          className={styles.formRow}
          onSubmit={(e) => {
            e.preventDefault()
            const id = target.trim()
            if (id) run('arena_challenge', (c) => c.spacemolt_arena.challenge({ id, max_side_size: sideSize }))
          }}
        >
          <input
            className={shared.textInput}
            list="arena-pilots"
            placeholder="Pilot name"
            aria-label="Pilot name"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={Boolean(challengeBlock)}
          />
          <datalist id="arena-pilots">
            {pilots.map((p) => <option key={p.player_id ?? p.username} value={p.username} />)}
          </datalist>
          <label className={styles.hint}>
            Per side{' '}
            <input
              className={`${shared.textInput} ${styles.numberInput}`}
              type="number"
              min={0}
              value={sideSize}
              onChange={(e) => setSideSize(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              disabled={Boolean(challengeBlock)}
            />
          </label>
          <button className={shared.accentBtn} type="submit" disabled={busy || Boolean(challengeBlock) || !target.trim()}>
            <Swords size={12} /> Challenge
          </button>
        </form>
        <small className={styles.hint}>
          {challengeBlock ?? `1 = solo duel, 0 = every fleet member at the arena. The pilot must be undocked here.${pilots.length ? '' : ' No other pilots in sight.'}`}
        </small>
      </div>

      <div>
        <div className={shared.sectionTitle}>NPC challenges</div>
        {defs.error && <div className={shared.emptyState}>{defs.error}</div>}
        {defs.data && defs.data.challenges.length === 0 && <div className={shared.emptyState}>No arena challenges are defined.</div>}
        <div className={styles.reloadList}>
          {(defs.data?.challenges ?? []).map((d) => {
            const block = !d.at_this_arena
              ? `Fought at ${d.poi_name}. Undock there to start.`
              : d.locked
                ? `Locked. Win first: ${d.requires.map((id) => defs.data?.challenges.find((c) => c.challenge_id === id)?.name ?? titleCase(id)).join(', ')}`
                : inArenaBattle
                  ? 'Finish your current battle first.'
                  : null
            const rules = rulesText(d.rules)
            return (
              <div key={d.challenge_id} className={styles.reloadCard}>
                <div className={styles.participantHeader}>
                  <span className={styles.reloadWeaponName}>
                    {d.locked && <Lock size={11} />} {d.name}
                  </span>
                  <span className={styles.participantShip}>
                    {titleCase(d.series)} {d.stage} · {d.wins ? `${d.wins} wins` : 'unbeaten'}
                  </span>
                </div>
                <details>
                  <summary className={styles.rosterSummary}>Briefing</summary>
                  <small className={styles.hint}>{d.description}</small>
                </details>
                <small className={styles.hint}>Objective: {objectiveText(d.objective)}</small>
                <small className={styles.hint}>
                  Enemies:{' '}
                  {d.enemies.map((e, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {e.count > 1 ? `${e.count}x ` : ''}{e.name} ({e.ship_class_name})
                      {e.is_boss && <Crown size={10} aria-label="boss" />}
                      {e.flees && <Wind size={10} aria-label="flees" />}
                    </span>
                  ))}
                  {d.waves.length > 0 && ` + ${d.waves.length} wave${d.waves.length === 1 ? '' : 's'} (${d.waves.map((w) => w.name).join(', ')})`}
                </small>
                {rules.length > 0 && <small className={styles.hint}>Rules: {rules.join(' · ')}</small>}
                <div className={styles.reloadControls}>
                  <button
                    className={shared.dangerBtn}
                    disabled={busy || Boolean(block)}
                    onClick={() => run('arena_fight', (c) => c.spacemolt_arena.fight({ id: d.challenge_id }))}
                    type="button"
                  >
                    <Swords size={12} /> Fight
                  </button>
                  {block && <small className={styles.hint}>{block}</small>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

const sideLabel = (n: number) => (n === 1 ? 'solo duel' : n === 0 ? 'whole fleets' : `up to ${n} per side`)

function PendingCard({ label, info, children }: { label: string; info: ArenaChallengeInfo; children: React.ReactNode }) {
  return (
    <div className={styles.reloadCard}>
      <div className={styles.reloadWeaponName}>
        {label}: {info.opponent_name}
      </div>
      <small className={styles.hint}>
        {sideLabel(info.max_side_size)} · expires at tick {info.expires_tick}. Both pilots must stay undocked at the arena.
      </small>
      <div className={styles.reloadControls}>{children}</div>
    </div>
  )
}
