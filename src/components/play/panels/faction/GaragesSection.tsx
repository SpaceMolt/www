'use client'

import { useCommandQuery } from '@/lib/spacemolt'
import { Loading, shared } from '../../shared'
import styles from '../FactionPanel.module.css'

/** Every ship parked in the faction's garages, grouped by station. */
export function GaragesSection() {
  const { data, loading, error } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_faction.garages()).structuredContent,
    [],
  )
  if (loading && !data) return <Loading message="Loading garages..." />
  if (error) return <div className={shared.emptyState}>{error}</div>
  if (!data?.stations.length) return <div className={shared.emptyState}>No faction garages yet.</div>

  return (
    <div className={styles.intelList}>
      <div className={styles.intelMeta}>{data.total_ships} ships across {data.station_count} stations</div>
      {data.stations.map((st) => (
        <div key={st.base_id} className={styles.roomContent}>
          <div className={styles.roomContentHeader}>
            <span className={styles.roomContentTitle}>{st.base_name ?? st.base_id}</span>
            <span className={styles.roomContentMeta}>{st.system_name ? `${st.system_name} -- ` : ''}{st.used}/{st.capacity}</span>
          </div>
          {st.ships.map((ship) => (
            <div key={ship.ship_id} className={styles.intelItem}>
              <span className={styles.intelSystemName}>{ship.custom_name || ship.class_name || ship.class_id}</span>
              <span className={styles.intelMeta}>by {ship.depositor_name ?? ship.depositor_id}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
