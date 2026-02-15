'use client'

import { useGame } from './GameProvider'
import { Coins, Globe, MapPin, Wifi, WifiOff, Clock } from 'lucide-react'
import styles from './PlayerInfo.module.css'

export function PlayerInfo() {
  const { state } = useGame()
  const player = state.player
  const connected = state.connected

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
        <div className={styles.tickDisplay}>
          <Clock size={11} className={styles.tickIcon} />
          <span className={styles.tickValue}>{state.currentTick}</span>
        </div>
      </div>

      {player ? (
        <div className={styles.info}>
          <div className={styles.username}>{player.username}</div>
          <div className={styles.details}>
            <div className={styles.detailItem}>
              <Coins size={12} className={styles.creditsIcon} />
              <span className={styles.creditsValue}>
                {player.credits.toLocaleString()}
              </span>
            </div>
            {player.empire && (
              <div className={styles.detailItem}>
                <Globe size={12} className={styles.empireIcon} />
                <span className={styles.detailValue}>{player.empire}</span>
              </div>
            )}
            {state.system && (
              <div className={styles.detailItem}>
                <MapPin size={12} className={styles.systemIcon} />
                <span className={styles.detailValue}>{state.system.name}</span>
              </div>
            )}
            {state.poi && (
              <div className={styles.detailItem}>
                <MapPin size={11} className={styles.poiIcon} />
                <span className={styles.detailValueSmall}>{state.poi.name}</span>
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
