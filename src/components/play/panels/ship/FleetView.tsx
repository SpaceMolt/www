'use client'

import { useCallback, useState } from 'react'
import {
  Ship,
  RefreshCw,
  Heart,
  Fuel,
  Package,
  Wrench as WrenchIcon,
  MapPin,
  ArrowRightLeft,
  Pencil,
  Hammer,
  AlertTriangle,
} from 'lucide-react'
import type { ListShipsResponse } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery, useLocationState, useModules, useShip } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Loading, Modal, Panel, ConfirmAction, shared, errorMessage } from '../../shared'
import { refitPreview, type RefitPreview } from './refitPreview'
import { InsuranceView } from './InsuranceView'
import { useStationServices } from '../../hooks/useGates'
import styles from './FleetView.module.css'
import { imageUrl } from '@/data/images'

type FleetShipEntry = ListShipsResponse['ships'][number]

export function FleetView() {
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const currentBaseId = location?.docked_at ?? undefined
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const hasShipyard = useStationServices().includes('shipyard')

  const { data: fleet, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_ship.list_ships()).structuredContent,
    [],
    { refreshOnSections: ['ship'] }
  )

  // Offer a refit only when the server says one applies and this station has a shipyard.
  // refit_available is newer than @spacemolt/lib's generated ship type.
  const activeShip = useShip() as (ReturnType<typeof useShip> & { refit_available?: boolean }) | undefined
  const modules = useModules()
  const refitAvailable = isDocked && Boolean(activeShip?.refit_available)
  const { data: base } = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_base()).structuredContent,
    [currentBaseId],
    { enabled: refitAvailable }
  )
  const refit = refitAvailable && activeShip && base?.services.includes('shipyard')
    ? refitPreview(activeShip.class_id, activeShip, (modules ?? []).map((m) => m.name))
    : undefined
  const cargoAboard = (activeShip?.cargo_used ?? 0) > 0

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    },
    [uiStore]
  )

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handleSwitch = useCallback(
    (shipId: string) => {
      mutate((c) => c.spacemolt_ship.switch_ship({ id: shipId }), { label: 'switch_ship' })
        .then(() => refetch())
        .catch(reportError)
    },
    [mutate, refetch, reportError]
  )

  // scrap_ship: break down a docked ship for partial materials (irreversible).
  const handleScrap = useCallback(
    (shipId: string) => {
      mutate((c) => c.spacemolt_ship.scrap_ship({ id: shipId }), { label: 'scrap_ship' })
        .then(() => refetch())
        .catch(reportError)
    },
    [mutate, refetch, reportError]
  )

  // rename_ship operates on the active ship only.
  const handleRename = useCallback(
    (name: string) => {
      mutate((c) => c.spacemolt_ship.rename_ship({ name }), { label: 'rename_ship' })
        .then(() => refetch())
        .catch(reportError)
    },
    [mutate, refetch, reportError]
  )

  // refit_ship resets the active ship to its current class spec; modules and
  // cargo are moved to station storage. Requires a shipyard.
  const handleRefit = useCallback(() => {
    mutate((c) => c.spacemolt_ship.refit_ship(), { label: 'refit_ship' })
      .then(() => refetch())
      .catch(reportError)
  }, [mutate, refetch, reportError])

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
        <InsuranceView isDocked={isDocked} />
        {!fleet ? (
          <Loading message="Loading fleet data..." />
        ) : fleet.ships.length === 0 ? (
          <div className={shared.emptyState}>You have no ships</div>
        ) : (
          <>
            {fleet.count > 1 && (
              <div className={styles.summary}>
                <span className={styles.summaryLabel}>Ships Owned</span>
                <span className={styles.summaryValue}>{fleet.count}</span>
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
                  hasShipyard={hasShipyard}
                  onSwitch={handleSwitch}
                  onScrap={handleScrap}
                  onRename={handleRename}
                  onRefit={handleRefit}
                  refit={ship.is_active ? refit : undefined}
                  cargoAboard={cargoAboard}
                />
              ))}
            </div>
          </>
        )}
    </Panel>
  )
}

