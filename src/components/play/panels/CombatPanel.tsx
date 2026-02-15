'use client'

import { useState, useCallback } from 'react'
import {
  Swords,
  Search,
  Eye,
  EyeOff,
  Skull,
  Shield,
  RefreshCw,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import styles from './CombatPanel.module.css'

export function CombatPanel() {
  const { state, sendCommand } = useGame()
  const [confirmSelfDestruct, setConfirmSelfDestruct] = useState(false)

  const handleAttack = useCallback(
    (playerId: string) => {
      sendCommand('attack', { target_id: playerId })
    },
    [sendCommand]
  )

  const handleScan = useCallback(
    (playerId: string) => {
      sendCommand('scan', { target_id: playerId })
    },
    [sendCommand]
  )

  const handleCloak = useCallback(() => {
    sendCommand('cloak', { enable: !state.player?.is_cloaked })
  }, [sendCommand, state.player?.is_cloaked])

  const handleSelfDestruct = useCallback(() => {
    sendCommand('self_destruct')
    setConfirmSelfDestruct(false)
  }, [sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('get_nearby')
  }, [sendCommand])

  const isCloaked = state.player?.is_cloaked ?? false
  const nearby = state.nearby || []

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Swords size={16} />
            </span>
            Combat
          </div>
          {state.inCombat && (
            <span className={styles.combatBadge}>In Combat</span>
          )}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          title="Refresh nearby"
          type="button"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={styles.content}>
        {/* Controls */}
        <div className={styles.controlsRow}>
          <button
            className={`${styles.cloakBtn} ${
              isCloaked ? styles.cloakActive : ''
            }`}
            onClick={handleCloak}
            title={isCloaked ? 'Disable cloak' : 'Enable cloak'}
            type="button"
          >
            {isCloaked ? <EyeOff size={14} /> : <Eye size={14} />}
            {isCloaked ? 'Cloaked' : 'Cloak'}
          </button>

          <button
            className={styles.selfDestructBtn}
            onClick={() => setConfirmSelfDestruct(true)}
            title="Self-destruct"
            type="button"
          >
            <Skull size={14} />
            Self-Destruct
          </button>
        </div>

        {/* Nearby players */}
        <div>
          <div className={styles.sectionTitle}>
            Nearby ({nearby.length})
          </div>
          {nearby.length > 0 ? (
            <div className={styles.playerList}>
              {nearby.map((player) => {
                const displayName = player.is_anonymous
                  ? 'Unknown Vessel'
                  : player.username || 'Unknown'

                return (
                  <div key={player.player_id} className={styles.playerCard}>
                    <div className={styles.playerInfo}>
                      <div className={styles.playerNameRow}>
                        <span
                          className={`${styles.playerName} ${
                            player.is_anonymous ? styles.anonymousName : ''
                          }`}
                          style={
                            player.primary_color
                              ? { color: player.primary_color }
                              : undefined
                          }
                        >
                          {displayName}
                        </span>
                        {player.clan_tag && (
                          <span className={styles.clanTag}>
                            [{player.clan_tag}]
                          </span>
                        )}
                        {player.is_npc && (
                          <span className={styles.npcTag}>
                            {player.npc_type || 'NPC'}
                          </span>
                        )}
                      </div>
                      {player.ship_class && (
                        <span className={styles.playerShip}>
                          <Shield size={10} /> {player.ship_class}
                        </span>
                      )}
                    </div>

                    <div className={styles.playerActions}>
                      <button
                        className={styles.scanBtn}
                        onClick={() => handleScan(player.player_id)}
                        title={`Scan ${displayName}`}
                        type="button"
                      >
                        <Search size={14} />
                      </button>
                      {!player.is_npc && (
                        <button
                          className={styles.attackBtn}
                          onClick={() => handleAttack(player.player_id)}
                          title={`Attack ${displayName}`}
                          type="button"
                        >
                          <Swords size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              No other vessels detected at this location
            </div>
          )}
        </div>
      </div>

      {/* Self-destruct confirmation modal */}
      {confirmSelfDestruct && (
        <div
          className={styles.confirmOverlay}
          onClick={() => setConfirmSelfDestruct(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.confirmDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmTitle}>
              <Skull size={18} /> Confirm Self-Destruct
            </div>
            <div className={styles.confirmText}>
              This will destroy your ship and all cargo. You will respawn at your
              home base. This action cannot be undone.
            </div>
            <div className={styles.confirmActions}>
              <button
                className={styles.cloakBtn}
                onClick={() => setConfirmSelfDestruct(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.selfDestructBtn}
                onClick={handleSelfDestruct}
                type="button"
              >
                <Skull size={14} />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
