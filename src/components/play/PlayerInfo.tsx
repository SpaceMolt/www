'use client'

import { useConnectionPhase, useLocationState, usePlayer } from '@/lib/spacemolt'
import { Coins, Globe, MapPin, Wifi, WifiOff } from 'lucide-react'
import styles from './PlayerInfo.module.css'

export function PlayerInfo() {
  const player = usePlayer()
  const location = useLocationState()
  const { phase } = useConnectionPhase()
  const connected = phase === 'ready'

  return (
    <div className={styles.container}>
      <div className={styles.connectionRow}>
        <div className={styles.connectionStatus}>
          {connected ? (
            <Wifi size={12} className={styles.connectedIcon} />
          ) : (
            <WifiOff size={12} className={styles.disconnectedIcon} />
          )}
          <span className={connected ? styles.connectedDot : styles.disconnectedDot} />
        </div>
      </div>

      {player ? (
        <div className={styles.info}>
          <div className={styles.username}>{player.username}</div>
          <div className={styles.details}>
            <div className={styles.detailItem}>
              <Coins size={12} className={styles.creditsIcon} />
              <span className={styles.creditsValue}>
                {(player.credits ?? 0).toLocaleString()}
              </span>
            </div>
            {player.empire && (
              <div className={styles.detailItem}>
                <Globe size={12} className={styles.empireIcon} />
                <span className={styles.detailValue}>{player.empire}</span>
              </div>
            )}
            {location?.system_name && (
              <div className={styles.detailItem}>
                <MapPin size={12} className={styles.systemIcon} />
                <span className={styles.detailValue}>{location.system_name}</span>
              </div>
            )}
            {location?.poi_name && (
              <div className={styles.detailItem}>
                <MapPin size={11} className={styles.poiIcon} />
                <span className={styles.detailValueSmall}>{location.poi_name}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.noPlayer}>Not logged in</div>
      )}
    </div>
  )
}
