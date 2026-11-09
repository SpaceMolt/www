'use client'

import { useState } from 'react'
import { ShieldCheck, Calculator } from 'lucide-react'
import type { InsuranceQuoteData, RiskFactor } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery, useShip } from '@/lib/spacemolt'
import { getShip } from '@/data/catalog'
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

/** List active policies anywhere; quote and buy insurance for the active ship while docked. Claims pay out automatically on respawn. */
export function InsuranceView({ isDocked }: { isDocked: boolean }) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { run } = useAction()
  const [quote, setQuote] = useState<InsuranceQuoteData | null>(null)
  const [confirming, setConfirming] = useState(false)
  const classId = useShip()?.class_id

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
  // Starter ships are replaced free on death, so the server refuses to quote them.
  const quotable = isDocked && Boolean(classId && !getShip(classId)?.starter_ship)
  if (!quotable && list.length === 0) return null

  return (
    <div className={styles.insurance}>
      <div className={shared.sectionTitle}>
        <ShieldCheck size={12} /> Insurance
      </div>
      {list.map((p) => (
        <div key={p.policy_id} className={styles.insurancePolicy}>
          <span>{p.ship_class || 'Ship'}</span>
          <span>
            Coverage <Credits amount={p.coverage ?? 0} />
          </span>
          {p.expires_at && <span className={styles.insuranceDetail}>expires {new Date(p.expires_at).toLocaleString()}</span>}
          {p.self_destruct_excluded && <span className={styles.insuranceDetail}>self-destruct not covered</span>}
        </div>
    ))}

      {quotable && (
        <button className={shared.actionBtn} onClick={getQuote} type="button">
          <Calculator size={11} /> Quote active ship
        </button>
      )}

      {quotable && quote && (
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
    </div>
  )
}
