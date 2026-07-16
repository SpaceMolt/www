'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Skull,
  Package,
  Cpu,
  Hammer,
  RefreshCw,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Clock,
  User,
  Anchor,
  Coins,
  Unlink,
} from 'lucide-react'
import { SpacemoltError } from '@spacemolt/lib'
import type { GetWrecksResponse, ScrapWreckResponse } from '@spacemolt/lib'
import {
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  usePlayer,
  useShip,
} from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { Panel, shared, ConfirmAction } from '../shared'
import styles from './SalvagePanel.module.css'

type Wreck = GetWrecksResponse['wrecks'][number]

function errorMessage(err: unknown): string {
  if (err instanceof SpacemoltError) return err.message
  if (err instanceof Error) return err.message
  return 'Action failed'
}

function formatTimeRemaining(expiresAt?: string, expireTick?: number): string | null {
  // expire_tick === 0 means "never expires" (ship/pirate/abandoned wrecks)
  if (expireTick === 0 || expireTick === undefined) {
    if (!expiresAt) return null
    // Fall through to time-based formatting if expires_at is set
  }
  if (!expiresAt) return null
  const expires = new Date(expiresAt).getTime()
  if (isNaN(expires) || expires <= 0) return null
  const now = Date.now()
  const remainingMs = expires - now
  if (remainingMs <= 0) return 'Despawning'
  const remainingSec = Math.floor(remainingMs / 1000)
  if (remainingSec < 60) return `${remainingSec}s`
  const mins = Math.floor(remainingSec / 60)
  const secs = remainingSec % 60
  return `${mins}m ${secs}s`
}

function persistsForever(expireTick?: number): boolean {
  return expireTick === 0
}

function describeWreck(w: Wreck): string {
  if (w.ship_name) return w.ship_name
  if (w.victim_name) return `${w.victim_name}'s ${w.ship_class || 'wreck'}`
  if (w.ship_class) return w.ship_class.replace(/_/g, ' ')
  return 'Unknown wreck'
}

function describeTowedWreck(w: Wreck | undefined): string {
  return w ? describeWreck(w) : 'Towed wreck'
}

