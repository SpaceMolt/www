'use client'

import { useState } from 'react'
import { DoorOpen, Loader2 } from 'lucide-react'
import type { FacilityPersonalVisitResponse } from '@spacemolt/lib'
import { useAccountStore } from '@/lib/spacemolt'
import type { FacilityListResponse } from '../../types'
import { shared, useAction } from '../../shared'
import { FacilityCard } from './FacilityCard'
import styles from './facilities.module.css'

interface PublicViewProps {
  facilityData: FacilityListResponse
}

function VisitQuarters() {
  const store = useAccountStore()
  const [username, setUsername] = useState('')
  const [visit, setVisit] = useState<FacilityPersonalVisitResponse | null>(null)
  const { busy, run } = useAction()
  const loading = busy !== null

  const handleVisit = async () => {
    const resp = await run('visit', () => store.account.commands.spacemolt_facility.personal_visit({ username: username.trim() || undefined }))
    if (resp) setVisit(resp.structuredContent ?? null)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>Visit Quarters</div>
      <div className={styles.searchRow}>
        <input
          className={shared.textInput}
          placeholder="Player name (empty for your own)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleVisit() }}
        />
        <button className={shared.actionBtn} onClick={handleVisit} disabled={loading} type="button">
          {loading ? <Loader2 size={11} className={shared.spinner} /> : <DoorOpen size={11} />} Visit
        </button>
      </div>
      {visit && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardName}>{visit.facility_name}</span>
            <span className={shared.badgeCyan}>{visit.owner}</span>
            {visit.access && <span className={shared.badgeGrey}>{visit.access}</span>}
          </div>
          <div className={styles.cardDescription} style={{ whiteSpace: 'pre-wrap' }}>
            {visit.description || 'The quarters are bare.'}
          </div>
        </div>
      )}
    </div>
  )
}

export function PublicView({ facilityData }: PublicViewProps) {
  const publicFacilities = facilityData.public_facilities ?? []

  return (
    <>
      {publicFacilities.length === 0 ? (
        <div className={shared.emptyState}>
          No other players have opened a facility for rent at this station.
        </div>
      ) : (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            Public Facilities
            <span className={styles.sectionCount}>({publicFacilities.length})</span>
          </div>
          {publicFacilities.map(f => (
            <FacilityCard key={f.facility_id} facility={f} />
          ))}
        </div>
      )}
      <VisitQuarters />
    </>
  )
}
