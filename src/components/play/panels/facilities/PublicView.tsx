'use client'

import type { FacilityListResponse } from '../../types'
import { shared } from '../../shared'
import { FacilityCard } from './FacilityCard'
import styles from './facilities.module.css'

interface PublicViewProps {
  facilityData: FacilityListResponse
}

export function PublicView({ facilityData }: PublicViewProps) {
  const publicFacilities = facilityData.public_facilities ?? []

  if (publicFacilities.length === 0) {
    return (
      <div className={shared.emptyState}>
        No other players have opened a facility for rent at this station.
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        Public Facilities
        <span className={styles.sectionCount}>({publicFacilities.length})</span>
      </div>
      {publicFacilities.map(f => (
        <FacilityCard key={f.facility_id} facility={f} />
      ))}
    </div>
  )
}
