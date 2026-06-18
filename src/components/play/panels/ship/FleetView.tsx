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
  Pencil,
  Hammer,
  AlertTriangle,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Loading, Panel, ConfirmAction, shared } from '../../shared'
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

  // scrap_ship: break down a docked ship for partial materials (irreversible).
  const handleScrap = useCallback(
    (shipId: string) => {
      sendCommand('scrap_ship', { ship_id: shipId }).then(() => {
        sendCommand('list_ships')
      })
    },
    [sendCommand]
  )

  // rename_ship operates on the active ship only (server: name_ship).
  const handleRename = useCallback(
    (name: string) => {
      sendCommand('rename_ship', { name }).then(() => {
        sendCommand('get_status')
        sendCommand('list_ships')
      })
    },
    [sendCommand]
  )

  // refit_ship resets the active ship to its current class spec; modules and
  // cargo are moved to station storage. Requires a shipyard.
  const handleRefit = useCallback(() => {
    sendCommand('refit_ship').then(() => {
      sendCommand('get_status')
      sendCommand('list_ships')
    })
  }, [sendCommand])

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
                  onScrap={handleScrap}
                  onRename={handleRename}
                  onRefit={handleRefit}
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
  onScrap: (shipId: string) => void
  onRename: (name: string) => void
  onRefit: () => void
}

function FleetCard({
  ship,
  isDocked,
  currentBaseId,
  onSwitch,
  onSell,
  onScrap,
  onRename,
  onRefit,
}: FleetCardProps) {
  const isAtCurrentBase =
    isDocked && currentBaseId && ship.location_base_id === currentBaseId
  const canManage = !ship.is_active && isAtCurrentBase
  // The active ship can be renamed/refitted while docked at a base.
  const canManageActive = ship.is_active && isDocked

  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(ship.custom_name || '')
  const [confirm, setConfirm] = useState<'scrap' | 'refit' | 'sell' | null>(null)

  const cardClass = ship.is_active ? styles.fleetCardActive : styles.fleetCard

  const submitRename = () => {
    onRename(renameValue.trim())
    setRenaming(false)
  }

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
            {ship.custom_name || ship.class_name || ship.class_id}
          </span>
          {ship.is_active && (
            <span className={styles.activeIndicator}>Active</span>
          )}
        </div>
        <div className={styles.fleetCardActions}>
          {canManageActive && (
            <>
              <button
                className={shared.actionBtn}
                onClick={() => { setRenameValue(ship.custom_name || ''); setRenaming(true) }}
                title="Rename this ship"
                type="button"
              >
                <Pencil size={11} />
                Rename
              </button>
              <button
                className={shared.actionBtn}
                onClick={() => setConfirm('refit')}
                title="Refit to current class spec (modules & cargo moved to storage)"
                type="button"
              >
                <Hammer size={11} />
                Refit
              </button>
            </>
          )}
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
                onClick={() => setConfirm('sell')}
                title="Sell this ship"
                type="button"
              >
                <Trash2 size={11} />
                Sell
              </button>
              <button
                className={shared.dangerBtn}
                onClick={() => setConfirm('scrap')}
                title="Scrap this ship for materials"
                type="button"
              >
                <Hammer size={11} />
                Scrap
              </button>
            </>
          )}
        </div>
      </div>

      {renaming && (
        <div className={styles.renameRow}>
          <input
            className={styles.renameInput}
            type="text"
            value={renameValue}
            placeholder="Ship name (empty to clear)"
            aria-label="Ship name"
            maxLength={32}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
          <button className={shared.confirmBtn} onClick={submitRename} type="button">Save</button>
          <button className={shared.subtleBtn} onClick={() => setRenaming(false)} type="button">Cancel</button>
        </div>
      )}

      {confirm === 'sell' && (
        <ConfirmAction
          message="Sell this ship? Irreversible."
          icon={<AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />}
          onConfirm={() => { onSell(ship.ship_id); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'scrap' && (
        <ConfirmAction
          message="Scrap this ship for materials? Irreversible."
          icon={<AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />}
          onConfirm={() => { onScrap(ship.ship_id); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'refit' && (
        <ConfirmAction
          message="Refit to current class spec? Modules and cargo move to station storage."
          icon={<AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />}
          onConfirm={() => { onRefit(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}

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
