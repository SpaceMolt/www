'use client'

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  MapPin,
  Globe,
  ArrowRight,
  Anchor,
  Pickaxe,
  Swords,
  Radar,
  ChevronDown,
  Navigation,
  Fuel,
  Wrench,
  Search,
  Compass,
  Database,
  Radiation,
  Snowflake,
  Wind,
  SlidersHorizontal,
  X,
  AlertTriangle,
} from 'lucide-react'
import type { FactionQueryIntelResponse, MapSystemInfo, ScanContact, ScanResponse } from '@spacemolt/lib'
import {
  useAccountStore,
  useCargo,
  useCommandMutation,
  useCurrentTick,
  useLocationState,
  useMap,
  useModules,
  usePendingAction,
  usePlayer,
  usePoi,
  useShip,
  useSystem,
} from '@/lib/spacemolt'
import { usePlay } from './PlayProvider'
import { ProgressBar } from './ProgressBar'
import { transitDestination } from './TravelProgress'
import type { GalaxyPanelHandle, MapSystemData, PlannedRoute } from './panels/GalaxyPanel'
import { findRoute, jumpEstimateMs, travelEstimateMs } from './routeWalk'
import { useLoop } from './loop/useLoopRunner'
import { rememberPois } from './loop/loopPlan'
import { shortcutKey } from './shortcuts'
import { titleCase as formatLabel } from '@/lib/format'
import styles from './LeftSidebar.module.css'
import { depositTitle, rateRichness } from './richness'
import { getItem, getShip, type RawCatalogItem } from '@/data/catalog'
import { errorMessage, Modal, shared } from './shared'
import { useFittedModules, useStationServices } from './hooks/useGates'

// Intel query response entries — shaped by the faction intel query, not a
// cached state section.
type IntelEntry = FactionQueryIntelResponse['entries'][number]

export const EMPIRE_NAMES: Record<string, string> = {
  solarian: 'Solarian Confederacy',
  voidborn: 'Voidborn Collective',
  crimson: 'Crimson Pact',
  nebula: 'Nebula Trade Federation',
  outerrim: 'Outer Rim Explorers',
}

export type SidebarTab = 'current' | 'explore'

/**
 * True when the current POI has mineable deposits, i.e. when the Mine and
 * Mine Until Full actions are meaningful.
 *
 * Read off the `location` state section rather than the `get_poi` query. The
 * mining actions once hung off `get_poi`'s POI blob, so when the gameserver
 * briefly deprecated `get_poi` (server v0.433.0, restored in v0.435.1) both
 * buttons silently vanished for every player (dc#457858). `location` is a
 * core state section pushed on every action_result delta, so the affordance
 * can no longer be taken out by a single query command changing shape.
 */
export function hasMineableResources(
  location: { resources?: unknown[] } | undefined | null,
): boolean {
  return Boolean(location?.resources && location.resources.length > 0)
}

