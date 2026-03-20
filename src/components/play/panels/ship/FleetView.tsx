'use client'

import { useEffect, useCallback, useState } from 'react'
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
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import type { FleetShip, CargoItem } from '../../types'
import styles from './FleetView.module.css'

interface ShipInspection {
  cargo: CargoItem[]
  modules: Record<string, unknown>[]
}

export function FleetView() {
  const { state, sendCommand } = useGame()
  const fleet = state.fleetData
  const isDocked = state.isDocked
  const currentBaseId = state.poi?.base_id

  const [expandedShipId, setExpandedShipId] = useState<string | null>(null)
  const [inspectionData, setInspectionData] = useState<Record<string, ShipInspection>>({})
  const [inspectingShipId, setInspectingShipId] = useState<string | null>(null)

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

  const handleToggleExpand = useCallback(
    (shipId: string) => {
      if (expandedShipId === shipId) {
        setExpandedShipId(null)
        return
      }
      setExpandedShipId(shipId)
      // Fetch inspection data if we don't have it yet
      if (!inspectionData[shipId]) {
        setInspectingShipId(shipId)
        sendCommand('inspect_ship', { ship_id: shipId }).then((result) => {
          setInspectingShipId(null)
          if (result && !result.error) {
            setInspectionData((prev) => ({
              ...prev,
              [shipId]: {
                cargo: (result.cargo as unknown as CargoItem[]) || [],
                modules: (result.modules as unknown as Record<string, unknown>[]) || [],
              },
            }))
          }
        })
      }
    },
    [expandedShipId, inspectionData, sendCommand]
  )

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Ship size={16} />
          </span>
          Fleet
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            title="Refresh fleet"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {!fleet ? (
          <div className={styles.emptyState}>Loading fleet data...</div>
        ) : fleet.ships.length === 0 ? (
          <div className={styles.emptyState}>You have no ships</div>
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
                  isExpanded={expandedShipId === ship.ship_id}
                  isInspecting={inspectingShipId === ship.ship_id}
                  inspection={inspectionData[ship.ship_id] || null}
                  onToggleExpand={handleToggleExpand}
                  onSwitch={handleSwitch}
                  onSell={handleSell}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface FleetCardProps {
  ship: FleetShip
  isDocked: boolean
  currentBaseId?: string
  isExpanded: boolean
  isInspecting: boolean
  inspection: ShipInspection | null
  onToggleExpand: (shipId: string) => void
  onSwitch: (shipId: string) => void
  onSell: (shipId: string) => void
}

function FleetCard({
  ship,
  isDocked,
  currentBaseId,
  isExpanded,
  isInspecting,
  inspection,
  onToggleExpand,
  onSwitch,
  onSell,
}: FleetCardProps) {
  const isAtCurrentBase =
    isDocked && currentBaseId && ship.location_base_id === currentBaseId
  const canManage = !ship.is_active && isAtCurrentBase

  const cardClass = isExpanded
    ? styles.fleetCardExpanded
    : ship.is_active
      ? styles.fleetCardActive
      : styles.fleetCard

  return (
    <div className={cardClass}>
      <div
        className={styles.fleetCardTop}
        onClick={() => onToggleExpand(ship.ship_id)}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpand(ship.ship_id)
          }
        }}
      >
        <div className={styles.fleetCardInfo}>
          <button
            className={styles.inspectToggle}
            title={isExpanded ? 'Collapse' : 'Inspect ship'}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(ship.ship_id)
            }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
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
        <div className={styles.fleetCardActions} onClick={(e) => e.stopPropagation()}>
          {canManage && (
            <>
              <button
                className={styles.switchBtn}
                onClick={() => onSwitch(ship.ship_id)}
                title="Switch to this ship"
                type="button"
              >
                <ArrowRightLeft size={11} />
                Switch
              </button>
              <button
                className={styles.sellBtn}
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

      {/* Expanded inspection details */}
      {isExpanded && (
        <div className={styles.expandedSection}>
          {isInspecting ? (
            <div className={styles.emptyState}>
              <Loader2 size={14} style={{ display: 'inline', animation: 'spin 1s linear infinite' }} />
              {' '}Inspecting ship...
            </div>
          ) : inspection ? (
            <>
              {/* Fitted Modules */}
              <div>
                <div className={styles.expandedHeader}>
                  <WrenchIcon size={10} />
                  Fitted Modules ({inspection.modules.length})
                </div>
                {inspection.modules.length === 0 ? (
                  <div className={styles.emptyState}>No modules fitted</div>
                ) : (
                  inspection.modules.map((mod, i) => (
                    <div key={(mod.instance_id as string) || `${mod.module_id as string}-${i}`} className={styles.expandedItem}>
                      <span className={styles.expandedItemName}>{mod.name as string}</span>
                      <span className={styles.expandedItemMeta}>
                        {mod.slot_type as string}
                        {mod.quality != null && ` / Q${mod.quality as number}`}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Cargo */}
              <div>
                <div className={styles.expandedHeader}>
                  <Package size={10} />
                  Cargo ({inspection.cargo.length})
                </div>
                {inspection.cargo.length === 0 ? (
                  <div className={styles.emptyState}>Cargo hold empty</div>
                ) : (
                  inspection.cargo.map((item) => (
                    <div key={item.item_id} className={styles.expandedItem}>
                      <span className={styles.expandedItemName}>{item.name}</span>
                      <span className={styles.expandedItemMeta}>
                        x{item.quantity}
                        {(item.size ?? 0) > 0 && ` (${(item.size ?? 0) * item.quantity}m3)`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>Failed to load ship details</div>
          )}
        </div>
      )}
    </div>
  )
}
