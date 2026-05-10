'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { Panel, shared, ConfirmAction } from '../shared'
import styles from './SalvagePanel.module.css'

// Runtime shape — narrower than the raw OpenAPI type, captures fields we render.
// EnrichedWreck's `modules` are objects at runtime even though the OpenAPI spec
// declares them as string[] (the Go side overrides the embedded slice).
interface WreckCargo {
  item_id: string
  name?: string
  quantity: number
  size?: number
}

interface WreckModule {
  id: string
  type_id?: string
  name?: string
  type?: string
  wear?: number
}

interface WreckEntry {
  id: string
  type: string
  poi_id: string
  ship_class: string
  ship_name?: string
  victim_name?: string
  killer_name?: string
  cargo: WreckCargo[]
  modules: WreckModule[] | string[]
  salvage_value?: number
  created_at?: string
  expires_at?: string
  expire_tick?: number
  insurance_policy_id?: string
  towed_by_player_id?: string
}

interface SalvageResultData {
  metal_scrap?: number
  components?: number
  rare_materials?: number
  total_value?: number
  xp_gained?: number
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

function normalizeModules(modules: WreckEntry['modules']): WreckModule[] {
  if (!Array.isArray(modules)) return []
  return modules.map((m) => {
    if (typeof m === 'string') return { id: m }
    return m
  })
}

function describeWreck(w: WreckEntry): string {
  if (w.ship_name) return w.ship_name
  if (w.victim_name) return `${w.victim_name}'s ${w.ship_class || 'wreck'}`
  if (w.ship_class) return w.ship_class.replace(/_/g, ' ')
  return 'Unknown wreck'
}

export function SalvagePanel() {
  const { state, sendCommand } = useGame()
  const [wrecks, setWrecks] = useState<WreckEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirmSalvage, setConfirmSalvage] = useState<string | null>(null)
  const [lastSalvageResult, setLastSalvageResult] = useState<{
    wreckLabel: string
    result: SalvageResultData
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Tick state purely to refresh countdown displays
  const [, setNow] = useState(Date.now())

  const isDocked = state.isDocked
  const currentPoiName = state.poi?.name

  const fetchWrecks = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const resp = await sendCommand('get_wrecks')
      if ((resp as { error?: boolean }).error) {
        setErrorMsg(((resp as { message?: string }).message) || 'Unable to scan for wrecks.')
        setWrecks([])
      } else {
        const list = (resp.wrecks || []) as WreckEntry[]
        setWrecks(list)
      }
      setLoaded(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to scan for wrecks.'
      setErrorMsg(msg)
      setWrecks([])
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [sendCommand])

  // Auto-load when first mounted. Re-fetch when the player's POI changes.
  const poiRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const currentPoi = state.poi?.id
    if (currentPoi !== poiRef.current) {
      poiRef.current = currentPoi
      fetchWrecks()
    }
  }, [state.poi?.id, fetchWrecks])

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
    async (wreckId: string, itemId: string, quantity?: number) => {
      const key = `loot:${wreckId}:${itemId}`
      setActionBusy(key)
      setErrorMsg(null)
      try {
        const payload: Record<string, unknown> = { wreck_id: wreckId, item_id: itemId }
        if (typeof quantity === 'number' && quantity > 0) payload.quantity = quantity
        const resp = await sendCommand('loot_wreck', payload)
        if ((resp as { error?: boolean }).error) {
          setErrorMsg(((resp as { message?: string }).message) || 'Loot failed.')
        }
        await fetchWrecks()
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Loot failed.')
      } finally {
        setActionBusy(null)
      }
    },
    [sendCommand, fetchWrecks]
  )

  const handleLootModule = useCallback(
    async (wreckId: string, moduleId: string) => {
      const key = `loot:${wreckId}:mod:${moduleId}`
      setActionBusy(key)
      setErrorMsg(null)
      try {
        const resp = await sendCommand('loot_wreck', { wreck_id: wreckId, module_id: moduleId })
        if ((resp as { error?: boolean }).error) {
          setErrorMsg(((resp as { message?: string }).message) || 'Module loot failed.')
        }
        await fetchWrecks()
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Module loot failed.')
      } finally {
        setActionBusy(null)
      }
    },
    [sendCommand, fetchWrecks]
  )

  const handleSalvage = useCallback(
    async (wreck: WreckEntry) => {
      const key = `salvage:${wreck.id}`
      setActionBusy(key)
      setErrorMsg(null)
      try {
        const resp = await sendCommand('salvage_wreck', { wreck_id: wreck.id })
        if ((resp as { error?: boolean }).error) {
          setErrorMsg(((resp as { message?: string }).message) || 'Salvage failed.')
        } else {
          setLastSalvageResult({
            wreckLabel: describeWreck(wreck),
            result: resp as SalvageResultData,
          })
        }
        setConfirmSalvage(null)
        await fetchWrecks()
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Salvage failed.')
        setConfirmSalvage(null)
      } finally {
        setActionBusy(null)
      }
    },
    [sendCommand, fetchWrecks]
  )

  const cargoUsed = state.ship?.cargo_used ?? 0
  const cargoCapacity = state.ship?.cargo_capacity ?? 0
  const cargoFull = cargoCapacity > 0 && cargoUsed >= cargoCapacity

  const headerRight = (
    <button
      className={shared.refreshBtn}
      onClick={fetchWrecks}
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
            const modules = normalizeModules(w.modules)
            const cargoEntries = w.cargo || []
            const timeRem = formatTimeRemaining(w.expires_at, w.expire_tick)
            const persistent = persistsForever(w.expire_tick)
            const towed = !!w.towed_by_player_id
            const label = describeWreck(w)
            const salvageBusy = actionBusy === `salvage:${w.id}`
            const confirming = confirmSalvage === w.id

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
                    {towed && <span className={shared.badgePurple}>Towed</span>}
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
                            const wearPct = typeof m.wear === 'number' ? Math.round(m.wear) : null
                            return (
                              <div key={m.id} className={shared.listCard}>
                                <span className={shared.listCardName}>
                                  {m.name || m.type_id || m.id}
                                </span>
                                <span className={shared.listCardMeta}>
                                  {m.type && <span>{m.type}</span>}
                                  {wearPct !== null && <span>wear {wearPct}%</span>}
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

                    {/* Salvage action */}
                    <div className={styles.salvageRow}>
                      {confirming ? (
                        <ConfirmAction
                          message="Salvage destroys the wreck for raw materials. Continue?"
                          icon={<AlertTriangle size={12} />}
                          onConfirm={() => handleSalvage(w)}
                          onCancel={() => setConfirmSalvage(null)}
                          confirmLabel={salvageBusy ? 'Salvaging...' : 'Salvage'}
                          cancelLabel="Cancel"
                          confirmDisabled={salvageBusy}
                          variant="danger"
                        />
                      ) : (
                        <button
                          className={shared.dangerBtn}
                          onClick={() => setConfirmSalvage(w.id)}
                          disabled={salvageBusy || isDocked}
                          type="button"
                          title={
                            isDocked
                              ? 'Undock before salvaging'
                              : 'Destroy the wreck for raw materials'
                          }
                        >
                          <Trash2 size={12} /> Salvage Wreck
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

      {/* Last-salvage result modal */}
      {lastSalvageResult && (
        <div className={shared.modalBackdrop} onClick={() => setLastSalvageResult(null)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <span className={shared.modalTitle}>
                <Hammer size={14} /> Salvage Complete
              </span>
              <button
                className={shared.modalClose}
                onClick={() => setLastSalvageResult(null)}
                aria-label="Close"
                type="button"
              >
                <X size={14} />
              </button>
            </div>
            <div className={shared.modalBody}>
              <div className={styles.salvageResultIntro}>
                Stripped <b>{lastSalvageResult.wreckLabel}</b> for parts.
              </div>
              <div className={styles.salvageResults}>
                <div className={styles.salvageResultRow}>
                  <span>Metal scrap</span>
                  <b>{lastSalvageResult.result.metal_scrap ?? 0}</b>
                </div>
                <div className={styles.salvageResultRow}>
                  <span>Components</span>
                  <b>{lastSalvageResult.result.components ?? 0}</b>
                </div>
                <div className={styles.salvageResultRow}>
                  <span>Rare materials</span>
                  <b>{lastSalvageResult.result.rare_materials ?? 0}</b>
                </div>
                {typeof lastSalvageResult.result.total_value === 'number' && (
                  <div className={styles.salvageResultRow}>
                    <span>Total value</span>
                    <b>{lastSalvageResult.result.total_value.toLocaleString()}c</b>
                  </div>
                )}
                {typeof lastSalvageResult.result.xp_gained === 'number' &&
                  lastSalvageResult.result.xp_gained > 0 && (
                  <div className={styles.salvageResultRow}>
                    <span>XP gained</span>
                    <b>+{lastSalvageResult.result.xp_gained}</b>
                  </div>
                )}
              </div>
            </div>
            <div className={shared.modalActions}>
              <button
                className={shared.confirmBtn}
                onClick={() => setLastSalvageResult(null)}
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
