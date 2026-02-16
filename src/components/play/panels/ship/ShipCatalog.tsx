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
  Cpu,
  Zap,
  Crosshair,
  CircuitBoard,
  ShoppingCart,
  Lock,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import type { ShipClassInfo } from '../../types'
import styles from './ShipCatalog.module.css'

export function ShipCatalog() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const credits = state.player?.credits ?? 0
  const catalog = state.shipCatalog

  // Auto-fetch when docked and catalog is null
  useEffect(() => {
    if (isDocked && !catalog) {
      sendCommand('get_ships')
    }
  }, [isDocked, catalog, sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('get_ships')
  }, [sendCommand])

  const handleBuy = useCallback(
    (shipClassId: string) => {
      sendCommand('buy_ship', { ship_class: shipClassId })
    },
    [sendCommand]
  )

  const sortedShips = useMemo(() => {
    if (!catalog?.ships) return []
    return [...catalog.ships].sort((a, b) => a.price - b.price)
  }, [catalog])

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
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            title="Refresh ship catalog"
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

        {!catalog ? (
          <div className={styles.emptyState}>Loading ship catalog...</div>
        ) : sortedShips.length === 0 ? (
          <div className={styles.emptyState}>No ships available at this shipyard</div>
        ) : (
          <>
            <span className={styles.countLabel}>
              {catalog.count} ship{catalog.count !== 1 ? 's' : ''} available
            </span>
            <div className={styles.shipList}>
              {sortedShips.map((ship) => (
                <ShipCard
                  key={ship.id}
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

interface ShipCardProps {
  ship: ShipClassInfo
  credits: number
  isDocked: boolean
  onBuy: (classId: string) => void
}

function ShipCard({ ship, credits, isDocked, onBuy }: ShipCardProps) {
  const canAfford = credits >= ship.price
  const hasSkillReqs = ship.required_skills && Object.keys(ship.required_skills).length > 0
  const hasItemReqs = ship.required_items && ship.required_items.length > 0

  return (
    <div className={styles.shipCard}>
      <div className={styles.shipCardTop}>
        <div className={styles.shipCardInfo}>
          <span className={styles.shipCardName}>{ship.name}</span>
          <span className={styles.shipCardClass}>{ship.class}</span>
        </div>
        <span className={canAfford ? styles.shipCardPrice : styles.shipCardPriceUnaffordable}>
          {ship.price.toLocaleString()} cr
        </span>
      </div>

      {ship.description && (
        <div className={styles.shipCardDesc}>{ship.description}</div>
      )}

      {/* Key stats */}
      <div className={styles.shipStatsRow}>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Heart size={10} /></span>
          <span className={styles.shipStatLabel}>Hull</span>
          <span className={styles.shipStatValue}>{ship.base_hull}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Shield size={10} /></span>
          <span className={styles.shipStatLabel}>Shld</span>
          <span className={styles.shipStatValue}>{ship.base_shield}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Gauge size={10} /></span>
          <span className={styles.shipStatLabel}>Spd</span>
          <span className={styles.shipStatValue}>{ship.base_speed}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Package size={10} /></span>
          <span className={styles.shipStatLabel}>Cargo</span>
          <span className={styles.shipStatValue}>{ship.cargo_capacity}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Cpu size={10} /></span>
          <span className={styles.shipStatLabel}>CPU</span>
          <span className={styles.shipStatValue}>{ship.cpu_capacity}</span>
        </div>
        <div className={styles.shipStat}>
          <span className={styles.shipStatIcon}><Zap size={10} /></span>
          <span className={styles.shipStatLabel}>Pwr</span>
          <span className={styles.shipStatValue}>{ship.power_capacity}</span>
        </div>
      </div>

      {/* Slot counts */}
      <div className={styles.slotsRow}>
        <span className={styles.slotBadge}>
          <span className={styles.slotBadgeIcon}><Crosshair size={10} /></span>
          Wpn: <span className={styles.slotBadgeValue}>{ship.weapon_slots}</span>
        </span>
        <span className={styles.slotBadge}>
          <span className={styles.slotBadgeIcon}><Shield size={10} /></span>
          Def: <span className={styles.slotBadgeValue}>{ship.defense_slots}</span>
        </span>
        <span className={styles.slotBadge}>
          <span className={styles.slotBadgeIcon}><CircuitBoard size={10} /></span>
          Util: <span className={styles.slotBadgeValue}>{ship.utility_slots}</span>
        </span>
      </div>

      {/* Requirements */}
      {(hasSkillReqs || hasItemReqs) && (
        <div className={styles.requirementsSection}>
          {hasSkillReqs && (
            <>
              <span className={styles.requirementLabel}>Required Skills</span>
              <div className={styles.requirementsList}>
                {Object.entries(ship.required_skills!).map(([skill, level]) => (
                  <span key={skill} className={styles.requirementTag}>
                    {skill} Lv{level}
                  </span>
                ))}
              </div>
            </>
          )}
          {hasItemReqs && (
            <>
              <span className={styles.requirementLabel}>Required Items</span>
              <div className={styles.requirementsList}>
                {ship.required_items!.map((item) => (
                  <span key={item.item_id} className={styles.requirementItemTag}>
                    {item.item_id} x{item.quantity}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button
        className={styles.buyBtn}
        onClick={() => onBuy(ship.id)}
        disabled={!isDocked || !canAfford}
        title={
          !isDocked
            ? 'Dock to purchase'
            : !canAfford
              ? `Need ${(ship.price - credits).toLocaleString()} more credits`
              : `Buy ${ship.name} for ${ship.price.toLocaleString()} credits`
        }
        type="button"
      >
        <ShoppingCart size={12} />
        Buy
      </button>
    </div>
  )
}
