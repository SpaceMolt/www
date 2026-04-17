'use client'

import { useEffect, useCallback } from 'react'
import {
  Ship,
  RefreshCw,
  Heart,
  Fuel,
  Package,
  Wrench as WrenchIcon,
  MapPin,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Loading, Panel, shared } from '../../shared'
import type { FleetShip } from '../../types'
import styles from './FleetView.module.css'

export function FleetView() {
  const { state, sendCommand } = useGame()
  const fleet = state.fleetData
  const isDocked = state.isDocked
  const currentBaseId = state.poi?.base_id

  // Auto-fetch on mount or when fleetData is cleared
  useEffect(() => {
    if (!fleet) {
      sendCommand('list_ships')
    }
  }, [fleet, sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('list_ships')
  }, [sendCommand])

  const handleSwitch = useCallback(
    (shipId: string) => {
      sendCommand('switch_ship', { ship_id: shipId }).then(() => {
        sendCommand('get_status')
        sendCommand('list_ships')
      })
    },
    [sendCommand]
  )

  const handleSell = useCallback(
    (shipId: string) => {
      sendCommand('sell_ship', { ship_id: shipId })
    },
    [sendCommand]
  )

  const refreshButton = (
    <button
      className={shared.refreshBtn}
      onClick={handleRefresh}
      title="Refresh fleet"
      type="button"
    >
      <RefreshCw size={14} />
    </button>
  )

  return (
    <Panel title="Fleet" icon={<Ship size={16} />} headerRight={refreshButton}>
        {!fleet ? (
          <Loading message="Loading fleet data..." />
        ) : fleet.ships.length === 0 ? (
          <div className={shared.emptyState}>You have no ships</div>
        ) : (
          <>
            {/* Summary */}
            <div className={styles.summary}>
              <span className={styles.summaryLabel}>Ships Owned</span>
              <span className={styles.summaryValue}>{fleet.count}</span>
            </div>
            {fleet.active_ship_class && (
              <div className={styles.summary}>
                <span className={styles.summaryLabel}>Active Ship</span>
                <span className={styles.summaryActiveShip}>
                  {fleet.active_ship_class}
                </span>
              </div>
            )}

            {/* Ship list */}
            <div className={styles.fleetList}>
              {fleet.ships.map((ship) => (
                <FleetCard
                  key={ship.ship_id}
                  ship={ship}
                  isDocked={isDocked}
                  currentBaseId={currentBaseId}
                  onSwitch={handleSwitch}
                  onSell={handleSell}
                />
              ))}
            </div>
          </>
        )}
    </Panel>
  )
}

interface FleetCardProps {
  ship: FleetShip
  isDocked: boolean
  currentBaseId?: string
  onSwitch: (shipId: string) => void
  onSell: (shipId: string) => void
}

function FleetCard({
  ship,
  isDocked,
  currentBaseId,
  onSwitch,
  onSell,
}: FleetCardProps) {
  const isAtCurrentBase =
    isDocked && currentBaseId && ship.location_base_id === currentBaseId
  const canManage = !ship.is_active && isAtCurrentBase

  const cardClass = ship.is_active ? styles.fleetCardActive : styles.fleetCard

  return (
    <div className={cardClass}>
      <div className={styles.fleetCardTop}>
        <div className={styles.fleetCardInfo}>
          <img
            src={`/images/ships/catalog/${(ship.class_name || ship.class_id).toLowerCase().replace(/\s+/g, '_')}.webp`}
            alt={ship.class_name || ship.class_id}
            className={styles.shipImage}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span className={styles.fleetCardName}>
            {ship.class_name || ship.class_id}
          </span>
          {ship.is_active && (
            <span className={styles.activeIndicator}>Active</span>
          )}
        </div>
        <div className={styles.fleetCardActions}>
          {canManage && (
            <>
              <button
                className={shared.actionBtn}
                onClick={() => onSwitch(ship.ship_id)}
                title="Switch to this ship"
                type="button"
              >
                <ArrowRightLeft size={11} />
                Switch
              </button>
              <button
                className={shared.dangerBtn}
                onClick={() => onSell(ship.ship_id)}
                title="Sell this ship"
                type="button"
              >
                <Trash2 size={11} />
                Sell
              </button>
            </>
          )}
        </div>
      </div>

      {/* Ship meta */}
      <div className={styles.fleetCardMeta}>
        <div className={styles.fleetMeta}>
          <span className={styles.fleetMetaIcon}><Heart size={10} /></span>
          <span className={styles.fleetMetaLabel}>Hull</span>
          <span className={styles.fleetMetaValue}>{ship.hull}</span>
        </div>
        <div className={styles.fleetMeta}>
          <span className={styles.fleetMetaIcon}><Fuel size={10} /></span>
          <span className={styles.fleetMetaLabel}>Fuel</span>
          <span className={styles.fleetMetaValue}>{ship.fuel}</span>
        </div>
        <div className={styles.fleetMeta}>
          <span className={styles.fleetMetaIcon}><WrenchIcon size={10} /></span>
          <span className={styles.fleetMetaLabel}>Mods</span>
          <span className={styles.fleetMetaValue}>{ship.modules}</span>
        </div>
        <div className={styles.fleetMeta}>
          <span className={styles.fleetMetaIcon}><Package size={10} /></span>
          <span className={styles.fleetMetaLabel}>Cargo</span>
          <span className={styles.fleetMetaValue}>{ship.cargo_used}</span>
        </div>
      </div>

      {/* Location */}
      <div className={styles.fleetMeta}>
        <span className={styles.fleetLocationIcon}><MapPin size={10} /></span>
        <span className={styles.fleetLocation}>{ship.location}</span>
      </div>
    </div>
  )
}
