'use client'

import { useState } from 'react'
import { Flag, Gavel, Landmark, Send } from 'lucide-react'
import { useAccountStore, useCommandMutation, useCommandQuery, usePlayer } from '@/lib/spacemolt'
import { ConfirmAction, Credits, shared } from '../../shared'
import { EMPIRES } from '../../PlayerSelector'
import styles from '../CrewPanel.module.css'
import { owedBounties } from './crewLogic'
import { useCrewAction } from './useCrewAction'

type EmpireId = 'solarian' | 'voidborn' | 'crimson' | 'nebula' | 'outerrim'

const empireName = (id: string) => EMPIRES.find((e) => e.id === id)?.name ?? id

export function EmpireTab() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const { busy, run } = useCrewAction()
  const [confirm, setConfirm] = useState<string | null>(null)
  const [paySource, setPaySource] = useState<'self' | 'faction'>('self')
  const [petitionTarget, setPetitionTarget] = useState<EmpireId>('solarian')
  const [petitionText, setPetitionText] = useState('')

  const citizenship = useCommandQuery(
    async (account) => (await account.commands.spacemolt_citizenship.list()).structuredContent,
    [],
    { refreshOnSections: ['player'] },
  )
  const data = citizenship.data
  const bounties = owedBounties(player?.standings)
  const credits = player?.credits ?? 0

  const citizenAction = (action: 'apply' | 'renounce' | 'withdraw', target: EmpireId) =>
    run(
      () => mutate((c) => c.spacemolt_citizenship[action]({ target }), { label: `citizenship_${action}` }),
      (r) => r.delta.details?.message ?? `${action} sent to ${empireName(target)}`,
    ).then(() => {
      setConfirm(null)
      citizenship.refetch()
    })

  const pay = (empire: string) =>
    run(
      () => mutate((c) => c.spacemolt.pay_bounty({ id: empire, source: paySource }), { label: 'pay_bounty' }),
      (r) => r.delta.details?.message ?? `Paid ${empireName(empire)}`,
    ).then(() => setConfirm(null))

  const petition = () =>
    run(
      async () => (await store.account.commands.spacemolt_social.petition({ target: petitionTarget, content: petitionText.trim() })).structuredContent,
      (r) => r?.message ?? `Petition sent to ${empireName(petitionTarget)}`,
    ).then((r) => r && setPetitionText(''))

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Landmark size={14} /> Citizenship
        </div>
        <div className={styles.meta}>
          <span>
            Origin <b>{empireName(data?.origin ?? player?.empire ?? '')}</b>
          </span>
          <span>
            Citizen of{' '}
            <b>{(data?.citizenships ?? []).map((c) => empireName(c.empire_id)).join(', ') || 'none (stateless)'}</b>
          </span>
        </div>
        <div className={styles.hint}>Citizenship sets which empires tax you and at what rate. Your origin never changes.</div>
        {citizenship.loading && !data && <div className={shared.emptyState}>Loading citizenships...</div>}
        {citizenship.error && !data && <div className={shared.emptyState}>{citizenship.error}</div>}
        {(data?.empires ?? []).map((e) => {
          const id = e.empire_id as EmpireId
          return (
            <div key={id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <Flag size={12} /> {e.empire_name}
                  {e.is_citizen && <span className={shared.badgeGreen}>Citizen</span>}
                  {e.has_pending && <span className={shared.badgeOrange}>Pending</span>}
                  {e.exclusive && <span className={shared.badgePurple}>Exclusive</span>}
                </div>
                {confirm === `renounce:${id}` ? (
                  <ConfirmAction
                    message={`Renounce ${e.empire_name} citizenship? This is permanent and refunds nothing.`}
                    onConfirm={() => citizenAction('renounce', id)}
                    onCancel={() => setConfirm(null)}
                    confirmDisabled={busy}
                    confirmLabel="Renounce"
                  />
                ) : confirm === `apply:${id}` ? (
                  <ConfirmAction
                    message={`Apply to ${e.empire_name} for a ${e.fee.toLocaleString()} cr fee (refunded on rejection)?${e.exclusive ? ' Exclusive: a grant drops all your other citizenships.' : ''}`}
                    onConfirm={() => citizenAction('apply', id)}
                    onCancel={() => setConfirm(null)}
                    confirmDisabled={busy}
                    variant="accent"
                    confirmLabel="Apply"
                  />
                ) : e.is_citizen ? (
                  <button className={shared.dangerBtn} disabled={busy} onClick={() => setConfirm(`renounce:${id}`)} type="button">
                    Renounce
                  </button>
                ) : e.has_pending ? (
                  <button className={shared.subtleBtn} disabled={busy} onClick={() => citizenAction('withdraw', id)} type="button">
                    Withdraw application
                  </button>
                ) : (
                  <button
                    className={shared.accentBtn}
                    disabled={busy || !e.eligible}
                    title={e.ineligible_reason}
                    onClick={() => setConfirm(`apply:${id}`)}
                    type="button"
                  >
                    Apply
                  </button>
                )}
              </div>
              <div className={styles.meta}>
                <span>
                  fee <b>{e.fee.toLocaleString()} cr</b>
                </span>
                <span>
                  min balance <b>{e.min_balance.toLocaleString()} cr</b>
                </span>
                <span>
                  rep <b>{e.your_reputation}</b>/{e.min_reputation} needed
                </span>
                <span>{e.open ? (e.auto_approve ? 'instant approval' : 'manual review') : 'closed'}</span>
              </div>
              {!e.is_citizen && !e.has_pending && !e.eligible && e.ineligible_reason && <div className={styles.hint}>{e.ineligible_reason}</div>}
            </div>
          )
        })}
        {(data?.recent_decisions ?? []).length > 0 && (
          <div className={styles.meta}>
            Recent decisions:{' '}
            {data?.recent_decisions?.map((d) => `${empireName(d.empire_id)} ${d.decision ?? d.status}`).join(', ')}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Gavel size={14} /> Bounties and missed taxes
        </div>
        {bounties.length === 0 ? (
          <div className={styles.hint}>You owe no empire anything.</div>
        ) : (
          <>
            <div className={styles.hint}>
              Paying clears every crime and unpaid tax with that empire and restores the reputation lost, up to its cap. It works anywhere
              and releases you from detention. All or nothing per empire.
            </div>
            <select
              className={shared.selectInput}
              value={paySource}
              onChange={(e) => setPaySource(e.target.value as typeof paySource)}
              aria-label="Pay from"
            >
              <option value="self">Pay from my wallet</option>
              <option value="faction" disabled={!player?.faction_id}>
                Pay from faction treasury (ManageTreasury)
              </option>
            </select>
            {bounties.map((b) => (
              <div key={b.empire} className={shared.listCard}>
                <span className={shared.listCardName}>
                  {empireName(b.empire)}
                  {b.jailedUntil && <span className={shared.badgeRed}>Detained</span>}
                </span>
                <span className={shared.listCardMeta}>
                  <Credits amount={b.amount} />
                  {confirm === `pay:${b.empire}` ? (
                    <ConfirmAction
                      message={`Pay ${b.amount.toLocaleString()} cr?`}
                      onConfirm={() => pay(b.empire)}
                      onCancel={() => setConfirm(null)}
                      confirmDisabled={busy}
                      variant="accent"
                      confirmLabel="Pay"
                    />
                  ) : (
                    <button
                      className={shared.warningBtn}
                      disabled={busy || (paySource === 'self' && b.amount > credits)}
                      title={paySource === 'self' && b.amount > credits ? 'Not enough credits' : undefined}
                      onClick={() => setConfirm(`pay:${b.empire}`)}
                      type="button"
                    >
                      Pay
                    </button>
                  )}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Send size={14} /> Petition an empire
        </div>
        <div className={styles.hint}>Send a message to an empire&apos;s leadership. One petition per empire per hour.</div>
        <select
          className={shared.selectInput}
          value={petitionTarget}
          onChange={(e) => setPetitionTarget(e.target.value as EmpireId)}
          aria-label="Empire"
        >
          {EMPIRES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <textarea
          className={`${shared.textInput} ${styles.textArea}`}
          placeholder="Your petition..."
          aria-label="Petition text"
          value={petitionText}
          onChange={(e) => setPetitionText(e.target.value)}
        />
        <div className={styles.row}>
          <button className={shared.accentBtn} disabled={busy || !petitionText.trim()} onClick={petition} type="button">
            <Send size={12} /> Send petition
          </button>
        </div>
      </div>
    </div>
  )
}
