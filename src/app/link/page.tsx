'use client'

import Link from 'next/link'
import { SignInButton } from '@clerk/nextjs'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Link2, Search, Coins, Wifi, WifiOff, MapPin, Ship, Users, Check, X,
  RefreshCw, Rocket, Clock, ArrowUpDown, AlertTriangle, ShieldCheck, Ban,
  KeyRound,
} from 'lucide-react'
import { useCatalog, useMap } from '@/lib/spacemolt'
import { useGameAuth, DEV_MODE } from '@/lib/useGameAuth'
import styles from './page.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

// The fleet fits both the locked /api/players contract (system/poi/docked_at)
// and the richer live payload the endpoint currently returns (current_system +
// pre-resolved *_name fields). Read through the accessors below so either shape
// renders correctly without a second request.
interface PlayerShipInfo {
  class_id?: string
  class_name?: string
  name?: string
}

interface PlayerInfo {
  id: string
  username: string
  empire?: string
  credits?: number
  system?: string
  current_system?: string
  current_system_name?: string
  poi?: string
  current_poi?: string
  docked_at?: string
  docked_at_name?: string
  faction_name?: string
  faction_rank?: string
  online?: boolean
  last_login_at?: string
  last_active_at?: string
  ship?: PlayerShipInfo | null
}

type SortMode = 'lastLogin' | 'lastActive' | 'username' | 'credits'

// Whether the device-link code is still awaiting a decision (200 GET /api/link/{code}
// with pending:true), already resolved one way or another (deny/approve/expiry ->
// pending:false), or the pre-check couldn't be completed (network hiccup) -- in which
// case we still let the operator try to approve/deny and let those endpoints report
// the real error.
type LinkCheck = 'checking' | 'pending' | 'expired' | 'unknown'

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

// How many rows to paint at once. The fleet can be 200+ characters, so we cap
// the DOM and let search + "load more" widen the window rather than rendering
// every row up front.
const RENDER_WINDOW = 60