export function SalvagePanel() {
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const ship = useShip()
  const location = useLocationState()

  const wrecksQuery = useCommandQuery(
    async (account) => (await account.commands.spacemolt_salvage.wrecks()).structuredContent,
    [location?.poi_id],
    { refreshOnSections: ['location'] },
  )

  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<'scrap' | 'sell' | null>(null)
  const [scrapResult, setScrapResult] = useState<ScrapWreckResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Tick state purely to refresh countdown displays
  const [, setNow] = useState(Date.now())

  const isDocked = Boolean(location?.docked_at)
  const currentPoiName = location?.poi_name
  const towingWreckId = player?.towing_wreck_id
  const wrecks = wrecksQuery.data?.wrecks ?? []
  const loading = wrecksQuery.loading
  const loaded = wrecksQuery.data !== undefined

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      setErrorMsg(text)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    },
    [uiStore],
  )

  // Tick every second to refresh despawn countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleLootItem = useCallback(
    async (wreckId: string, itemId: string) => {
      const key = `loot:${wreckId}:${itemId}`
      setActionBusy(key)
      setErrorMsg(null)
      try {
        await mutate((c) => c.spacemolt_salvage.loot({ id: wreckId, item_id: itemId }), { label: 'loot' })
        wrecksQuery.refetch()
      } catch (err) {
        reportError(err)
      } finally {
        setActionBusy(null)
      }
    },
    [mutate, wrecksQuery, reportError],
  )

  const handleLootModule = useCallback(
    async (wreckId: string, moduleId: string) => {
      const key = `loot:${wreckId}:mod:${moduleId}`
      setActionBusy(key)
      setErrorMsg(null)
      try {
        await mutate((c) => c.spacemolt_salvage.loot({ id: wreckId, module_id: moduleId }), { label: 'loot' })
        wrecksQuery.refetch()
      } catch (err) {
        reportError(err)
      } finally {
        setActionBusy(null)
      }
    },
    [mutate, wrecksQuery, reportError],
  )

  const handleTow = useCallback(
    async (wreckId: string) => {
      const key = `tow:${wreckId}`
      setActionBusy(key)
      setErrorMsg(null)
      try {
        const result = await mutate((c) => c.spacemolt_salvage.tow({ id: wreckId }), { label: 'tow' })
        uiStore.dispatch({ type: 'event', kind: 'info', text: result.delta.details?.message || 'Wreck under tow' })
        wrecksQuery.refetch()
      } catch (err) {
        reportError(err)
      } finally {
        setActionBusy(null)
      }
    },
    [mutate, uiStore, wrecksQuery, reportError],
  )

  const handleScrap = useCallback(async () => {
    setActionBusy('scrap')
    setErrorMsg(null)
    try {
      const result = await mutate((c) => c.spacemolt_salvage.scrap(), { label: 'scrap' })
      setScrapResult(result.delta.details ?? null)
      setConfirmAction(null)
      wrecksQuery.refetch()
    } catch (err) {
      reportError(err)
      setConfirmAction(null)
    } finally {
      setActionBusy(null)
    }
  }, [mutate, wrecksQuery, reportError])

  const handleSell = useCallback(async () => {
    setActionBusy('sell')
    setErrorMsg(null)
    try {
      const result = await mutate((c) => c.spacemolt_salvage.sell(), { label: 'sell' })
      uiStore.dispatch({ type: 'event', kind: 'success', text: result.delta.details?.message || 'Wreck sold' })
      setConfirmAction(null)
      wrecksQuery.refetch()
    } catch (err) {
      reportError(err)
      setConfirmAction(null)
    } finally {
      setActionBusy(null)
    }
  }, [mutate, uiStore, wrecksQuery, reportError])

  const handleRelease = useCallback(async () => {
    setActionBusy('release')
    setErrorMsg(null)
    try {
      const result = await mutate((c) => c.spacemolt_salvage.release(), { label: 'release' })
      uiStore.dispatch({ type: 'event', kind: 'info', text: result.delta.details?.message || 'Tow released' })
      wrecksQuery.refetch()
    } catch (err) {
      reportError(err)
    } finally {
      setActionBusy(null)
    }
  }, [mutate, uiStore, wrecksQuery, reportError])

  const cargoUsed = ship?.cargo_used ?? 0
  const cargoCapacity = ship?.cargo_capacity ?? 0
  const cargoFull = cargoCapacity > 0 && cargoUsed >= cargoCapacity

  const headerRight = (
    <button
      className={shared.refreshBtn}
      onClick={wrecksQuery.refetch}
      disabled={loading}
      type="button"
      title="Rescan for wrecks"
      aria-label="Refresh wrecks"
    >
      <RefreshCw size={13} className={loading ? shared.spinner : undefined} />
    </button>
  )

  return (
    <Panel
      title="Salvage"
      icon={<Skull size={16} />}
      color="var(--void-purple)"
      headerRight={headerRight}
    >
      {/* Location header */}
      <div className={styles.locationLine}>
        {currentPoiName ? (
          <>Scanning <span className={styles.locationName}>{currentPoiName}</span></>
        ) : (
          <>Scanning current location</>
        )}
        {isDocked && (
          <span className={shared.badgeOrange} style={{ marginLeft: '0.5rem' }}>
            Docked
          </span>
        )}
      </div>

      {errorMsg && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={12} /> {errorMsg}
        </div>
      )}

      {cargoFull && (
        <div className={styles.cargoWarn}>
          <AlertTriangle size={12} /> Cargo hold full ({cargoUsed}/{cargoCapacity}) — looting will fail until space frees up.
        </div>
      )}

      {/* Active tow */}
      {towingWreckId && (
        <div className={styles.wreckCard}>
          <div className={styles.wreckHeader}>
            <div className={styles.wreckHeaderLeft}>
              <Anchor size={14} className={styles.wreckIcon} />
              <div className={styles.wreckTitleBlock}>
                <span className={styles.wreckTitle}>
                  {describeTowedWreck(wrecks.find((w) => w.id === towingWreckId))}
                </span>
                <span className={styles.wreckSub}>Under tow</span>
              </div>
            </div>
          </div>
          <div className={styles.salvageRow}>
            {confirmAction === 'scrap' ? (
              <ConfirmAction
                message="Scrap the towed wreck for raw materials. This destroys it. Continue?"
                icon={<AlertTriangle size={12} />}
                onConfirm={handleScrap}
                onCancel={() => setConfirmAction(null)}
                confirmLabel={actionBusy === 'scrap' ? 'Scrapping...' : 'Scrap'}
                cancelLabel="Cancel"
                confirmDisabled={actionBusy === 'scrap'}
                variant="danger"
              />
            ) : confirmAction === 'sell' ? (
              <ConfirmAction
                message="Sell the towed wreck to the salvage yard for credits. Continue?"
                icon={<AlertTriangle size={12} />}
                onConfirm={handleSell}
                onCancel={() => setConfirmAction(null)}
                confirmLabel={actionBusy === 'sell' ? 'Selling...' : 'Sell'}
                cancelLabel="Cancel"
                confirmDisabled={actionBusy === 'sell'}
                variant="danger"
              />
            ) : (
              <>
                <button
                  className={shared.dangerBtn}
                  onClick={() => setConfirmAction('scrap')}
                  disabled={Boolean(actionBusy)}
                  type="button"
                  title="Destroy the towed wreck for salvage materials"
                >
                  <Trash2 size={12} /> Scrap
                </button>
                <button
                  className={shared.actionBtn}
                  onClick={() => setConfirmAction('sell')}
                  disabled={Boolean(actionBusy)}
                  type="button"
                  title="Sell the towed wreck to the salvage yard"
                >
                  <Coins size={12} /> Sell
                </button>
                <button
                  className={shared.actionBtn}
                  onClick={handleRelease}
                  disabled={Boolean(actionBusy)}
                  type="button"
                  title="Release the tow line without scrapping or selling"
                >
                  <Unlink size={12} /> {actionBusy === 'release' ? 'Releasing...' : 'Release'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && wrecks.length === 0 && (
        <div className={shared.emptyState}>
          <span className={shared.spinner}><RefreshCw size={13} /></span> Scanning for wrecks...
        </div>
      )}

      {/* Empty state */}
      {loaded && !loading && wrecks.length === 0 && (
        <div className={shared.emptyState}>
          No wrecks detected at this location.
        </div>
      )}

      {/* Wreck list */}
      {wrecks.length > 0 && (
        <div className={styles.wreckList}>
          {wrecks.map((w) => {
            const isOpen = expanded.has(w.id)
            const modules = w.modules
            const cargoEntries = w.cargo || []
            const timeRem = formatTimeRemaining(w.expires_at, w.expire_tick)
            const persistent = persistsForever(w.expire_tick)
            const towedBySelf = towingWreckId === w.id
            const towedByOther = Boolean(w.towed_by_player_id) && w.towed_by_player_id !== player?.id
            const label = describeWreck(w)
            const towBusy = actionBusy === `tow:${w.id}`

            return (
              <div key={w.id} className={styles.wreckCard}>
                <div
                  className={styles.wreckHeader}
                  onClick={() => toggleExpanded(w.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleExpanded(w.id)
                    }
                  }}
                >
                  <div className={styles.wreckHeaderLeft}>
                    <Skull size={14} className={styles.wreckIcon} />
                    <div className={styles.wreckTitleBlock}>
                      <span className={styles.wreckTitle}>{label}</span>
                      <span className={styles.wreckSub}>
                        <span className={styles.wreckType}>{w.type}</span>
                        {w.killer_name && (
                          <span className={styles.wreckKiller}>
                            <User size={10} /> killed by {w.killer_name}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className={styles.wreckHeaderRight}>
                    {persistent ? (
                      <span className={shared.badgeGrey}>Persistent</span>
                    ) : timeRem ? (
                      <span className={shared.badgeOrange}>
                        <Clock size={10} /> {timeRem}
                      </span>
                    ) : null}
                    {towedBySelf && <span className={shared.badgePurple}>Towing</span>}
                    {towedByOther && <span className={shared.badgePurple}>Towed</span>}
                  </div>
                </div>

                {/* Summary line — always visible */}
                <div className={styles.wreckSummary}>
                  <span>
                    <Package size={11} /> Cargo: <b>{cargoEntries.length}</b>
                  </span>
                  <span>
                    <Cpu size={11} /> Modules: <b>{modules.length}</b>
                  </span>
                  {typeof w.salvage_value === 'number' && (
                    <span>
                      <Hammer size={11} /> Value: <b>{w.salvage_value.toLocaleString()}c</b>
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div className={styles.wreckBody}>
                    {/* Cargo section */}
                    {cargoEntries.length > 0 && (
                      <div className={styles.section}>
                        <div className={shared.sectionTitle}>
                          <Package size={12} /> Cargo
                        </div>
                        <div className={styles.itemList}>
                          {cargoEntries.map((item) => {
                            const lootKey = `loot:${w.id}:${item.item_id}`
                            const lootBusy = actionBusy === lootKey
                            return (
                              <div key={item.item_id} className={shared.listCard}>
                                <span className={shared.listCardName}>
                                  {item.name || item.item_id.replace(/_/g, ' ')}
                                </span>
                                <span className={shared.listCardMeta}>
                                  <span>x{item.quantity}</span>
                                  <button
                                    className={shared.actionBtn}
                                    onClick={() => handleLootItem(w.id, item.item_id)}
                                    disabled={lootBusy || isDocked}
                                    type="button"
                                    title={isDocked ? 'Undock to loot wrecks' : 'Loot all'}
                                  >
                                    {lootBusy ? '...' : 'Loot'}
                                  </button>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Modules section */}
                    {modules.length > 0 && (
                      <div className={styles.section}>
                        <div className={shared.sectionTitle}>
                          <Cpu size={12} /> Modules
                        </div>
                        <div className={styles.itemList}>
                          {modules.map((m) => {
                            const modKey = `loot:${w.id}:mod:${m.id}`
                            const modBusy = actionBusy === modKey
                            const wearPct = Math.round(m.wear)
                            return (
                              <div key={m.id} className={shared.listCard}>
                                <span className={shared.listCardName}>
                                  {m.name || m.type_id || m.id}
                                </span>
                                <span className={shared.listCardMeta}>
                                  {m.type && <span>{m.type}</span>}
                                  <span>wear {wearPct}%</span>
                                  <button
                                    className={shared.actionBtn}
                                    onClick={() => handleLootModule(w.id, m.id)}
                                    disabled={modBusy || isDocked}
                                    type="button"
                                    title={
                                      isDocked
                                        ? 'Undock to loot wrecks'
                                        : 'Loot module to cargo'
                                    }
                                  >
                                    {modBusy ? '...' : 'Loot'}
                                  </button>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {cargoEntries.length === 0 && modules.length === 0 && (
                      <div className={shared.emptyState}>This wreck has been stripped clean.</div>
                    )}

                    {/* Tow action */}
                    <div className={styles.salvageRow}>
                      {towedBySelf ? (
                        <span className={styles.wreckSub}>Use the towing controls above to scrap, sell, or release.</span>
                      ) : towedByOther ? (
                        <span className={styles.wreckSub}>Already under tow by another player.</span>
                      ) : (
                        <button
                          className={shared.actionBtn}
                          onClick={() => handleTow(w.id)}
                          disabled={towBusy || isDocked || Boolean(towingWreckId)}
                          type="button"
                          title={
                            isDocked
                              ? 'Undock before towing'
                              : towingWreckId
                                ? 'Release your current tow before attaching a new one'
                                : 'Attach a tow line to this wreck'
                          }
                        >
                          <Anchor size={12} /> {towBusy ? 'Towing...' : 'Tow'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Scrap result modal */}
      {scrapResult && (
        <div className={shared.modalBackdrop} onClick={() => setScrapResult(null)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <span className={shared.modalTitle}>
                <Hammer size={14} /> Scrap Complete
              </span>
              <button
                className={shared.modalClose}
                onClick={() => setScrapResult(null)}
                aria-label="Close"
                type="button"
              >
                <X size={14} />
              </button>
            </div>
            <div className={shared.modalBody}>
              <div className={styles.salvageResultIntro}>{scrapResult.message}</div>
              <div className={styles.salvageResults}>
                {scrapResult.materials.map((mat) => (
                  <div key={mat.item} className={styles.salvageResultRow}>
                    <span>{mat.name}</span>
                    <b>{mat.quantity}</b>
                  </div>
                ))}
                {typeof scrapResult.total_value === 'number' && (
                  <div className={styles.salvageResultRow}>
                    <span>Total value</span>
                    <b>{scrapResult.total_value.toLocaleString()}c</b>
                  </div>
                )}
              </div>
            </div>
            <div className={shared.modalActions}>
              <button
                className={shared.confirmBtn}
                onClick={() => setScrapResult(null)}
                type="button"
              >
                <Check size={12} /> OK
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
