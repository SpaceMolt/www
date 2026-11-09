'use client'

import { useState } from 'react'
import { ShieldCheck, Calculator } from 'lucide-react'
import type { InsuranceQuoteData, RiskFactor } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery } from '@/lib/spacemolt'
import { ConfirmAction, Credits, shared, useAction } from '../../shared'
import styles from './FleetView.module.css'

function Factors({ factors }: { factors?: RiskFactor[] }) {
  if (!factors?.length) return null
  return (
    <ul className={styles.insuranceFactors}>
      {factors.map((f) => (
        <li key={f.name}>
          {f.name} x{f.multiplier.toFixed(2)}
          {f.detail && <span className={styles.insuranceDetail}> · {f.detail}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Quote and buy insurance for the active ship; list active policies. Claims pay out automatically on respawn. */
export function InsuranceView({ isDocked }: { isDocked: boolean }) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { run } = useAction()
  const [quote, setQuote] = useState<InsuranceQuoteData | null>(null)
  const [confirming, setConfirming] = useState(false)

  const { data: policies, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_salvage.policies()).structuredContent,
    [],
    { refreshOnSections: ['ship'] },
  )

  const getQuote = () =>
    run('quote', async () => setQuote((await store.account.commands.spacemolt_salvage.quote()).structuredContent?.quote ?? null))

  const buy = async () => {
    setConfirming(false)
    const r = await run(
      'buy',
      () => mutate((c) => c.spacemolt_salvage.insure(), { label: 'buy_insurance' }),
      (r) => r.delta.details?.message || 'Insurance purchased',
    )
    if (!r) return
    setQuote(null)
    refetch()
  }

  const list = policies?.policies ?? []

  return (
    <div className={styles.insurance}>
      <div className={shared.sectionTitle}>
        <ShieldCheck size={12} /> Insurance
      </div>
      {list.length === 0 ? (
        <div className={styles.insuranceDetail}>No active policies.</div>
      ) : (
        list.map((p) => (
          <div key={p.policy_id} className={styles.insurancePolicy}>
            <span>{p.ship_class || 'Ship'}</span>
            <span>
              Coverage <Credits amount={p.coverage ?? 0} />
            </span>
            {p.expires_at && <span className={styles.insuranceDetail}>expires {new Date(p.expires_at).toLocaleString()}</span>}
            {p.self_destruct_excluded && <span className={styles.insuranceDetail}>self-destruct not covered</span>}
          </div>
        ))
      )}

      {isDocked ? (
        <button className={shared.actionBtn} onClick={getQuote} type="button">
          <Calculator size={11} /> Quote active ship
        </button>
      ) : (
        <div className={styles.insuranceDetail}>Dock at a station to get a quote and buy a policy.</div>
      )}

      {isDocked && quote && (
        <div className={styles.insuranceQuote}>
          {quote.refused ? (
            <div>The insurer refuses to cover this ship (risk score {quote.risk_score}).</div>
          ) : (
            <div>
              Premium <Credits amount={quote.premium ?? 0} /> · coverage <Credits amount={quote.coverage ?? 0} />
              {quote.expires_in && ` · lasts ${quote.expires_in}`} · risk {quote.risk_score}
            </div>
          )}
          <Factors factors={quote.factors} />
          {!quote.refused &&
            (confirming ? (
              <ConfirmAction
                message={`Pay ${(quote.premium ?? 0).toLocaleString()} cr for this policy?`}
                variant="confirm"
                onConfirm={buy}
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <button className={shared.confirmBtn} onClick={() => setConfirming(true)} type="button">
                Buy policy
              </button>
            ))}
        </div>
      )}
      <div className={styles.insuranceDetail}>A policy pays out automatically if this ship is destroyed.</div>
    </div>
  )
}
