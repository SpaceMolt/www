'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Facility } from '@/lib/gameTypes'
import { shared } from '../../shared'
import { BugReportButton } from '../../BugReportButton'
import { buildFacilityContext } from '../../bugReportContext'
import styles from './facilities.module.css'

const CATEGORY_BADGE: Record<string, string> = {
  service: shared.badgeGreen,
  infrastructure: shared.badgeGrey,
  production: shared.badgeOrange,
  faction: shared.badgePurple,
  personal: shared.badgeCyan,
}

/** Convert snake_case to Title Case */
export function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface FacilityCardProps {
  facility: Facility
  children?: ReactNode
}

export function FacilityCard({ facility, children }: FacilityCardProps) {
  const serviceLabel = facility.service || facility.personal_service || facility.faction_service

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={`${styles.statusDot} ${facility.active ? styles.statusActive : styles.statusInactive}`} />
        <span className={styles.cardName}>{facility.name}</span>
        <span className={CATEGORY_BADGE[facility.category] || shared.badgeGrey}>
          {formatLabel(facility.category)}
        </span>
        {serviceLabel && (
          <span className={shared.badgeGrey}>
            {formatLabel(serviceLabel)}
          </span>
        )}
        {!facility.yours && facility.owner_id && (
          <span className={facility.faction_id ? shared.badgePurple : shared.badgeCyan}>
            {facility.faction_id ? 'Faction-owned' : 'Player-owned'}
          </span>
        )}
        <BugReportButton contextType="facility" entityName={facility.name} entityContext={buildFacilityContext(facility)} />
      </div>

      <div className={styles.cardDescription}>{facility.description}</div>

      {(!facility.maintenance_satisfied || facility.bonus_type || facility.recipe_id) && (
        <div className={styles.cardMeta}>
          {!facility.maintenance_satisfied && (
            <span className={`${styles.metaItem} ${styles.maintenanceWarning}`}>
              <AlertTriangle size={10} /> Maintenance needed
            </span>
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

      {children && <div className={styles.cardActions}>{children}</div>}
    </div>
  )
}