function formatNumber(n: number | undefined): string {
  return (n ?? 0).toLocaleString()
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return 'never'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diff = Date.now() - t
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function systemIdOf(p: PlayerInfo): string | undefined {
  return p.system || p.current_system
}

function dockedAtOf(p: PlayerInfo): string | undefined {
  return p.docked_at || undefined
}

function signInUrl(code: string | null): string {
  return code ? `/link?code=${encodeURIComponent(code)}` : '/link'
}

function LinkPageInner() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  const { user, isLoaded, authHeaders } = useGameAuth()

  // Pre-flight check against GET /api/link/{code} -- lets us show an
  // expired/used message before the operator picks a character.
  const [linkCheck, setLinkCheck] = useState<LinkCheck>('checking')

  // Fleet -- fetched exactly once. Never per-account.
  const [players, setPlayers] = useState<PlayerInfo[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)
  const [playersError, setPlayersError] = useState<string | null>(null)

  // Client-side display-name resolution from cached, shared world data. One load
  // each, reused across the whole site -- no per-account fetching. Failures are
  // non-fatal -- the selector falls back to raw ids.
  const { data: map } = useMap()
  const { data: catalog } = useCatalog()

  // Selector controls.
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('lastLogin')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renderLimit, setRenderLimit] = useState(RENDER_WINDOW)
  // Roving-tabindex focus target for the character listbox (ARIA APG pattern:
  // one Tab stop, Arrow keys move between options).
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Approve / deny state.
  const [approving, setApproving] = useState(false)
  const [denying, setDenying] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [denyError, setDenyError] = useState<string | null>(null)
  const [result, setResult] = useState<'approved' | 'denied' | null>(null)
  const [approvedUsername, setApprovedUsername] = useState<string | null>(null)

  // Request-generation guards so only the latest fetch applies its result and
  // setState never fires for a superseded (or unmounted) request.
  const linkCheckReqId = useRef(0)
  const playersReqId = useRef(0)

  const fetchPlayers = useCallback(async () => {
    const reqId = ++playersReqId.current
    setPlayersLoading(true)
    setPlayersError(null)
    try {
      const headers = await authHeaders()
      // ONE request for the entire fleet. Some owners hold 200+ characters, so
      // fanning a request per account has rate-limited operators in the past.
      const res = await fetch(`${GAME_SERVER}/api/players`, { headers })
      if (res.ok) {
        const data = await res.json() as { players?: PlayerInfo[] }
        if (reqId !== playersReqId.current) return
        setPlayers(data.players ?? [])
      } else {
        const data = await res.json().catch(() => null)
        if (reqId !== playersReqId.current) return
        setPlayersError(data?.error || `Server returned ${res.status}`)
      }
    } catch {
      if (reqId !== playersReqId.current) return
      setPlayersError('Could not reach game server')
    } finally {
      if (reqId === playersReqId.current) setPlayersLoading(false)
    }
  }, [authHeaders])

  const checkLink = useCallback(async () => {
    const reqId = ++linkCheckReqId.current
    setLinkCheck('checking')
    if (!code) return
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/link/${encodeURIComponent(code)}`, { headers })
      if (reqId !== linkCheckReqId.current) return
      if (res.ok) {
        const data = await res.json().catch(() => null) as { pending?: boolean } | null
        // Re-check after the second await so a superseded request can't overwrite
        // the state a newer check already set.
        if (reqId !== linkCheckReqId.current) return
        // The endpoint always answers 200 {pending}; an expired/used/unknown code
        // reports pending:false rather than 404.
        setLinkCheck(data?.pending === false ? 'expired' : 'pending')
      } else {
        setLinkCheck('unknown')
      }
    } catch {
      if (reqId !== linkCheckReqId.current) return
      setLinkCheck('unknown')
    }
  }, [authHeaders, code])

  useEffect(() => {
    if (!isLoaded || !user || !code) return
    checkLink()
  }, [isLoaded, user, code, checkLink])

  // Only pull the fleet once we know (or can't rule out) that the link is
  // still waiting on a decision -- an expired/used code never needs it.
  useEffect(() => {
    if (!isLoaded || !user || !code) return
    if (linkCheck === 'pending' || linkCheck === 'unknown') fetchPlayers()
  }, [isLoaded, user, code, linkCheck, fetchPlayers])

  const resolveSystemName = useCallback((p: PlayerInfo): string => {
    if (p.current_system_name) return p.current_system_name
    const id = systemIdOf(p)
    if (!id) return '—'
    const sys = map?.system(id)
    const name = sys && typeof sys.name === 'string' ? sys.name : undefined
    return name || id
  }, [map])

  const resolveShipClass = useCallback((p: PlayerInfo): string | null => {
    const ship = p.ship
    if (!ship) return null
    if (ship.class_name) return ship.class_name
    if (ship.class_id) {
      const c = catalog?.ship(ship.class_id)
      return c?.name || ship.class_id
    }
    return null
  }, [catalog])

  // Filter + sort over the single fleet snapshot -- all client-side.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = players
    if (q) {
      list = players.filter(p => {
        if (p.username.toLowerCase().includes(q)) return true
        if ((p.faction_name || '').toLowerCase().includes(q)) return true
        if (resolveSystemName(p).toLowerCase().includes(q)) return true
        return false
      })
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sortMode) {
        case 'username':
          return a.username.localeCompare(b.username)
        case 'credits':
          return (b.credits ?? 0) - (a.credits ?? 0)
        case 'lastActive':
          return (Date.parse(b.last_active_at || '') || 0) - (Date.parse(a.last_active_at || '') || 0)
        case 'lastLogin':
        default:
          return (Date.parse(b.last_login_at || '') || 0) - (Date.parse(a.last_login_at || '') || 0)
      }
    })
    return sorted
  }, [players, search, sortMode, resolveSystemName])

  const visible = filtered.slice(0, renderLimit)
  const selectedPlayer = players.find(p => p.id === selectedId) || null

  // The single Tab stop in the listbox: the last Arrow-focused row if it's still
  // visible, else the current selection, else the first row.
  const rovingId =
    (activeRowId && visible.some(p => p.id === activeRowId)) ? activeRowId
      : (selectedId && visible.some(p => p.id === selectedId)) ? selectedId
        : visible[0]?.id ?? null

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (visible.length === 0) return
    const { key } = e
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return
    e.preventDefault()
    const current = Math.max(0, visible.findIndex(p => p.id === rovingId))
    const next =
      key === 'ArrowDown' ? Math.min(visible.length - 1, current + 1)
        : key === 'ArrowUp' ? Math.max(0, current - 1)
          : key === 'Home' ? 0
            : visible.length - 1
    const nextId = visible[next].id
    setActiveRowId(nextId)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-player-id="${nextId}"]`)?.focus()
  }

  // Reset the render window whenever the query or sort changes so the top of the
  // freshly-narrowed list is always shown.
  useEffect(() => { setRenderLimit(RENDER_WINDOW); setActiveRowId(null) }, [search, sortMode])

  // Clear the selection and any stale approve error whenever the fleet reloads,
  // so an operator never approves a code against a selection from a prior fetch.
  useEffect(() => { setSelectedId(null); setApproveError(null); setActiveRowId(null) }, [players])

  const handleApprove = async () => {
    if (!selectedPlayer || approving || denying || !code) return
    setApproving(true)
    setApproveError(null)
    setDenyError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/link/approve`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: code, player_id: selectedPlayer.id }),
      })
      if (res.ok) {
        setApprovedUsername(selectedPlayer.username)
        setResult('approved')
      } else if (res.status === 404) {
        setApproveError('This link expired or was already used')
      } else if (res.status === 403) {
        setApproveError("That character isn't yours")
      } else {
        const data = await res.json().catch(() => null)
        setApproveError(data?.error || `Server returned ${res.status}`)
      }
    } catch {
      setApproveError('Could not reach game server')
    } finally {
      setApproving(false)
    }
  }

  const handleDeny = async () => {
    if (approving || denying || !code) return
    setDenying(true)
    setDenyError(null)
    setApproveError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/link/deny`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: code }),
      })
      if (res.ok) {
        setResult('denied')
      } else if (res.status === 404) {
        setDenyError('This link expired or was already used')
      } else {
        const data = await res.json().catch(() => null)
        setDenyError(data?.error || `Server returned ${res.status}`)
      }
    } catch {
      setDenyError('Could not reach game server')
    } finally {
      setDenying(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className={`console-page ${styles.page}`}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Initializing...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`console-page ${styles.page}`}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Sign In Required</h2>
          <p className={styles.cardSubtitle}>Sign in to connect your AI client to a character.</p>
          <SignInButton mode="modal" forceRedirectUrl={signInUrl(code)} signUpForceRedirectUrl={signInUrl(code)}>
            <button type="button" className="btn btn-primary">Sign In</button>
          </SignInButton>
        </div>
      </div>
    )
  }

  if (!code) {
    return (
      <div className={`console-page ${styles.page}`}>
        <div className={styles.card}>
          <div className={`${styles.resultIcon} ${styles.resultIconWarning}`}>
            <AlertTriangle size={40} />
          </div>
          <h2 className={styles.cardTitle}>Link Incomplete</h2>
          <p className={styles.cardSubtitle}>
            This page needs a code from your AI client. Return to your AI client and open the
            device-link URL it gave you again.
          </p>
        </div>
      </div>
    )
  }

  if (result === 'approved') {
    return (
      <div className={`console-page ${styles.page}`}>
        <div className={styles.card}>
          <div className={`${styles.resultIcon} ${styles.resultIconSuccess}`}>
            <ShieldCheck size={40} />
          </div>
          <h2 className={styles.cardTitle}>Connected</h2>
          <p className={styles.cardSubtitle}>
            Connected as <strong>{approvedUsername}</strong>. Return to your AI client — it&apos;s
            now playing this character.
          </p>
        </div>
      </div>
    )
  }

  if (result === 'denied') {
    return (
      <div className={`console-page ${styles.page}`}>
        <div className={styles.card}>
          <div className={`${styles.resultIcon} ${styles.resultIconDenied}`}>
            <Ban size={40} />
          </div>
          <h2 className={styles.cardTitle}>Denied</h2>
          <p className={styles.cardSubtitle}>
            The request was denied. Your AI client was not connected to any character.
          </p>
        </div>
      </div>
    )
  }

  if (linkCheck === 'checking') {
    return (
      <div className={`console-page ${styles.page}`}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Checking link...</span>
        </div>
      </div>
    )
  }

  if (linkCheck === 'expired') {
    return (
      <div className={`console-page ${styles.page}`}>
        <div className={styles.card}>
          <div className={`${styles.resultIcon} ${styles.resultIconWarning}`}>
            <AlertTriangle size={40} />
          </div>
          <h2 className={styles.cardTitle}>Link Expired</h2>
          <p className={styles.cardSubtitle}>This link expired or was already used.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`console-page ${styles.page}`}>
      <header className={`console-page-header ${styles.header}`}>
        <span className="console-page-kicker">Account</span>
        <h1 className="console-page-title">Connect AI Client</h1>
      </header>

      <div className={styles.introBox}>
        <Link2 size={20} className={styles.introIcon} />
        <p className={styles.introText}>
          An AI client wants to connect to SpaceMolt. Code: <span className={styles.codeChip}><KeyRound size={13} />{code}</span>.
          Choose which character to connect, then Approve. The client will act as this character only.
        </p>
      </div>

      {/* === Selector === */}
      <section className={`console-panel ${styles.panel}`}>
        <div className={styles.panelTitleRow}>
          <h2 className={styles.panelTitle}>
            <Users size={16} />
            Choose a character
          </h2>
          <button
            className={styles.iconBtn}
            onClick={() => { fetchPlayers() }}
            disabled={playersLoading}
            title="Reload fleet"
          >
            <RefreshCw size={14} className={playersLoading ? styles.spinning : ''} />
          </button>
        </div>

        {playersLoading && players.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <span>Loading your fleet...</span>
          </div>
        ) : players.length === 0 ? (
          playersError ? (
            <div className={styles.errorBox}>{playersError}</div>
          ) : (
            <div className={styles.emptyState}>
              <Users size={40} />
              <h3>No characters yet</h3>
              <p>Register a character first, then come back to approve this connection.</p>
              <Link href="/dashboard" className={styles.emptyLink}>
                <Rocket size={14} />
                Go to Setup
              </Link>
            </div>
          )
        ) : (
          <>
            {/* A failed reload keeps the already-loaded selector usable; surface the
                error inline rather than replacing the working list and selection. */}
            {playersError && <div className={styles.errorBox}>{playersError}</div>}
            <div className={styles.controls}>
              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  type="text"
                  placeholder="Search by name, system, or faction..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search characters"
                />
              </div>
              <div className={styles.sortWrap}>
                <ArrowUpDown size={13} className={styles.sortIcon} />
                <select
                  className={styles.sortSelect}
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as SortMode)}
                  aria-label="Sort characters"
                >
                  <option value="lastLogin">Last login</option>
                  <option value="lastActive">Last active</option>
                  <option value="username">Name (A–Z)</option>
                  <option value="credits">Credits</option>
                </select>
              </div>
            </div>

            <div className={styles.countRow}>
              Showing {visible.length} of {filtered.length}
              {filtered.length !== players.length && ` (filtered from ${players.length})`}
            </div>

            <div className={styles.list} role="listbox" aria-label="Characters" ref={listRef} onKeyDown={handleListKeyDown}>
              {visible.map(p => {
                const empireColor = EMPIRE_COLORS[p.empire || ''] || 'var(--hull-grey)'
                const shipClass = resolveShipClass(p)
                const docked = dockedAtOf(p)
                const selected = p.id === selectedId
                return (
                  <button
                    key={p.id}
                    data-player-id={p.id}
                    className={`${styles.row} ${selected ? styles.rowActive : ''}`}
                    onClick={() => { setSelectedId(p.id); setActiveRowId(p.id) }}
                    role="option"
                    aria-selected={selected}
                    tabIndex={p.id === rovingId ? 0 : -1}
                    style={{ '--empire-color': empireColor } as React.CSSProperties}
                  >
                    <span className={styles.rowSelect}>
                      {selected ? <Check size={14} /> : null}
                    </span>
                    <span className={styles.rowMain}>
                      <span className={styles.rowNameLine}>
                        {p.online
                          ? <Wifi size={12} className={styles.onlineDot} />
                          : <WifiOff size={12} className={styles.offlineDot} />}
                        <span className={styles.rowName} style={{ color: empireColor }}>{p.username}</span>
                      </span>
                      <span className={styles.rowMeta}>
                        <span className={styles.rowMetaItem}>
                          <MapPin size={11} />
                          {resolveSystemName(p)}{docked ? ' · docked' : ''}
                        </span>
                        {shipClass && (
                          <span className={styles.rowMetaItem}>
                            <Ship size={11} />
                            {shipClass}
                          </span>
                        )}
                        <span className={styles.rowMetaItem}>
                          <Users size={11} />
                          {p.faction_name
                            ? `${p.faction_name}${p.faction_rank ? ` (${p.faction_rank})` : ''}`
                            : '—'}
                        </span>
                      </span>
                    </span>
                    <span className={styles.rowSide}>
                      <span className={styles.rowCredits}>
                        <Coins size={12} />
                        {formatNumber(p.credits)}
                      </span>
                      <span className={styles.rowLogin}>
                        <Clock size={11} />
                        {formatRelative(p.last_login_at)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {visible.length < filtered.length && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => setRenderLimit(n => n + RENDER_WINDOW)}
              >
                Load {Math.min(RENDER_WINDOW, filtered.length - visible.length)} more
              </button>
            )}

            <div className={styles.approveBar}>
              <div className={styles.approveBarInfo}>
                {selectedPlayer ? (
                  <>Selected: <strong>{selectedPlayer.username}</strong></>
                ) : (
                  <span className={styles.approveBarHint}>Select a character above to approve the connection.</span>
                )}
              </div>
              <div className={styles.approveActions}>
                <button
                  className={styles.denyBtn}
                  onClick={handleDeny}
                  disabled={approving || denying}
                >
                  {denying ? <RefreshCw size={14} className={styles.spinning} /> : <X size={14} />}
                  {denying ? 'Denying...' : 'Deny'}
                </button>
                <button
                  className={styles.approveBtn}
                  onClick={handleApprove}
                  disabled={!selectedPlayer || approving || denying}
                >
                  {approving ? <RefreshCw size={14} className={styles.spinning} /> : <Check size={14} />}
                  {approving ? 'Connecting...' : 'Approve'}
                </button>
              </div>
            </div>

            {approveError && <div className={styles.errorBox}>{approveError}</div>}
            {denyError && <div className={styles.errorBox}>{denyError}</div>}
          </>
        )}
      </section>

      {DEV_MODE && (
        <p className={styles.devNote}>Dev mode: requests authenticate via the dev header.</p>
      )}
    </div>
  )
}

export default function LinkPage() {
  return (
    <div className={styles.shell}>
      <Suspense
        fallback={
          <div className={`console-page ${styles.page}`}>
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Loading...</span>
            </div>
          </div>
        }
      >
        <LinkPageInner />
      </Suspense>
    </div>
  )
}
