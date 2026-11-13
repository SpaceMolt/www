'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import type { FacilityResponse } from '@spacemolt/lib'
import type { Facility } from '../../types'
import { useAccountStore } from '@/lib/spacemolt'
import { shared } from '../../shared'
import { BugReportButton } from '../../BugReportButton'
import { buildFacilityContext } from '../../bugReportContext'
import { formatNumber, titleCase as formatLabel } from '@/lib/format'
import {
  extractMaintenanceInputs,
  type MaintenanceInput,
} from './maintenanceTypes'
import { buildStatus } from './facilityActions'
import styles from './facilities.module.css'

// `{ type_id: unknown }` uniquely identifies the single-facility-type detail
// variant within the FacilityResponse union (see UpgradeModal.tsx — Extract
// requires the discriminator field to be REQUIRED, not `?`, on that member).
type FacilityTypeDetail = Extract<FacilityResponse, { type_id: unknown }>

const CATEGORY_BADGE: Record<string, string> = {
  service: shared.badgeGreen,
  infrastructure: shared.badgeGrey,
  production: shared.badgeOrange,
  faction: shared.badgePurple,
  personal: shared.badgeCyan,
  defense: shared.badgeRed,
  ranch: shared.badgeGreen,
}

interface FacilityCardProps {
  facility: Facility
  children?: ReactNode
}

type MaintenanceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; inputs: MaintenanceInput[] }
  | { status: 'error' }

export function FacilityCard({ facility, children }: FacilityCardProps) {
  const store = useAccountStore()
  const serviceLabel = facility.service || facility.personal_service || facility.faction_service
  const production = facility.production

  const [expanded, setExpanded] = useState(false)
  const [maintenance, setMaintenance] = useState<MaintenanceState>({ status: 'idle' })

  const handleToggleMaintenance = useCallback(async () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (maintenance.status === 'loaded' || maintenance.status === 'loading') return
    setMaintenance({ status: 'loading' })
    try {
      // Mirrors BuildView's facility-type detail fetch — same endpoint, same
      // params shape — so we benefit from the same caching / response shape.
      const resp = await store.account.commands.spacemolt_facility.types({ facility_type: facility.type })
      const detail = resp.structuredContent as FacilityTypeDetail | undefined
      setMaintenance({
        status: 'loaded',
        inputs: extractMaintenanceInputs(detail),
      })
    } catch {
      setMaintenance({ status: 'error' })
    }
  }, [store, expanded, facility.type, maintenance.status])

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={`${styles.statusDot} ${facility.under_construction ? styles.statusInactive : styles.statusActive}`} />
        <span className={styles.cardName} title={facility.custom_name ? facility.name : undefined}>{facility.custom_name || facility.name}</span>
        <span className={CATEGORY_BADGE[facility.category] || shared.badgeGrey}>
          {formatLabel(facility.category)}
        </span>
        {facility.dismantling && <span className={shared.badgeRed}>Dismantling</span>}
        {facility.damaged && <span className={shared.badgeRed}>{facility.repair_complete_tick ? 'Repairing' : 'Damaged'}</span>}
        {serviceLabel && (
          <span className={shared.badgeGrey}>
            {formatLabel(serviceLabel)}
          </span>
        )}
        <BugReportButton contextType="facility" entityName={facility.name} entityContext={buildFacilityContext(facility)} />
      </div>

      <div className={styles.cardDescription}>{facility.description}</div>

      {(facility.under_construction || facility.maintenance_satisfied === false || facility.bonus_type || facility.recipe_id) && (
        <div className={styles.cardMeta}>
          {facility.under_construction && (
            <span className={`${styles.metaItem} ${styles.maintenanceWarning}`}>
              <AlertTriangle size={10} /> {buildStatus(facility)}
            </span>
          )}
          {facility.maintenance_satisfied === false && (
            <button
              type="button"
              className={`${styles.metaItem} ${styles.maintenanceWarning} ${styles.maintenanceToggle}`}
              onClick={handleToggleMaintenance}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide maintenance requirements' : 'Show maintenance requirements'}
            >
              <AlertTriangle size={10} /> Maintenance needed
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
          )}
          {facility.bonus_type && facility.bonus_value != null && (
            <span className={styles.metaItem}>
              Bonus: {formatLabel(facility.bonus_type)} +{facility.bonus_value}
            </span>
          )}
          {facility.recipe_id && (
            <span className={styles.metaItem}>
              Recipe: {formatLabel(facility.recipe_id)}
            </span>
          )}
        </div>
      )}

      {production && (
        <div className={styles.cardMeta}>
          <span className={styles.metaItem}>
            {production.queued_runs > 0
              ? `Queue: ${production.queued_runs} run${production.queued_runs === 1 ? '' : 's'} (~${production.backlog_ticks} ticks)`
              : 'Queue: empty'}
          </span>
          <span className={styles.metaItem}>
            {production.public ? `Public — ${(production.rental_fee_per_run ?? 0).toLocaleString()} cr/run` : 'Private'}
          </span>
        </div>
      )}

      {!facility.maintenance_satisfied && expanded && (
        <div className={styles.maintenanceDetail} role="region" aria-label="Maintenance requirements">
          {maintenance.status === 'loading' && (
            <span className={styles.maintenanceDetailMuted}>
              <Loader2 size={10} className={shared.spinner} /> Loading requirements...
            </span>
          )}
          {maintenance.status === 'error' && (
            <span className={styles.maintenanceDetailMuted}>
              Could not load maintenance requirements.
            </span>
          )}
          {maintenance.status === 'loaded' && maintenance.inputs.length === 0 && (
            <span className={styles.maintenanceDetailMuted}>
              No upkeep items are listed for this facility type. The facility may need rent or labor instead.
            </span>
          )}
          {maintenance.status === 'loaded' && maintenance.inputs.length > 0 && (
            <>
              {/* Only tourism venues (and servers before the average-draw field) send no averages: they must hold the listed stock. */}
              <span className={styles.maintenanceDetailLabel}>
                {maintenance.inputs.some(i => i.avg != null)
                  ? 'Deposit at least 1 of each item. It restarts at the next facility cycle.'
                  : 'Stock to hold:'}
              </span>
              <ul className={styles.maintenanceDetailList}>
                {maintenance.inputs.map(input => (
                  <li key={input.item_id} className={styles.maintenanceDetailItem} title={`Listed upkeep ${input.quantity}. Storage needs only each cycle's draw.`}>
                    <span>{input.name}</span>
                    {input.avg != null
                      ? <span className={styles.maintenanceDetailMuted}>uses ~{formatNumber(input.avg)} per cycle</span>
                      : <span className={styles.maintenanceDetailQty}>x{input.quantity}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {children && <div className={styles.cardActions}>{children}</div>}
    </div>
  )
}
