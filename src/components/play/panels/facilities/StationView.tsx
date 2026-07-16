'use client'

import { useMemo } from 'react'
import type { FacilityListResponse } from '../../types'
import { shared } from '../../shared'
import { FacilityCard } from './FacilityCard'
import styles from './facilities.module.css'

interface StationViewProps {
  facilityData: FacilityListResponse
}

const CATEGORY_ORDER = ['service', 'infrastructure']

export function StationView({ facilityData }: StationViewProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, typeof facilityData.station_facilities> = {}
    for (const f of facilityData.station_facilities) {
      const cat = f.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(f)
    }
    // Sort categories: known order first, then alphabetical
    const keys = Object.keys(groups).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a)
      const bi = CATEGORY_ORDER.indexOf(b)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.localeCompare(b)
    })
    return keys.map(cat => ({ category: cat, facilities: groups[cat] }))
  }, [facilityData.station_facilities])

  if (grouped.length === 0) {
    return <div className={shared.emptyState}>No station facilities at this base.</div>
  }

  return (
    <>
      {grouped.map(({ category, facilities }) => (
        <div key={category} className={styles.section}>
          <div className={styles.sectionHeader}>
            {category.replace(/_/g, ' ')}
            <span className={styles.sectionCount}>({facilities.length})</span>
          </div>
          {facilities.map(f => (
            <FacilityCard key={f.facility_id} facility={f} />
          ))}
        </div>
      ))}
    </>
  )
}
