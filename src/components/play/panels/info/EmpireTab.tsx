'use client'

import { useState } from 'react'
import { Landmark, Coins, Shield } from 'lucide-react'
import { useCommandMutation, useCommandQuery, usePlayer } from '@/lib/spacemolt'
import { formatDuration, titleCase } from '@/lib/format'
import { formatItemId } from '@/data/catalog'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, Credits, Loading, QtyButtons, shared, useAction } from '../../shared'
import styles from '../InfoPanel.module.css'

const pct = (bps: number) => `${bps / 100}%`

/** Tax estimate + prepay, and the live policy snapshot of every empire. */
export function EmpireTab() {
  const player = usePlayer()
  const mutate = useCommandMutation()
  const tax = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_tax_estimate()).structuredContent,
    [],
  )
  const empires = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_empire_info()).structuredContent,
    [],
  )
  const [amount, setAmount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const { busy, run } = useAction()
  const paying = busy !== null
  const quantity = Math.floor(Number(amount))
  const validAmount = quantity > 0

  const prepay = async () => {
    const result = await run(
      'prepay',
      () => mutate((c) => c.spacemolt.prepay_tax({ quantity }), { label: 'prepay_tax' }),
      (r) => r.delta.details?.message ?? `Prepaid ${quantity} cr`,
      'toast',
    )
    if (result) {
      setAmount('')
      tax.refetch()
    }
    setConfirming(false)
  }

  const t = tax.data
  return (
    <div className={styles.tabBody}>
      <div className={shared.sectionTitle}>
        <span className={styles.sectionIcon}><Coins size={12} /></span>
        Tax Estimate
      </div>
      {tax.error && <div className={styles.errorBanner}>{tax.error}</div>}
      {tax.loading && !t && <Loading message="Loading tax estimate..." />}
      {t && (
        <>
          <div className={styles.statsGrid}>
            {[
              ['Income tax', t.income_tax_total],
              ['Property tax', t.property_tax_total],
              ['Prepaid', t.tax_prepaid],
              ['Taxable income', t.taxable_income_to_date],
              ['Property value', t.assessed_property_value],
            ].map(([label, value]) => (
              <div key={label} className={styles.statItem}>
                <span className={styles.statLabel}>{label}</span>
                <span className={styles.statValue}><Credits amount={value as number} /></span>
              </div>
            ))}
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Next assessment</span>
              <span className={styles.statValue}>{formatDuration(t.next_assessment_approx_seconds)}</span>
            </div>
          </div>
          {!t.tax_collection_active && <div className={styles.versionMotd}>Tax collection is in preview: nothing is deducted.</div>}
          {t.inactivity_exempt && <div className={styles.versionMotd}>You are currently exempt for inactivity.</div>}
          {t.outstanding_bounties.length > 0 && (
            <div className={styles.errorBanner}>
              Outstanding: {t.outstanding_bounties.map((b) => `${titleCase(b.empire)} ${b.bounty.toLocaleString()} cr`).join(', ')}
            </div>
          )}
          {t.note && <div className={styles.versionMotd}>{t.note}</div>}
        </>
      )}

      {confirming ? (
        <ConfirmAction
          message={`Prepay ${quantity.toLocaleString()} cr toward your next tax assessment?`}
          variant="accent"
          confirmDisabled={paying}
          onConfirm={prepay}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div className={styles.filterRow}>
          <input
            className={styles.noteInput}
            style={{ flex: 1 }}
            type="number"
            min={1}
            max={player?.credits}
            placeholder="Credits to prepay"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <QtyButtons max={player?.credits ?? 0} current={amount} onChange={setAmount} />
          <ActionButton label="Prepay Tax" icon={<Coins size={12} />} onClick={() => setConfirming(true)} disabled={!validAmount} loading={paying} size="sm" />
        </div>
      )}

      <div className={styles.divider} />
      <div className={shared.sectionTitle}>
        <span className={styles.sectionIcon}><Landmark size={12} /></span>
        Empire Policies
      </div>
      {empires.error && <div className={styles.errorBanner}>{empires.error}</div>}
      {empires.loading && !empires.data && <Loading message="Loading empires..." />}
      {empires.data?.empires.map((e) => (
        <div key={e.empire_id} className={styles.versionCard}>
          <div className={styles.versionNumber}><Shield size={12} /> {titleCase(e.empire_id)}</div>
          <div className={styles.versionDate}>
            Income {pct(e.income_tax_bps)} - Property {pct(e.property_tax_bps)} - Sales {pct(e.sales_tax_bps)} - Listing {pct(e.listing_fee_bps)}
          </div>
          <div className={styles.versionDate}>
            Fuel tax {e.fuel_tax_per_unit} cr/unit - Repair {e.repair_cost_per_hull} cr/hull - Jail {e.jail_duration_hours}h
          </div>
          <div className={styles.versionDate}>
            Citizenship {e.citizenship_open ? 'open' : 'closed'}, fee <Credits amount={e.citizenship_fee} />, min rep {e.citizenship_min_reputation}
          </div>
          {e.contraband_items.length > 0 && (
            <div className={styles.versionDate}>Contraband: {e.contraband_items.map(formatItemId).join(', ')}</div>
          )}
        </div>
      ))}
    </div>
  )
}
