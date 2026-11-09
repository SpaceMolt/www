'use client'

import { useState } from 'react'
import { Crown, Fuel, LogOut, Ship, UserMinus, UserPlus, Users, Wrench, X, Check, Armchair } from 'lucide-react'
import type { Commands, MutationResult, RefuelResponse, RepairResponse } from '@spacemolt/lib'
import { useCargo, useCommandMutation, useCommandQuery, useLocationState, useModules, usePlayer } from '@/lib/spacemolt'
import { ConfirmAction, shared, useAction } from '../../shared'
import styles from '../CrewPanel.module.css'
import { hasRepairKit, invitablePlayers, parseCount } from './crewLogic'
import { getShip } from '@/data/catalog'

/** Shown when the server result carries no message. */
const DONE: Record<string, string> = {
  fleet_invite: 'Fleet invite sent',
  fleet_accept: 'Joined the fleet',
  fleet_decline: 'Fleet invite declined',
  fleet_create: 'Fleet created',
  fleet_kick: 'Member removed from the fleet',
  fleet_disband: 'Fleet disbanded',
  fleet_disembark: 'Disembarked',
  fleet_leave: 'Left the fleet',
  fleet_board: 'Boarded',
}

export function FleetTab() {
  const mutate = useCommandMutation()
  const player = usePlayer()
  const location = useLocationState()
  const modules = useModules()
  const cargo = useCargo()
  const { busy: running, run } = useAction()
  const busy = running !== null
  const [confirm, setConfirm] = useState<string | null>(null)
  const [inviteName, setInviteName] = useState('')
  const [boardGarage, setBoardGarage] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})

  const fleet = useCommandQuery(
    async (account) => (await account.commands.spacemolt_fleet.status()).structuredContent,
    [],
    { refreshOnSections: ['location'], refreshOnEvents: ['fleet'] },
  )
  const { refetch } = fleet

  const fs = fleet.data
  const inFleet = Boolean(fs?.in_fleet)
  // Fleet fuel and hull read-outs (refuel/repair with target=fleet are queries).
  const support = useCommandQuery(
    async (account) => {
      const [fuel, hull] = await Promise.all([
        account.query('spacemolt', 'refuel', { target: 'fleet' }),
        account.query('spacemolt', 'repair', { target: 'fleet' }),
      ])
      return {
        fuel: fuel.structuredContent as RefuelResponse | undefined,
        hull: hull.structuredContent as RepairResponse | undefined,
      }
    },
    [fs?.fleet_id],
    { enabled: inFleet, refreshOnSections: ['ship'], refreshOnEvents: ['fleet', 'refueled_by', 'repaired_by'] },
  )

  const docked = Boolean(location?.docked_at)
  const nearby = location?.nearby_players ?? []
  const nearbyIds = new Set(nearby.map((p) => p.player_id))
  const members = fs?.members ?? []
  const self = members.find((m) => m.player_id === player?.id)
  const isPassenger = Boolean(self?.passenger)
  const hasPump = Boolean(modules?.some((m) => m.type_id === 'refueling_pump'))
  const canRepair = Boolean(modules?.some((m) => m.type_id === 'repair_arm')) && hasRepairKit(cargo)
  const invitable = invitablePlayers(nearby, members.map((m) => m.player_id))
  const carriers = nearby.filter((p) => p.docked && player?.faction_id && p.faction_id === player.faction_id)

  const act = <T extends { message?: string }>(call: (c: Commands) => Promise<MutationResult<T>>, label: string) =>
    run('crew', () => mutate(call, { label }), (r) => r.delta.details?.message ?? DONE[label] ?? 'Done').then((r) => {
      setConfirm(null)
      refetch()
      return r
    })

  const invite = (id: string) => act((c) => c.spacemolt_fleet.invite({ id }), 'fleet_invite').then((r) => r && setInviteName(''))

  const sendSupport = (kind: 'refuel' | 'repair', target: string) => {
    const quantity = parseCount(qty[`${kind}:${target}`] ?? '') || undefined
    return run('crew',
      async () =>
        (kind === 'refuel'
          ? await mutate((c) => c.spacemolt.refuel({ target, quantity }), { label: 'refuel' })
          : await mutate((c) => c.spacemolt.repair({ target, quantity }), { label: 'repair' })
        ).delta.details?.message,
      (message) => message ?? `${kind} sent to ${target}`,
    ).then(() => support.refetch())
  }

  if (fleet.loading && !fs) return <div className={shared.emptyState}>Loading fleet status...</div>
  if (fleet.error && !fs) return <div className={shared.emptyState}>{fleet.error}</div>

  return (
    <div className={styles.stack}>
      {fs?.pending_invite && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <UserPlus size={14} /> Fleet invite from {fs.invite_from ?? 'unknown'}
          </div>
          {fs.arena_only && <div className={styles.hint}>Arena-only fleet: it disbands when its leader leaves the arena.</div>}
          <div className={styles.row}>
            <button
              className={shared.confirmBtn}
              disabled={busy}
              onClick={() => act((c) => c.spacemolt_fleet.accept(), 'fleet_accept')}
              type="button"
            >
              <Check size={12} /> Accept
            </button>
            <button
              className={shared.subtleBtn}
              disabled={busy}
              onClick={() => act((c) => c.spacemolt_fleet.decline(), 'fleet_decline')}
              type="button"
            >
              <X size={12} /> Decline
            </button>
          </div>
          {!nearby.some((p) => p.username === fs.invite_from) && (
            <div className={styles.hint}>You must be at the same location as the fleet to accept.</div>
          )}
        </div>
      )}

      {!inFleet && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Users size={14} /> No fleet
          </div>
          <div className={styles.hint}>
            A fleet moves together: the leader controls travel, jumps, docking and combat targets. Speed is the slowest ship.
          </div>
          <div className={styles.row}>
            <button
              className={shared.accentBtn}
              disabled={busy || Boolean(location?.in_transit)}
              title={location?.in_transit ? 'Cannot create a fleet in transit' : undefined}
              onClick={() => act((c) => c.spacemolt_fleet.create(), 'fleet_create')}
              type="button"
            >
              <Users size={12} /> Create fleet
            </button>
          </div>
        </div>
      )}

      {inFleet && fs && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Users size={14} /> Fleet led by {fs.leader ?? 'unknown'}
            </div>
            <span className={shared.badgeCyan}>
              {members.length}
              {fs.max_size ? `/${fs.max_size}` : ''} members
            </span>
          </div>
          {fs.arena_only && <div className={styles.hint}>Arena-only fleet: it disbands when its leader leaves the arena.</div>}
          {members.map((m) => {
            const isSelf = m.player_id === player?.id
            const here = isSelf || nearbyIds.has(m.player_id)
            const fuel = support.data?.fuel?.members?.find((x) => x.player_id === m.player_id)
            const hull = support.data?.hull?.members?.find((x) => x.player_id === m.player_id)
            return (
              <div key={m.player_id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    {m.is_leader ? <Crown size={12} /> : <Ship size={12} />} {m.username}
                    {isSelf && <span className={shared.badgeGrey}>You</span>}
                    {m.passenger && <span className={shared.badgePurple}>Passenger</span>}
                  </div>
                  {fs.is_leader && !isSelf && (
                    confirm === `kick:${m.player_id}` ? (
                      <ConfirmAction
                        message={`Kick ${m.username}?`}
                        onConfirm={() =>
                          act((c) => c.spacemolt_fleet.kick({ id: m.player_id }), 'fleet_kick')
                        }
                        onCancel={() => setConfirm(null)}
                        confirmDisabled={busy}
                        confirmLabel="Kick"
                      />
                    ) : (
                      <button className={shared.dangerBtn} disabled={busy} onClick={() => setConfirm(`kick:${m.player_id}`)} type="button">
                        <UserMinus size={12} /> Kick
                      </button>
                    )
                  )}
                </div>
                <div className={styles.meta}>
                  {fuel && (
                    <span>
                      <Fuel size={10} /> <b>{fuel.fuel}/{fuel.max_fuel}</b> ({fuel.fuel_per_jump}/jump)
                    </span>
                  )}
                  {hull && (
                    <span>
                      <Wrench size={10} /> hull <b>{hull.hull}/{hull.max_hull}</b>
                    </span>
                  )}
                  {(fuel?.ship_class ?? hull?.ship_class) && <span>{fuel?.ship_class ?? hull?.ship_class}</span>}
                  {m.cargo && m.cargo.length > 0 && (
                    <span>cargo: {m.cargo.map((c) => `${c.name} x${c.quantity}`).join(', ')}</span>
                  )}
                  {!here && <span>not at your POI</span>}
                </div>
                {!isSelf && here && !m.passenger && (hasPump || canRepair) && (
                  <div className={styles.row}>
                    {hasPump && (
                      <>
                        <input
                          className={`${shared.textInput} ${styles.numInput}`}
                          inputMode="numeric"
                          placeholder="max"
                          value={qty[`refuel:${m.username}`] ?? ''}
                          onChange={(e) => setQty({ ...qty, [`refuel:${m.username}`]: e.target.value })}
                          aria-label={`Fuel to transfer to ${m.username}`}
                        />
                        <button className={shared.actionBtn} disabled={busy} onClick={() => sendSupport('refuel', m.username)} type="button">
                          <Fuel size={12} /> Refuel
                        </button>
                      </>
                    )}
                    {canRepair && (
                      <>
                        <input
                          className={`${shared.textInput} ${styles.numInput}`}
                          inputMode="numeric"
                          placeholder="1 kit"
                          value={qty[`repair:${m.username}`] ?? ''}
                          onChange={(e) => setQty({ ...qty, [`repair:${m.username}`]: e.target.value })}
                          aria-label={`Repair kits to use on ${m.username}`}
                        />
                        <button className={shared.actionBtn} disabled={busy} onClick={() => sendSupport('repair', m.username)} type="button">
                          <Wrench size={12} /> Repair
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {fs.is_leader && (fs.invites?.length ?? 0) > 0 && (
            <div className={styles.meta}>Invited: {fs.invites?.map((i) => i.username).join(', ')}</div>
          )}

          {fs.is_leader && (
            <div className={styles.row}>
              <select
                className={`${shared.selectInput} ${styles.grow}`}
                value={invitable.some((p) => p.username === inviteName) ? inviteName : ''}
                onChange={(e) => setInviteName(e.target.value)}
                disabled={busy || invitable.length === 0}
                aria-label="Invite a nearby player"
              >
                <option value="">{invitable.length ? 'Invite nearby player...' : 'No players nearby'}</option>
                {invitable.map((p) => (
                  <option key={p.player_id} value={p.username}>
                    {p.username}
                    {p.ship_class ? ` (${getShip(p.ship_class)?.name ?? p.ship_class})` : ''}
                  </option>
                ))}
              </select>
              <input
                className={`${shared.textInput} ${styles.grow}`}
                placeholder="or player name"
                aria-label="Player name to invite"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
              <button
                className={shared.accentBtn}
                disabled={busy || !inviteName.trim()}
                onClick={() => invite(inviteName.trim())}
                type="button"
              >
                <UserPlus size={12} /> Invite
              </button>
            </div>
          )}

          <div className={styles.row}>
            {fs.is_leader ? (
              confirm === 'disband' ? (
                <ConfirmAction
                  message="Disband the fleet for every member?"
                  onConfirm={() => act((c) => c.spacemolt_fleet.disband(), 'fleet_disband')}
                  onCancel={() => setConfirm(null)}
                  confirmDisabled={busy}
                  confirmLabel="Disband"
                />
              ) : (
                <button className={shared.dangerBtn} disabled={busy} onClick={() => setConfirm('disband')} type="button">
                  <X size={12} /> Disband
                </button>
              )
            ) : isPassenger ? (
              <button
                className={shared.actionBtn}
                disabled={busy || !docked}
                title={docked ? undefined : 'Wait for the carrier to dock'}
                onClick={() => act((c) => c.spacemolt_fleet.disembark(), 'fleet_disembark')}
                type="button"
              >
                <LogOut size={12} /> Disembark
              </button>
            ) : (
              <button
                className={shared.subtleBtn}
                disabled={busy || Boolean(location?.in_transit)}
                onClick={() => act((c) => c.spacemolt_fleet.leave(), 'fleet_leave')}
                type="button"
              >
                <LogOut size={12} /> Leave fleet
              </button>
            )}
          </div>
          {isPassenger && (
            <div className={styles.hint}>
              You ride as a passenger and have no ship of your own. Disembarking leaves you docked here with no ship.
            </div>
          )}
        </div>
      )}

      {/* Boarding needs you docked, in a faction, outside a fleet, beside a docked faction-mate. */}
      {docked && !inFleet && carriers.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Armchair size={14} /> Ride with a faction-mate
          </div>
          <div className={styles.hint}>
            Board a docked faction-mate&apos;s ship as a free passenger (deadheading). Your ship stays parked here, or goes to
            the faction garage. A fleet is created with the carrier as leader if needed.
          </div>
          <label className={styles.row}>
            <input type="checkbox" checked={boardGarage} onChange={(e) => setBoardGarage(e.target.checked)} />
            <span className={styles.hint}>Stow my ship in the faction garage</span>
          </label>
          {carriers.map((p) => (
            <div key={p.player_id} className={shared.listCard}>
              <span className={shared.listCardName}>
                {p.username}
                {p.ship_class ? ` (${getShip(p.ship_class)?.name ?? p.ship_class})` : ''}
              </span>
              <button
                className={shared.actionBtn}
                disabled={busy}
                onClick={() =>
                  act(
                    (c) => c.spacemolt_fleet.board({ id: p.player_id, garage: boardGarage }),
                    'fleet_board',
                  )
                }
                type="button"
              >
                Board
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
