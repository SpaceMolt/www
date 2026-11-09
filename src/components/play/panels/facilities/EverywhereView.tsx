'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { FacilityRentSummary, OwnedFacilityEntry } from '@spacemolt/lib'
import { useCommandQuery, usePlayer } from '@/lib/spacemolt'
import { Credits, Loading, shared } from '../../shared'
import { facilityWarnings } from './facilityActions'
import styles from './facilities.module.css'

function RentLine({ rent }: { rent: FacilityRentSummary }) {
  return (
    <div className={styles.cardMeta}>
      <span className={styles.metaItem}>{rent.facilities} facilities</span>
      <span className={styles.metaItem}>Rent <Credits amount={rent.total_rent_per_cycle} />/cycle (~<Credits amount={rent.est_rent_per_day} />/day)</span>
      {(rent.arrears_owed ?? 0) > 0 && (
        <span className={`${styles.metaItem} ${styles.maintenanceWarning}`}>
          <AlertTriangle size={10} /> Owed <Credits amount={rent.arrears_owed ?? 0} />
        </span>
      )}
      {rent.note && <span className={styles.metaItem}>{rent.note}</span>}
    </div>
  )
}

function FacilityRows({ title, facilities, rent }: { title: string; facilities: OwnedFacilityEntry[]; rent: FacilityRentSummary }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        {title}
        <span className={styles.sectionCount}>({facilities.length})</span>
      </div>
      <RentLine rent={rent} />
      {facilities.length === 0 && <div className={shared.emptyState}>None.</div>}
      {facilities.map((f) => (
        <div key={f.facility_id} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardName}>{f.custom_name || f.name}</span>
            <span className={shared.badgeGrey}>{f.base_name}</span>
            {facilityWarnings(f).map((w) => <span key={w} className={shared.badgeRed}>{w}</span>)}
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.metaItem}>Rent <Credits amount={f.rent_per_cycle} />/cycle</span>
            {(f.arrears_owed ?? 0) > 0 && <span className={styles.metaItem}>Owed <Credits amount={f.arrears_owed ?? 0} /></span>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Every facility the player and their faction own, at every station. Works undocked. */
export function EverywhereView() {
  const hasFaction = Boolean(usePlayer()?.faction_id)
  const { data: owned, loading, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.owned()).structuredContent,
    [],
  )
  const { data: factionOwned, refetch: refetchFaction } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.faction_owned()).structuredContent,
    [hasFaction],
    { enabled: hasFaction },
  )

  if (loading && !owned) return <Loading message="Loading your facilities..." />

  return (
    <>
      <div className={styles.cardActions}>
        <button className={shared.subtleBtn} onClick={() => { refetch(); if (hasFaction) refetchFaction() }} type="button">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {owned && <FacilityRows title="Your facilities, all stations" facilities={owned.facilities} rent={owned.rent} />}
      {factionOwned && <FacilityRows title="Faction facilities, all stations" facilities={factionOwned.facilities} rent={factionOwned.faction_rent} />}
    </>
  )
}