interface LeftSidebarProps {
  galaxyRef: RefObject<GalaxyPanelHandle | null>
  exploreSystem: MapSystemData | null
  onExploreSystemChange: (system: MapSystemData | null) => void
  plannedRoute: PlannedRoute | null
  onPlannedRouteChange: (route: PlannedRoute | null) => void
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  autoTravelActive: boolean
  onHighlightedSystemsChange?: (systems: Set<string> | null) => void
  /** Phone only: show the sidebar as a drawer. */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

type SupplyKind = 'refuel' | 'repair'
interface SupplyArgs { id?: string; quantity?: number; target?: string }

/** Supply items a refuel/repair can burn, matched by id the way the server names them. */
const SUPPLY_ITEM = { refuel: /fuel_cell/, repair: /repair|hull_patch/ } as const
/** The module the server requires to refuel or repair another ship (gameserver handlers/ship.go). */
const TARGET_MODULE = { refuel: 'refueling_pump', repair: 'repair_arm' } as const

/** Icon and extractor for each kind of deposit, by the catalog's extracted_by. */
const DEPOSIT_KIND = {
  mining: { Icon: Pickaxe, label: 'Ore: mined with a mining laser', className: styles.kindOre, noun: 'ore', extractor: 'a Mining Laser' },
  ice: { Icon: Snowflake, label: 'Ice: needs an Ice Harvester', className: styles.kindIce, noun: 'ice', extractor: 'an Ice Harvester' },
  gas: { Icon: Wind, label: 'Gas: needs a Gas Harvester', className: styles.kindGas, noun: 'gas', extractor: 'a Gas Harvester' },
  rad: { Icon: Radiation, label: 'Radioactive: needs a Rad Harvester', className: styles.kindRad, noun: 'radioactives', extractor: 'a Rad Harvester' },
} as const
type DepositKind = keyof typeof DEPOSIT_KIND

function depositKind(itemId: string): DepositKind {
  const by = getItem(itemId)?.extracted_by
  return by && by in DEPOSIT_KIND ? by as DepositKind : 'mining'
}

/** Whether the hull carries an inherent special flag (gameserver ShipClass.HasInherentFlag). */
function hullHasFlag(shipClassId: string | undefined, flag: string): boolean {
  return Boolean(getShip(shipClassId ?? '')?.inherent_capabilities?.some((c) => c.type === 'special_flag' && 'flag' in c && c.flag === flag))
}

/** Deposit kinds the fitted modules and hull can extract (gameserver State.ExtractionCapabilities). */
export function extractionKinds(fitted: RawCatalogItem[], shipClassId: string | undefined): DepositKind[] {
  return (Object.keys(DEPOSIT_KIND) as DepositKind[]).filter((kind) => kind === 'mining'
    ? fitted.some((m) => m.type === 'mining')
    : fitted.some((m) => m.special?.includes(`${kind}_harvesting`)) || (kind === 'rad' && hullHasFlag(shipClassId, 'rad_harvesting')))
}

/** Why mining these deposits must fail with this loadout, or null when something fitted can extract one of them. */
export function mineWarning(itemIds: string[], kinds: DepositKind[]): string | null {
  const needed = [...new Set(itemIds.map(depositKind))]
  if (needed.length === 0 || needed.some((k) => kinds.includes(k))) return null
  const names = (key: 'noun' | 'extractor') => needed.map((k) => DEPOSIT_KIND[k][key]).join(' or ')
  return `Nothing fitted can extract ${names('noun')} here: fit ${names('extractor')}`
}

/** Buff stats that grant survey (gameserver CalcSurveyPower and HandleSurveySystem). */
const SURVEY_BUFFS = ['survey_power', 'navigation_beacon', 'anomaly_detection']

/** Survey needs survey power or an anomaly detector, from a module, the hull, or a consumable buff (gameserver HandleSurveySystem). */
export function canSurvey(fitted: RawCatalogItem[], shipClassId: string | undefined, buffs: { stat: string; amount: number }[] = []): boolean {
  return fitted.some((m) => (m.survey_power ?? 0) > 0 || m.special === 'anomaly_detection') ||
    buffs.some((b) => SURVEY_BUFFS.includes(b.stat) && b.amount > 0) ||
    Boolean(getShip(shipClassId ?? '')?.inherent_capabilities?.some((c) => c.type === 'integrated_survey_scanner' && c.value > 0)) ||
    hullHasFlag(shipClassId, 'anomaly_detection')
}

function DepositIcon({ itemId }: { itemId: string }) {
  const { Icon, label, className } = DEPOSIT_KIND[depositKind(itemId)]
  return <Icon size={10} className={`${styles.depositIcon} ${className}`}><title>{label}</title></Icon>
}

/** A deposit's rating, colored by level, and the units left ('Depleted' when empty). Yield and refill are in the hover text. */
function DepositRating({ itemId, richness, remaining }: { itemId: string; richness: number; remaining?: number }) {
  if (remaining === 0) return <span className={styles.depositDepleted}>Depleted</span>
  const { level, label } = rateRichness(itemId, richness)
  return (
    <>
      <span className={`${styles.depositRating} ${styles[`richness${level}`]}`}>{label}</span>
      {remaining !== undefined && <span className={styles.depositQty}>{remaining.toLocaleString()}</span>}
    </>
  )
}

/** Refuel or repair another ship (needs a Refueling Pump / Repair Arm): target, quantity and, for repair, which kit. */
function SupplyOptions({ kind, nearby, cargo, busy, onSubmit }: {
  kind: SupplyKind
  nearby: { player_id: string; username: string }[]
  cargo: { item_id: string; item_name: string; quantity: number }[]
  busy: boolean
  onSubmit: (args: SupplyArgs) => void
}) {
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [targetChoice, setTarget] = useState('')
  const target = nearby.some((p) => p.player_id === targetChoice) ? targetChoice : nearby[0]?.player_id ?? ''
  // Ship-to-ship refuel pumps from your own tank; ship-to-ship repair burns a kit from cargo.
  const items = kind === 'repair' ? cargo.filter((c) => SUPPLY_ITEM.repair.test(c.item_id)) : []
  const qty = parseInt(quantity, 10)
  return (
    <div className={styles.supplyOptions}>
      <select className={styles.supplyInput} value={target} onChange={(e) => setTarget(e.target.value)} aria-label={`${kind} target`}>
        {nearby.map((p) => <option key={p.player_id} value={p.player_id}>{p.username}</option>)}
      </select>
      {items.length > 1 && (
        <select className={styles.supplyInput} value={itemId} onChange={(e) => setItemId(e.target.value)} aria-label="Repair kit">
          <option value="">Cheapest kit</option>
          {items.map((c) => <option key={c.item_id} value={c.item_id}>{c.item_name} ({c.quantity})</option>)}
        </select>
      )}
      <input className={styles.supplyInput} type="number" min={1} placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Quantity" />
      <button
        className={styles.actionBtn}
        disabled={busy || !target}
        onClick={() => onSubmit({ target, ...(itemId && { id: itemId }), ...(qty > 0 && { quantity: qty }) })}
        type="button"
      >
        {kind === 'refuel' ? <Fuel size={13} /> : <Wrench size={13} />}
        <span>{kind === 'refuel' ? 'Refuel' : 'Repair'} them</span>
      </button>
    </div>
  )
}

// useCommandMutation's runner returns the generic MutationResult shape
// (details: Record<string, unknown>), not the per-command typed response —
// narrow the optional `message` field defensively.
function detailMessage(details: unknown): string | undefined {
  const message = (details as { message?: unknown } | undefined)?.message
  return typeof message === 'string' ? message : undefined
}

/** What a scan revealed about one ship; the server omits fields above the contest margin. */
function scanRows(s: ScanContact | ScanResponse): [string, string][] {
  const rows: [string, string | number | undefined][] = [
    ['Pilot', s.username],
    ['Ship', s.ship_name],
    ['Class', s.ship_class && formatLabel(s.ship_class)],
    ['Hull', s.hull],
    ['Shield', s.shield],
    ['Cloaked', s.cloaked === undefined ? undefined : s.cloaked ? 'Yes' : 'No'],
    ['Cargo', 'cargo_types' in s ? s.cargo_types?.map(formatLabel).join(', ') : undefined],
  ]
  return rows.filter((r): r is [string, string | number] => r[1] !== undefined && r[1] !== '').map(([k, v]) => [k, String(v)])
}

/** ScanResponse.reason (cargo scans; gameserver protocol ScanResultPayload). A plain failed scan has none. */
const SCAN_FAILED: Record<string, string> = {
  evaded: 'Scan failed: the target evaded your sensors.',
  target_left: 'Scan failed: the target left, docked or boarded a carrier.',
  target_lost: 'Scan failed: the target cloaked beyond your sensors.',
  scanner_left: 'Scan failed: you left the POI, docked or boarded a carrier.',
}

function ScanResultModal({ scan, onClose }: { scan: ScanResponse; onClose: () => void }) {
  const ships = [scan, ...(scan.contacts ?? [])].map(scanRows).filter((rows) => rows.length > 0)
  return (
    <Modal title="Scan results" icon={<Radar size={14} />} onClose={onClose}>
      {(scan.message || scan.description) && <p className={shared.listCardMeta}>{scan.message || scan.description}</p>}
      {ships.length === 0 && (
        <div className={shared.emptyState}>
          {scan.success === false ? SCAN_FAILED[(scan as { reason?: string }).reason ?? ''] ?? 'Scan failed: your sensors could not resolve the target.' : 'The scan revealed nothing.'}
        </div>
      )}
      {ships.map((rows, i) => (
        <div key={i} className={shared.listCard} style={{ flexDirection: 'column', alignItems: 'stretch', marginTop: '0.4rem' }}>
          {rows.map(([k, v]) => (
            <div key={k} className={shared.listCardMeta} style={{ justifyContent: 'space-between' }}>
              <span>{k}</span><span className={shared.listCardName}>{v}</span>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  )
}

export function LeftSidebar({ galaxyRef, exploreSystem, onExploreSystemChange, plannedRoute, onPlannedRouteChange, activeTab, onTabChange, autoTravelActive, onHighlightedSystemsChange, mobileOpen = false, onMobileClose }: LeftSidebarProps) {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const ship = useShip()
  const modules = useModules()
  const location = useLocationState()
  const pendingAction = usePendingAction()
  const currentTick = useCurrentTick()
  const systemQuery = useSystem()
  const poiQuery = usePoi()
  const [expandedPoi, setExpandedPoi] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MapSystemInfo[]>([])
  const [supplyOpen, setSupplyOpen] = useState<SupplyKind | null>(null)
  const [scanTarget, setScanTarget] = useState('')
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null)
  const cargo = useCargo() ?? []
  const services = useStationServices()
  const fitted = useFittedModules()
  const loop = useLoop()
  const { data: galaxyMap } = useMap()

  // Intel state
  const [intelLevel, setIntelLevel] = useState<number>(0)
  const [intelResults, setIntelResults] = useState<IntelEntry[] | null>(null)
  const [intelSearching, setIntelSearching] = useState(false)
  const [selectedSystemIntel, setSelectedSystemIntel] = useState<IntelEntry | null>(null)
  const intelStatusFetched = useRef(false)

  // Switch to Explore tab when a system is selected from the map
  useEffect(() => {
    if (exploreSystem) onTabChange('explore')
  }, [exploreSystem, onTabChange])

  // Fetch intel status on mount to determine intel level
  useEffect(() => {
    if (intelStatusFetched.current || !player?.faction_id) return
    intelStatusFetched.current = true
    store.account.commands.spacemolt_intel.intel_status().then((result) => {
      const level = result.structuredContent?.intel_level
      if (typeof level === 'number') setIntelLevel(level)
    }).catch(() => {})
  }, [player?.faction_id, store])

  // Fetch intel for selected system
  useEffect(() => {
    if (!exploreSystem || intelLevel < 2) {
      setSelectedSystemIntel(null)
      return
    }
    let cancelled = false
    store.account.commands.spacemolt_intel.query_intel({ system_id: exploreSystem.id, limit: 1 }).then((r) => {
      if (cancelled) return
      const entries = r.structuredContent?.entries
      setSelectedSystemIntel(entries && entries.length > 0 ? entries[0] : null)
    }).catch(() => { if (!cancelled) setSelectedSystemIntel(null) })
    return () => { cancelled = true }
  }, [exploreSystem, intelLevel, store])

  // Intel search: debounced query when search changes
  const hasIntel = intelLevel >= 2
  useEffect(() => {
    if (!hasIntel || !searchQuery.trim()) {
      setIntelResults(null)
      setIntelSearching(false)
      onHighlightedSystemsChange?.(null)
      return
    }

    setIntelSearching(true)
    const query = searchQuery.trim()
    const resourceId = query.toLowerCase().replace(/\s+/g, '_')

    let cancelled = false
    const timer = setTimeout(() => {
      store.account.commands.spacemolt_intel.query_intel({ resource_type: resourceId, limit: 100 }).then((r) => {
        if (cancelled) return
        const entries = r.structuredContent?.entries
        if (entries && entries.length > 0) {
          setIntelResults(entries)
          onHighlightedSystemsChange?.(new Set(entries.map(e => e.system_id)))
        } else {
          setIntelResults(null)
          onHighlightedSystemsChange?.(null)
        }
        setIntelSearching(false)
      }).catch(() => {
        if (cancelled) return
        setIntelResults(null)
        setIntelSearching(false)
        onHighlightedSystemsChange?.(null)
      })
    }, 400)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [searchQuery, hasIntel, store, onHighlightedSystemsChange])

  const handleIntelResultSelect = useCallback((entry: IntelEntry) => {
    const systems = galaxyRef.current?.getSystems() ?? []
    const mapSys = systems.find(s => s.id === entry.system_id)
    if (mapSys) {
      onExploreSystemChange(mapSys)
      setSearchQuery('')
      setIntelResults(null)
      onHighlightedSystemsChange?.(null)
      onTabChange('explore')
      galaxyRef.current?.panToSystem(mapSys.id)
    }
  }, [galaxyRef, onExploreSystemChange, onTabChange, onHighlightedSystemsChange])

  const systemData = systemQuery.data
  const system = systemData && 'system' in systemData ? systemData.system : undefined

  // Remember every visited system's POIs so Autopilot can target them from anywhere.
  useEffect(() => {
    if (system) rememberPois(player?.id, system.pois.map((p) => ({ id: p.id, name: p.base_name || p.name, systemId: system.id, systemName: system.name })))
  }, [system, player?.id])
  const poiData = poiQuery.data
  const poi = poiData && 'poi' in poiData ? poiData.poi : undefined
  // Deposit capacity comes from get_poi; the live stock comes from the location state.
  const capacityOf = (itemId: string) => poiData?.resources?.find((r) => r.resource_id === itemId)?.max_remaining

  const isDocked = Boolean(location?.docked_at)
  const isTraveling = Boolean(location?.in_transit)
  const actionBusy = pendingAction !== null || autoTravelActive
  const mineIssue = mineWarning((location?.resources ?? []).map((r) => r.item_id), extractionKinds(fitted, ship?.class_id))
  const surveyable = canSurvey(fitted, ship?.class_id, ship?.active_buffs)
  // Refuel/repair can act only at a station with the service, from cargo supplies,
  // or on a nearby ship with the transfer module (gameserver HandleRefuel / HandleRepair).
  const canTransfer = (kind: SupplyKind) => Boolean(location?.nearby_players?.length) && Boolean(modules?.some((m) => m.type_id === TARGET_MODULE[kind]))
  /**
   * Ways to top up your own ship, mirroring gameserver handlers/ship.go: docked at a station with the
   * service it uses the station; otherwise it burns cells/kits from cargo. Docked, a named fuel cell
   * overrides the station, but station repair ignores a named kit, so no kit button where the station repairs.
   */
  const selfSupply = (kind: SupplyKind): { label: string; args: SupplyArgs }[] => {
    const [now, max] = kind === 'refuel' ? [ship?.fuel ?? 0, ship?.max_fuel ?? 0] : [ship?.hull ?? 0, ship?.max_hull ?? 0]
    if (now >= max) return []
    const verb = kind === 'refuel' ? 'Refuel' : 'Repair'
    const station = isDocked && services.includes(kind)
    const item = cargo.find((c) => SUPPLY_ITEM[kind].test(c.item_id))
    const itemWord = kind === 'refuel' ? 'fuel cells' : 'repair kits'
    return [
      ...(station ? [{ label: `${verb} at station`, args: {} }] : []),
      ...(item && !(station && kind === 'repair')
        ? [{ label: station ? `${verb} with ${itemWord}` : verb, args: station ? { id: item.item_id } : {} }]
        : []),
    ]
  }
  const supplyKinds = (['refuel', 'repair'] as const).filter((kind) => selfSupply(kind).length > 0 || canTransfer(kind))

  const travelDestination = transitDestination(location, pendingAction?.target, system?.pois)
  const transitElapsed = location?.transit_ticks_elapsed ?? 0
  const transitArrivalTick = location?.transit_arrival_tick
  const transitEta = transitArrivalTick !== undefined ? Math.max(0, transitArrivalTick - currentTick) : null
  const transitTotalTicks = transitEta !== null ? transitElapsed + transitEta : null
  const travelProgress =
    transitTotalTicks && transitTotalTicks > 0 ? Math.max(0, Math.min(100, (transitElapsed / transitTotalTicks) * 100)) : 0

  const logEvent = useCallback((text?: string) => {
    if (text) uiStore.dispatch({ type: 'event', kind: 'info', text })
  }, [uiStore])

  const reportError = useCallback((err: unknown) => {
    const text = errorMessage(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
  }, [uiStore])

  const handleTravel = useCallback(
    async (poiId: string) => {
      const targetPoi = system?.pois.find((p) => p.id === poiId)
      let estimatedMs: number | undefined
      if (poi?.position?.x !== undefined && poi.position.y !== undefined && targetPoi?.position) {
        estimatedMs = travelEstimateMs(poi.position, targetPoi.position, ship?.speed ?? 1)
      }
      const name = targetPoi?.base_name || targetPoi?.name || 'destination'
      logEvent(`Traveling to ${name}...`)
      onMobileClose?.() // the drawer would hide the progress banner and toasts
      try {
        const result = await mutate((c) => c.spacemolt.travel({ id: poiId }), { label: 'travel', estimatedMs, target: name })
        logEvent(detailMessage(result.delta.details) || `Arrived at ${name}`)
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, system, poi, ship?.speed, logEvent, reportError, onMobileClose],
  )

  const handleJump = useCallback(
    async (systemId: string, systemName: string) => {
      const estimatedMs = jumpEstimateMs(ship?.speed ?? 1)
      logEvent(`Jumping to ${systemName}...`)
      onMobileClose?.()
      try {
        const result = await mutate((c) => c.spacemolt.jump({ id: systemId }), { label: 'jump', estimatedMs, target: systemName })
        logEvent(detailMessage(result.delta.details) || `Jumped to ${systemName}`)
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, ship?.speed, logEvent, reportError, onMobileClose],
  )

  const handleDock = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.dock(), { label: 'dock' })
      logEvent(`Docked at ${result.delta.details?.base || 'base'}`)
      if (result.delta.details?.gifts_note) logEvent(result.delta.details.gifts_note)
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleUndock = useCallback(async () => {
    try {
      await mutate((c) => c.spacemolt.undock(), { label: 'undock' })
      logEvent('Undocked from station')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleMine = useCallback(async () => {
    logEvent('Mining...')
    onMobileClose?.()
    try {
      const result = await mutate((c) => c.spacemolt.mine(), { label: 'mine' })
      logEvent(detailMessage(result.delta.details) || 'Mining complete')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError, onMobileClose])

  const handleSurvey = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.survey_system(), { label: 'survey_system' })
      logEvent(detailMessage(result.delta.details) || 'Survey complete')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleRefuel = useCallback(async (args: SupplyArgs = {}) => {
    try {
      const result = await mutate((c) => c.spacemolt.refuel(args), { label: 'refuel' })
      logEvent(detailMessage(result.delta.details) || 'Refueled')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleRepair = useCallback(async (args: SupplyArgs = {}) => {
    try {
      const result = await mutate((c) => c.spacemolt.repair(args), { label: 'repair' })
      logEvent(detailMessage(result.delta.details) || 'Repaired')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleScan = useCallback(async () => {
    const targetId = scanTarget || location?.nearby_players?.[0]?.player_id
    if (!targetId) return
    try {
      const result = await mutate((c) => c.spacemolt.scan({ id: targetId }), { label: 'scan' })
      logEvent(detailMessage(result.delta.details) || 'Scan complete')
      if (result.delta.details) setScanResult(result.delta.details)
    } catch (err) {
      reportError(err)
    }
  }, [mutate, scanTarget, location, logEvent, reportError])

  const handleMineUntilFull = useCallback(() => {
    loop.start({ name: 'Mine until full', steps: [{ kind: 'mine' }], repeat: 1 })
    onMobileClose?.()
  }, [loop, onMobileClose])

  // Ship-action shortcuts; panel keys and help live in HUD.
  const shortcutsRef = useRef<Record<string, () => void>>({})
  shortcutsRef.current = actionBusy ? {} : {
    d: () => { if (poi?.base_id) void (isDocked ? handleUndock() : handleDock()) },
    m: () => { if (!isDocked && hasMineableResources(location)) void handleMine() },
    f: () => { const [first] = selfSupply('refuel'); if (first) void handleRefuel(first.args) },
    r: () => { const [first] = selfSupply('repair'); if (first) void handleRepair(first.args) },
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = shortcutKey(e)
      if (key && !document.querySelector('[role="dialog"]')) shortcutsRef.current[key]?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handlePlotCourse = useCallback(async () => {
    if (!exploreSystem) return
    try {
      const route = await findRoute(store.account, exploreSystem.id)
      if (route) onPlannedRouteChange(route)
      else reportError(new Error(`No known route to ${exploreSystem.name}`))
    } catch (err) {
      reportError(err)
    }
  }, [exploreSystem, store, onPlannedRouteChange, reportError])

  const togglePoiExpand = useCallback((poiId: string) => {
    setExpandedPoi((prev) => (prev === poiId ? null : poiId))
  }, [])

  const handleSearchSelect = useCallback(
    (sys: MapSystemData) => {
      onExploreSystemChange(sys)
      setSearchQuery('')
      onTabChange('explore')
      galaxyRef.current?.panToSystem(sys.id)
    },
    [galaxyRef, onExploreSystemChange, onTabChange],
  )

  // Server-side name search (search_systems), debounced; map data gives the pan target.
  useEffect(() => {
    const text = searchQuery.trim()
    if (!text) { setSearchResults([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      store.account.commands.spacemolt.search_systems({ text })
        .then((r) => { if (!cancelled) setSearchResults(r.structuredContent?.systems ?? []) })
        .catch(() => { if (!cancelled) setSearchResults([]) })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [searchQuery, store])

  const selectSearchResult = (result: MapSystemInfo) => {
    const sys = galaxyRef.current?.getSystems().find((s) => s.id === result.system_id)
    handleSearchSelect(sys ?? {
      id: result.system_id, name: result.name, x: result.position.x, y: result.position.y,
      empire: result.empire, is_stronghold: result.is_stronghold, connections: result.connections,
    })
  }

  return (
    <>
    {scanResult && <ScanResultModal scan={scanResult} onClose={() => setScanResult(null)} />}
    <div className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <button className={styles.drawerClose} onClick={onMobileClose} type="button" aria-label="Close navigation">
          <X size={14} />
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'current' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('current')}
        >
          <MapPin size={12} />
          <span>System</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'explore' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('explore')}
        >
          <Compass size={12} />
          <span>Explore</span>
        </button>
      </div>

      {/* Current System Tab */}
      <div className={styles.tabContent} style={{ display: activeTab === 'current' ? 'flex' : 'none' }}>
        {/* Current Location */}
        <div className={styles.location}>
          {system ? (
            <>
              <div className={styles.systemName}>{system.name}</div>
              <div className={styles.systemMeta}>
                {system.empire && (
                  <span className={styles.metaTag}>{system.empire}</span>
                )}
                <span className={styles.metaTag}>
                  {system.security_status || `Sec ${system.police_level}`}
                </span>
                {isDocked && (
                  <span className={styles.dockedBadge}>Docked</span>
                )}
              </div>
              {poi && (
                <div className={styles.currentPoiBlock}>
                  <div className={styles.currentPoi}>
                    <MapPin size={12} />
                    <span>{poi.name}</span>
                    <span className={styles.poiType}>{poi.type}{poi.class ? ` · ${poi.class}` : ''}</span>
                  </div>
                  {poi.description && (
                    <div className={styles.poiDescription}>{poi.description}</div>
                  )}
                  {hasMineableResources(location) && (
                    <div className={styles.resourceList}>
                      {location?.resources?.map((r) => (
                        <div key={r.item_id} className={`${styles.resourceItem} ${r.remaining === 0 ? styles.depleted : ''}`} title={depositTitle(r.item_id, r.richness, r.remaining, capacityOf(r.item_id))}>
                          <DepositIcon itemId={r.item_id} />
                          <span className={styles.resourceName}>{r.item_name || r.item_id}</span>
                          <DepositRating itemId={r.item_id} richness={r.richness} remaining={r.remaining} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>No system data</div>
          )}
        </div>

        {/* Travel Progress */}
        {isTraveling && (
          <div className={styles.travelBar}>
            <div className={styles.travelLabel}>
              <Navigation size={11} />
              <span>→ {travelDestination}</span>
            </div>
            <ProgressBar
              value={travelProgress}
              max={100}
              color="purple"
              size="sm"
              showText={false}
            />
          </div>
        )}

        {/* Contextual Actions */}
        <div className={styles.actions}>
          <div className={styles.sectionLabel}>Actions</div>

          {/* Dock / Undock */}
          {poi?.base_id && (
            isDocked ? (
              <button
                className={styles.actionBtn}
                onClick={handleUndock}
                disabled={actionBusy}
                type="button"
              >
                <ArrowRight size={13} />
                <span>Undock</span>
              </button>
            ) : (
              <button
                className={styles.actionBtn}
                onClick={handleDock}
                disabled={actionBusy}
                type="button"
              >
                <Anchor size={13} />
                <span>Dock</span>
              </button>
            )
          )}

          {/* Mine — only when undocked and POI has resources */}
          {!isDocked && hasMineableResources(location) && (
            <>
              <button
                className={styles.actionBtn}
                onClick={handleMine}
                disabled={actionBusy}
                title={mineIssue ?? undefined}
                type="button"
              >
                <Pickaxe size={13} />
                <span>Mine</span>
                {mineIssue && <AlertTriangle size={12} className={styles.mineWarning} aria-label={mineIssue} />}
              </button>
              <button
                className={styles.actionBtn}
                onClick={handleMineUntilFull}
                disabled={actionBusy}
                title={mineIssue ?? undefined}
                type="button"
              >
                <Pickaxe size={13} />
                <span>Mine Until Full</span>
                {mineIssue && <AlertTriangle size={12} className={styles.mineWarning} aria-label={mineIssue} />}
              </button>
            </>
          )}

          {/* Scan — only when undocked and there are nearby targets */}
          {!isDocked && location?.nearby_players && location.nearby_players.length > 0 && (
            <div className={styles.supplyRow}>
              <select
                className={styles.supplyInput}
                value={scanTarget || location.nearby_players[0].player_id}
                onChange={(e) => setScanTarget(e.target.value)}
                aria-label="Scan target"
              >
                {location.nearby_players.map((p) => (
                  <option key={p.player_id} value={p.player_id}>{p.username}</option>
                ))}
              </select>
              <button
                className={styles.actionBtn}
                onClick={handleScan}
                disabled={actionBusy}
                type="button"
              >
                <Swords size={13} />
                <span>Scan</span>
              </button>
            </div>
          )}

          {/* Survey */}
          {surveyable && (
            <button
              className={styles.actionBtn}
              onClick={handleSurvey}
              disabled={actionBusy}
              type="button"
            >
              <Radar size={13} />
              <span>Survey System</span>
            </button>
          )}

          {/* Refuel / Repair: one button per way to top up your own ship; the options menu services other ships. */}
          {ship && supplyKinds.map((kind) => {
            const [now, max] = kind === 'refuel' ? [ship.fuel, ship.max_fuel] : [ship.hull, ship.max_hull]
            const Icon = kind === 'refuel' ? Fuel : Wrench
            const handle = kind === 'refuel' ? handleRefuel : handleRepair
            const verb = kind === 'refuel' ? 'Refuel' : 'Repair'
            return (
              <div key={kind}>
                <div className={styles.supplyRow}>
                  {selfSupply(kind).map((opt) => (
                    <button key={opt.label} className={styles.actionBtn} onClick={() => void handle(opt.args)} disabled={actionBusy} type="button">
                      <Icon size={13} />
                      <span>{opt.label} ({now}/{max})</span>
                    </button>
                  ))}
                  {canTransfer(kind) && (
                    <button
                      className={styles.supplyToggle}
                      onClick={() => setSupplyOpen((open) => (open === kind ? null : kind))}
                      aria-expanded={supplyOpen === kind}
                      aria-label={`${verb} another ship`}
                      title={`${verb} another ship`}
                      type="button"
                    >
                      <SlidersHorizontal size={13} />
                    </button>
                  )}
                </div>
                {supplyOpen === kind && canTransfer(kind) && (
                  <SupplyOptions
                    kind={kind}
                    nearby={location?.nearby_players ?? []}
                    cargo={cargo}
                    busy={actionBusy}
                    onSubmit={(args) => void (kind === 'refuel' ? handleRefuel(args) : handleRepair(args))}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* POIs */}
        {system && system.pois.length > 0 && (
          <div className={styles.poiSection}>
            <div className={styles.sectionLabel}>Points of Interest</div>
            <div className={styles.poiList}>
              {system.pois.map((p, i) => {
                const isActive = poi?.id === p.id
                const isExpanded = expandedPoi === p.id
                return (
                  <div key={p.id || `poi-${i}`} className={styles.poiEntry}>
                    <button
                      type="button"
                      className={`${styles.poiItem} ${isActive ? styles.poiItemActive : ''}`}
                      onClick={() => togglePoiExpand(p.id)}
                    >
                      {p.has_base ? <Anchor size={12} className={styles.poiIcon} /> : <MapPin size={12} className={styles.poiIcon} />}
                      <span className={styles.poiName}>{p.name}</span>
                      <span className={styles.poiType}>{p.type}</span>
                      {(p.ship_count ?? 0) > 0 && (
                        <span className={styles.poiOnline} title="Ships on scanner">{p.ship_count}</span>
                      )}
                      <ChevronDown
                        size={12}
                        className={`${styles.poiChevron} ${isExpanded ? styles.poiChevronOpen : ''}`}
                      />
                    </button>
                    {isExpanded && (
                      <div className={styles.poiDetails}>
                        <div className={styles.poiDetailRow}>
                          <span className={styles.poiDetailLabel}>Type</span>
                          <span>{p.type}{p.class ? ` (${p.class})` : ''}</span>
                        </div>
                        {p.base_name && (
                          <div className={styles.poiDetailRow}>
                            <span className={styles.poiDetailLabel}>Station</span>
                            <span>{p.base_name}</span>
                          </div>
                        )}
                        {p.position && (
                          <div className={styles.poiDetailRow}>
                            <span className={styles.poiDetailLabel}>Position</span>
                            <span>{p.position.x?.toFixed(1)}, {p.position.y?.toFixed(1)} AU</span>
                          </div>
                        )}
                        {(p.ship_count ?? 0) > 0 && (
                          <div className={styles.poiDetailRow}>
                            <span className={styles.poiDetailLabel}>Ships</span>
                            <span>{p.ship_count}</span>
                          </div>
                        )}
                        {!isActive && (
                          <button
                            className={styles.poiTravelBtn}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTravel(p.id)
                            }}
                            disabled={actionBusy}
                            type="button"
                          >
                            <ArrowRight size={12} /> Travel Here
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Connected Systems */}
        {system && system.connections.length > 0 && (
          <div className={styles.connectionsSection}>
            <div className={styles.sectionLabel}>Connections</div>
            <div className={styles.connectionList}>
              {system.connections.map((conn) => (
                <button
                  type="button"
                  key={conn.system_id}
                  className={styles.connectionItem}
                  onClick={() => handleJump(conn.system_id, conn.name)}
                >
                  <Globe size={12} />
                  <span className={styles.connectionName}>{conn.name}</span>
                  {conn.distance !== undefined && (
                    <span className={styles.connectionDist}>{conn.distance} GU</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Explore Tab */}
      <div className={styles.tabContent} style={{ display: activeTab === 'explore' ? 'flex' : 'none' }}>
        {/* Search */}
        <div className={styles.exploreSearch}>
          <div className={styles.searchInputWrapper}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={hasIntel ? 'Search systems or resources…' : 'Search systems…'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value === '') onExploreSystemChange(null)
              }}
            />
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className={styles.searchResults}>
              {/* System name matches */}
              {searchResults.length > 0 && (
                <>
                  {hasIntel && <div className={styles.searchSectionLabel}>Systems</div>}
                  {searchResults.map((sys) => (
                    <button
                      key={sys.system_id}
                      className={styles.searchResultItem}
                      onClick={() => selectSearchResult(sys)}
                    >
                      <span className={styles.searchResultName}>{sys.name}</span>
                      {sys.visited && <span className={styles.searchResultEmpire}>visited</span>}
                      {sys.empire && (
                        <span className={styles.searchResultEmpire}>
                          {EMPIRE_NAMES[sys.empire] || sys.empire}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Intel resource matches */}
              {hasIntel && intelSearching && (
                <div className={styles.searchSectionLabel}>
                  <Database size={10} /> Searching intel…
                </div>
              )}
              {hasIntel && !intelSearching && intelResults && intelResults.length > 0 && (() => {
                const normalizedQuery = searchQuery.trim().toLowerCase().replace(/\s+/g, '_')
                return (
                  <>
                    <div className={styles.searchSectionLabel}>
                      <Database size={10} /> Intel — {intelResults.length} system{intelResults.length !== 1 ? 's' : ''} with resource
                    </div>
                    {intelResults.map((entry) => (
                      <button
                        key={entry.system_id}
                        className={styles.searchResultItem}
                        onClick={() => handleIntelResultSelect(entry)}
                      >
                        <span className={styles.searchResultName}>{entry.name}</span>
                        <span className={styles.searchResultIntelDetail}>
                          {(entry.pois ?? [])
                            .flatMap((p) => p.resources ?? [])
                            .filter(r => r.resource_id.toLowerCase().includes(normalizedQuery))
                            .slice(0, 2)
                            .map(r => `${formatLabel(r.resource_id)} ×${r.richness}`)
                            .join(', ')}
                        </span>
                      </button>
                    ))}
                  </>
                )
              })()}

              {searchResults.length === 0 && !intelSearching && (!intelResults || intelResults.length === 0) && (
                <div className={styles.searchEmpty}>No results found</div>
              )}
            </div>
          )}
        </div>

        {/* Selected System Detail */}
        {exploreSystem && !searchQuery && (
          <div className={styles.systemDetail}>
            <div className={styles.systemDetailName}>{exploreSystem.name}</div>
            {exploreSystem.empire && (
              <div className={styles.systemDetailEmpire}>
                {EMPIRE_NAMES[exploreSystem.empire] || exploreSystem.empire}
              </div>
            )}
            <div className={styles.systemDetailTags}>
              {exploreSystem.is_home && (
                <span className={styles.detailTag}>Capital</span>
              )}
              {exploreSystem.has_station && (
                <span className={styles.detailTag}>Station</span>
              )}
              {exploreSystem.is_stronghold && (
                <span className={styles.detailTagDanger}>Pirate Stronghold</span>
              )}
              {!exploreSystem.empire && !exploreSystem.is_stronghold && (
                <span className={styles.detailTag}>Neutral Space</span>
              )}
            </div>
            <button
              className={styles.plotCourseBtn}
              onClick={handlePlotCourse}
              disabled={actionBusy}
              type="button"
            >
              <Navigation size={13} />
              <span>Plot a Course</span>
            </button>

            {/* Intel detail for selected system */}
            {selectedSystemIntel && (
              <div className={styles.intelSection}>
                <div className={styles.sectionLabel}>
                  <Database size={10} /> Faction Intel
                </div>
                <div className={styles.intelMeta}>
                  <span className={styles.metaTag}>Sec {selectedSystemIntel.police_level}</span>
                  {selectedSystemIntel.empire && (
                    <span className={styles.metaTag}>{selectedSystemIntel.empire}</span>
                  )}
                  <span className={styles.intelSubmitter}>
                    by {selectedSystemIntel.submitter_name}
                  </span>
                </div>

                {(selectedSystemIntel.pois ?? []).length > 0 && (
                  <div className={styles.intelPoiList}>
                    {(selectedSystemIntel.pois ?? []).map((p) => (
                      <div key={p.id} className={styles.intelPoiItem}>
                        <div className={styles.intelPoiHeader}>
                          <MapPin size={10} />
                          <span className={styles.intelPoiName}>{p.name}</span>
                          <span className={styles.intelPoiType}>
                            {p.type}{p.class ? ` · ${p.class}` : ''}
                          </span>
                        </div>
                        {p.base_name && (
                          <div className={styles.intelPoiStation}>
                            <Anchor size={9} /> {p.base_name}
                          </div>
                        )}
                        {p.resources && p.resources.length > 0 && (
                          <div className={styles.intelResourceList}>
                            {p.resources.map((r) => (
                              <div key={r.resource_id} className={`${styles.intelResourceItem} ${r.remaining === 0 ? styles.depleted : ''}`} title={depositTitle(r.resource_id, r.richness, r.remaining, r.max_remaining)}>
                                <DepositIcon itemId={r.resource_id} />
                                <span className={styles.intelResourceName}>{formatLabel(r.resource_id)}</span>
                                <DepositRating itemId={r.resource_id} richness={r.richness} remaining={r.remaining} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={styles.systemDetailConnections}>
              <div className={styles.sectionLabel}>Connections</div>
              {exploreSystem.connections.length > 0 ? (
                <div className={styles.connectionList}>
                  {exploreSystem.connections.map((connId: string) => {
                    const connSys = galaxyRef.current?.getSystems().find((s) => s.id === connId)
                    return (
                      <button
                        type="button"
                        key={connId}
                        className={styles.connectionItem}
                        onClick={() => {
                          if (connSys) handleSearchSelect(connSys)
                        }}
                      >
                        <Globe size={12} />
                        <span className={styles.connectionName}>{connSys?.name || galaxyMap?.system(connId)?.name || formatLabel(connId)}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>No connections</div>
              )}
            </div>
          </div>
        )}

        {/* Empty state when nothing selected */}
        {!exploreSystem && !searchQuery && (
          <div className={styles.exploreEmpty}>
            <Search size={24} className={styles.exploreEmptyIcon} />
            <div>{hasIntel ? 'Search for systems or resources' : 'Search for a system to view its details'}</div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
