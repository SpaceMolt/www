'use client'

import { useState } from 'react'
import { BadgeCheck, Coins } from 'lucide-react'
import type { FactionInfoResponse } from '@spacemolt/lib'
import { useCatalog, useCommandMutation, useCommandQuery } from '@/lib/spacemolt'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, Credits, Loading, QtyButtons, shared, useAction } from '../../shared'
import styles from '../FactionPanel.module.css'
import { LICENSE_COST_BY_TIER } from './factionAdmin'
import { EMPIRES } from '../../PlayerSelector'
import { titleCase } from '@/lib/format'

/** Corporate tax estimate and prepay, plus shipbuilding licenses. Both spend the faction treasury (manage_treasury). */
export function TreasurySection({ info, onChanged }: { info: FactionInfoResponse; onChanged: () => void }) {
  const mutate = useCommandMutation()
  const { data: catalog } = useCatalog()
  const { busy, run } = useAction()
  const [prepay, setPrepay] = useState('')
  const [shipClass, setShipClass] = useState('')
  const [confirm, setConfirm] = useState<'prepay' | 'license' | null>(null)
  const { data: tax, loading, error, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_faction.tax_estimate()).structuredContent,
    [],
  )

  const treasury = info.treasury ?? 0
  const amount = Math.floor(Number(prepay))
  const ship = catalog?.ships.find((s) => s.id === shipClass.trim())
  const licenseCost = ship?.tier ? LICENSE_COST_BY_TIER[ship.tier] : undefined
  const shortForLicense = licenseCost !== undefined && treasury < licenseCost

  const doPrepay = async () => {
    setConfirm(null)
    if (await run('prepay', () => mutate((c) => c.spacemolt_faction.prepay_tax({ amount }), { label: 'faction_prepay_tax' }), `Prepaid ${amount.toLocaleString()} cr of corporate tax`, 'toast')) {
      setPrepay('')
      refetch()
      onChanged()
    }
  }

  const doLicense = async () => {
    setConfirm(null)
    if (await run('license', () => mutate((c) => c.spacemolt_facility.buy_ship_license({ ship_class: shipClass.trim() }), { label: 'buy_ship_license' }), `Licensed ${ship?.name ?? shipClass}`, 'toast')) {
      setShipClass('')
      onChanged()
    }
  }

  return (
    <div className={styles.intelSection}>
      <div className={styles.label}>Corporate Tax</div>
      {loading && !tax && <Loading message="Estimating tax..." />}
      {error && <div className={shared.emptyState}>{error}</div>}
      {tax && (
        <div className={styles.intelStats}>
          <Stat label="Owed now" value={<Credits amount={tax.income_tax_total} />} />
          <Stat label="Prepaid" value={<Credits amount={tax.tax_prepaid} />} />
          <Stat label="Net profit" value={<Credits amount={tax.net_taxable_profit} />} />
          {!!tax.carried_debt_total && <Stat label="Carried debt" value={<Credits amount={tax.carried_debt_total} />} />}
          <Stat label="Next assessment" value={`~${Math.round(tax.next_assessment_approx_seconds / 3600)}h`} />
          <Stat label="Domicile" value={EMPIRES.find((e) => e.id === tax.domicile)?.name ?? titleCase(tax.domicile)} />
          {!tax.tax_collection_active && <div className={styles.intelMeta}>Tax collection is not active.</div>}
          {tax.note && <div className={styles.intelMeta}>{tax.note}</div>}
        </div>
      )}
      {confirm === 'prepay' ? (
        <ConfirmAction message={`Prepay ${amount.toLocaleString()} cr from the treasury?`} onConfirm={doPrepay} onCancel={() => setConfirm(null)} variant="confirm" />
      ) : (
        <div className={styles.inviteRow}>
          <input className={styles.inviteInput} type="number" min={1} placeholder="Prepay amount" value={prepay} onChange={(e) => setPrepay(e.target.value)} />
          <QtyButtons max={treasury} current={prepay} onChange={setPrepay} />
          <ActionButton label="Prepay" icon={<Coins size={12} />} onClick={() => setConfirm('prepay')} disabled={!(amount > 0 && amount <= treasury)} loading={busy === 'prepay'} size="sm" />
        </div>
      )}

      <div className={styles.divider} />
      <div className={styles.label}>Shipbuilding License</div>
      <div className={styles.intelMeta}>
        Lets your faction build one hull design at its own stations (commission with faction funding). Tier cost: T1 1M, T2 5M, T3 10M, T4 20M, T5 50M.
      </div>
      {confirm === 'license' ? (
        <ConfirmAction
          message={`License ${ship?.name ?? shipClass} for ${licenseCost !== undefined ? `${licenseCost.toLocaleString()} cr` : 'its tier cost'}?`}
          onConfirm={doLicense}
          onCancel={() => setConfirm(null)}
          variant="confirm"
        />
      ) : (
        <div className={styles.inviteRow}>
          <input className={styles.inviteInput} list="faction-license-ships" placeholder="Ship class id" value={shipClass} onChange={(e) => setShipClass(e.target.value)} />
          <datalist id="faction-license-ships">
            {catalog?.ships.map((s) => <option key={s.id} value={s.id}>{s.name} (T{s.tier})</option>)}
          </datalist>
          {licenseCost !== undefined && <Credits amount={licenseCost} />}
          <ActionButton label="Buy License" icon={<BadgeCheck size={12} />} onClick={() => setConfirm('license')} disabled={!shipClass.trim() || shortForLicense} loading={busy === 'license'} size="sm" />
        </div>
      )}
      {shortForLicense && confirm !== 'license' && (
        <div className={styles.intelMeta}>The treasury holds {treasury.toLocaleString()} cr; this license costs {licenseCost?.toLocaleString()} cr.</div>
      )}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.intelStatItem}>
      <span className={styles.intelStatLabel}>{label}</span>
      <span className={styles.intelStatValue}>{value}</span>
    </div>
  )
}