interface FleetCardProps {
  ship: FleetShipEntry
  isDocked: boolean
  currentBaseId?: string
  /** Switching needs a shipyard here (list_ships holds no faction-garage ships, the one exception). */
  hasShipyard: boolean
  onSwitch: (shipId: string) => void
  onScrap: (shipId: string) => void
  onRename: (name: string) => void
  onRefit: () => void
  /** Set only when a refit is available here for this (active) ship. */
  refit?: RefitPreview
  cargoAboard: boolean
}

function FleetCard({
  ship,
  isDocked,
  currentBaseId,
  hasShipyard,
  onSwitch,
  onScrap,
  onRename,
  onRefit,
  refit,
  cargoAboard,
}: FleetCardProps) {
  const isAtCurrentBase =
    isDocked && currentBaseId && ship.location_base_id === currentBaseId
  const canManage = !ship.is_active && isAtCurrentBase
  // The active ship can be renamed/refitted while docked at a base.
  const canManageActive = ship.is_active && isDocked

  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(ship.custom_name || '')
  const [confirm, setConfirm] = useState<'scrap' | 'refit' | null>(null)

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
            src={imageUrl(`ships/catalog/${ship.class_id}.webp`)}
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
              {refit && (
                <button
                  className={shared.actionBtn}
                  onClick={() => setConfirm('refit')}
                  title="This ship's class was updated. Refit to the current spec."
                  type="button"
                >
                  <Hammer size={11} />
                  Refit
                </button>
              )}
            </>
          )}
          {canManage && (
            <>
              {hasShipyard && (
                <button
                  className={shared.actionBtn}
                  onClick={() => onSwitch(ship.ship_id)}
                  title="Switch to this ship"
                  type="button"
                >
                  <ArrowRightLeft size={11} />
                  Switch
                </button>
              )}
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

      {confirm === 'scrap' && (
        <ConfirmAction
          message="Scrap this ship for materials? Irreversible."
          icon={<AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />}
          onConfirm={() => { onScrap(ship.ship_id); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'refit' && refit && (
        <RefitModal
          preview={refit}
          cargoAboard={cargoAboard}
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

/** "Autocannon I x3, Armor Plate I" */
const countNames = (names: string[]) =>
  Object.entries(names.reduce<Record<string, number>>((acc, n) => ({ ...acc, [n]: (acc[n] ?? 0) + 1 }), {}))
    .map(([name, n]) => (n > 1 ? `${name} x${n}` : name))
    .join(', ')

/** The refit confirmation: every stat that changes, and the module swap. */
function RefitModal({ preview, cargoAboard, onConfirm, onCancel }: { preview: RefitPreview; cargoAboard: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal
      title="Refit to current class spec"
      icon={<Hammer size={14} />}
      onClose={onCancel}
      actions={
        <>
          <button className={shared.dangerBtn} onClick={onConfirm} type="button"><Hammer size={12} /> Refit</button>
          <button className={shared.subtleBtn} onClick={onCancel} type="button">Cancel</button>
        </>
      }
    >
      {preview.changes.length > 0 ? (
        <table className={styles.refitTable}>
          <thead>
            <tr><th>Stat</th><th>Now</th><th>After</th></tr>
          </thead>
          <tbody>
            {preview.changes.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>{c.before}</td>
                <td className={c.after > c.before ? styles.refitUp : styles.refitDown}>{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.refitNote}>Base stats stay the same. The class&apos;s standard loadout changed.</p>
      )}
      <p className={styles.refitNote}><b>Installs:</b> {countNames(preview.installed) || 'nothing'}</p>
      <p className={styles.refitNote}><b>To station storage:</b> {countNames(preview.removed) || 'no modules'}{cargoAboard ? ', and all cargo' : ''}</p>
      <p className={styles.refitWarn}><AlertTriangle size={12} /> Free, but it cannot be undone. Refit your own modules after from storage.</p>
    </Modal>
  )
}
