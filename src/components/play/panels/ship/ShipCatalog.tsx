'use client'

import { useEffect, useCallback, useMemo } from 'react'
import {
  Layers,
  RefreshCw,
  Coins,
  Heart,
  Shield,
  Gauge,
  Package,
  ShoppingCart,
  Lock,
  Info,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import type { ShowroomShip } from '../../types'
import styles from './ShipCatalog.module.css'

export function ShipCatalog() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const credits = state.player?.credits ?? 0
  const showroom = state.showroomData

  // Auto-fetch when docked and showroom is null
  useEffect(() => {
    if (isDocked && !showroom) {
      sendCommand('shipyard_showroom')
    }
  }, [isDocked, showroom, sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('shipyard_showroom')
  }, [sendCommand])

  const handleBuy = useCallback(
    (shipId: string) => {
      sendCommand('buy_ship', { ship_id: shipId })
    },
    [sendCommand]
  )

  const sortedShips = useMemo(() => {
    if (!showroom?.ships) return []
    return [...showroom.ships].sort((a, b) => a.showroom_price - b.showroom_price)
  }, [showroom])

  if (!isDocked) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Layers size={16} />
            </span>
            Shipyard
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.dockedOnly}>
            <Lock size={16} style={{ marginBottom: '0.25rem', opacity: 0.6 }} />
            <br />
            Dock at a shipyard to browse ships
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Layers size={16} />
          </span>
          Shipyard
          {showroom && (
            <span className={styles.shipyardLevel}>Lv{showroom.shipyard_level}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            title="Refresh showroom"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Credits display */}
        <div className={styles.creditsBar}>
          <span className={styles.creditsIcon}>
            <Coins size={14} />
          </span>
          <span className={styles.creditsLabel}>Credits</span>
          <span className={styles.creditsValue}>
            {credits.toLocaleString()}
          </span>
        </div>

        {!showroom ? (
          <div className={styles.emptyState}>Loading showroom...</div>
        ) : sortedShips.length === 0 ? (
          <div className={styles.emptyState}>
            <Info size={14} style={{ marginBottom: '0.25rem', opacity: 0.6 }} />
            <br />
            {showroom.tip || 'No ships in stock at this shipyard'}
          </div>
        ) : (
          <>
            <span className={styles.countLabel}>
              {showroom.count} ship{showroom.count !== 1 ? 's' : ''} in stock
            </span>
            <div className={styles.shipList}>
              {sortedShips.map((ship) => (
                <ShowroomCard
                  key={ship.ship_id}
                  ship={ship}
                  credits={credits}
                  isDocked={isDocked}
                  onBuy={handleBuy}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface ShowroomCardProps {
  ship: ShowroomShip
  credits: number
  isDocked: boolean
  onBuy: (shipId: string) => void
}

function ShowroomCard({ ship, credits, isDocked, onBuy }: ShowroomCardProps) {
  const canAfford = credits >= ship.showroom_price

  return (
    <div className={styles.shipCard}>
      <div className={styles.shipCardTop}>
        <div className={styles.shipCardInfo}>
          <span className={styles.shipCardName}>{ship.name}</span>
          <span className={styles.shipCardClass}>{ship.category}</span>
        </div>
        <span className={canAfford ? styles.shipCardPrice : styles.shipCardPriceUnaffordable}>
          {ship.showroom_price.toLocaleString()} cr
        </span>
      </div>

      {/* Key stats */}
      <div className={styles.shipStatsRow}>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Heart size={10} /></span>
          <span className={styles.shipStatLabel}>Hull</span>
          <span className={styles.shipStatValue}>{ship.hull}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Shield size={10} /></span>
          <span className={styles.shipStatLabel}>Shld</span>
          <span className={styles.shipStatValue}>{ship.shield}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Gauge size={10} /></span>
          <span className={styles.shipStatLabel}>Spd</span>
          <span className={styles.shipStatValue}>{ship.speed}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Package size={10} /></span>
          <span className={styles.shipStatLabel}>Cargo</span>
          <span className={styles.shipStatValue}>{ship.cargo}</span>
        </div>
      </div>

      <button
        className={styles.buyBtn}
        onClick={() => onBuy(ship.ship_id)}
        disabled={!isDocked || !canAfford}
        title={
          !isDocked
            ? 'Dock to purchase'
            : !canAfford
              ? `Need ${(ship.showroom_price - credits).toLocaleString()} more credits`
              : `Buy ${ship.name} for ${ship.showroom_price.toLocaleString()} credits`
        }
        type="button"
      >
        <ShoppingCart size={12} />
        Buy
      </button>
    </div>
  )
}
