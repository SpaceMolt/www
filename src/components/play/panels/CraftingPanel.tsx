'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Hammer, RefreshCw, AlertTriangle, Lock, Check, ChevronDown, ChevronRight,
  Search, Filter, Clock, RotateCcw, Trash2, Coins, Calculator, Package, Factory,
} from 'lucide-react'
import type {
  CraftJobResponse,
  CraftQueueResponse,
  CraftQuoteResponse,
  FacilityResponse,
  StorageResponse,
} from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery, useCurrentTick, useLocationState, useSkills } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { ProgressBar } from '../ProgressBar'
import { Panel, shared } from '../shared'
import { BugReportButton } from '../BugReportButton'
import { buildRecipeContext } from '../bugReportContext'
import type { Recipe, CraftJobView, CraftQuote, Facility } from '../types'
import { recipesById, formatItemId } from '@/data/catalog'
import { titleCase } from '@/lib/format'
import { canCraftRecipe, availableQuantity, type SkillEntry } from '@/lib/crafting'
import { estimateJobProgress } from './craftProgress'
import { FacilityVenuePicker } from './facilities/FacilityVenuePicker'
import styles from './CraftingPanel.module.css'

const HIDDEN_CATEGORIES = new Set(['facility only', 'ship passive'])

// Quote / craft / recycle direction for a recipe card.
type CraftMode = 'craft' | 'recycle'

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// craft()/recycle() share the same response-shape family (create-single,
// bulk-create, dry-run quote, queue-list, single-cancel, bulk-cancel); the
// spec publishes each variant as a named component, discriminated by `kind`.
type JobQueueVariant = CraftQueueResponse
type JobCreateVariant = CraftJobResponse
type JobQuoteVariant = CraftQuoteResponse

// `{ station_facilities: unknown }` uniquely identifies the facility-list
// variant within the FacilityResponse union.
type FacilityListResponse = Extract<FacilityResponse, { station_facilities: unknown }>
type ViewStorageResponse = Extract<StorageResponse, { items: unknown }>

export function CraftingPanel() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const currentTick = useCurrentTick()
  const dockedAt = useLocationState()?.docked_at ?? null
  const isDocked = Boolean(dockedAt)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'craftable'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [quotes, setQuotes] = useState<Record<string, CraftQuote | { error: string }>>({})

  // Venue (facility) selection per recipe — undefined = auto-route (Station
  // Workshop unless a facility is a better fit). Facility list is fetched
  // once per dock so the picker can show real backlog/pricing.
  const [selectedVenue, setSelectedVenue] = useState<Record<string, string>>({})
  const [venuePickerRecipeId, setVenuePickerRecipeId] = useState<string | null>(null)

  const reportError = useCallback((err: unknown) => {
    const text = describeError(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    uiStore.dispatch({ type: 'event', kind: 'danger', text })
  }, [uiStore])

  // Facility list (own/faction/public) — needed for the venue picker's
  // backlog/pricing info. Read-only, docked-scoped panel-local query.
  const { data: facilityListData } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_facility.list()
      return resp.structuredContent as FacilityListResponse | undefined
    },
    [dockedAt],
    { enabled: isDocked },
  )
  const facilities = useMemo(() => ({
    own: facilityListData?.player_facilities ?? [],
    faction: facilityListData?.faction_facilities ?? [],
    public: facilityListData?.public_facilities ?? [],
  }), [facilityListData])

  // When docked, fetch station storage — crafting escrows inputs from station
  // storage (NOT cargo), so the craftable filter and material counts read from
  // there. See gameserver crafting.go ("station-storage-centric, no cargo path").
  const { data: storageResp, refetch: refetchStorage } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_storage.view({})
      return resp.structuredContent as ViewStorageResponse | undefined
    },
    [dockedAt],
    { enabled: isDocked },
  )
  const storageItems = useMemo(() => (isDocked ? storageResp?.items ?? [] : []), [isDocked, storageResp])

  const skillsRaw = useSkills()
  const skillsMap = useMemo(() => {
    if (!skillsRaw) return undefined
    const result: Record<string, SkillEntry> = {}
    for (const [id, s] of Object.entries(skillsRaw)) {
      result[id] = { level: s.level ?? 0, xp: s.xp ?? 0, next_level_xp: s.next_level_xp ?? 0 }
    }
    return result
  }, [skillsRaw])

  // Queued jobs across all venues (craft action=queue). Panel-local — not
  // shared game state, since crafting_update pushes only carry a sparse
  // per-tick completion delta (no position/status/produces/facility_id), not
  // a full queue snapshot, so there's nothing to live-patch from. null = not
  // yet loaded.
  const [jobs, setJobs] = useState<CraftJobView[] | null>(null)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Crafting is queued, not instant. `craft` with no recipe returns the
  // player's job queue. It costs a mutation (1/tick), so we load it once on
  // mount and otherwise update optimistically + via an explicit refresh.
  const fetchQueue = useCallback(async () => {
    setJobsLoading(true)
    try {
      const result = await mutate((c) => c.spacemolt.craft({}), { label: 'craft_queue' })
      const details = result.delta.details as JobQueueVariant | undefined
      setJobs((details?.jobs ?? []).map((j): CraftJobView => ({ ...j, last_sync_tick: result.tick })))
    } catch (err) {
      reportError(err)
      setJobs([])
    }
    setJobsLoading(false)
  }, [mutate, reportError])

  useEffect(() => {
    if (jobs === null) fetchQueue()
  }, [jobs, fetchQueue])

  const getQty = useCallback((id: string) => Math.max(1, quantities[id] ?? 1), [quantities])
  const setQty = useCallback((id: string, q: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, Math.floor(q) || 1) }))
  }, [])

  const handleCraft = useCallback(async (recipeId: string, mode: CraftMode) => {
    const quantity = getQty(recipeId)
    const facilityId = selectedVenue[recipeId]
    setBusyId(recipeId)
    try {
      const result = mode === 'recycle'
        ? await mutate((c) => c.spacemolt.recycle({ id: recipeId, quantity, facility_id: facilityId }), { label: 'recycle' })
        : await mutate((c) => c.spacemolt.craft({ id: recipeId, quantity, facility_id: facilityId }), { label: 'craft' })
      const details = result.delta.details as JobCreateVariant | undefined
      if (details) {
        // Optimistically add the queued job (re-fetching would be rate-limited).
        const job: CraftJobView = {
          job_id: details.job_id,
          venue: details.venue,
          recipe: details.recipe,
          mode: details.mode,
          produces: details.produces,
          runs_total: details.runs,
          runs_done: 0,
          runs_remaining: details.runs,
          progress: 0,
          eta_ticks: Math.max(0, details.est_completion_tick - result.tick),
          position: (jobs?.length ?? 0) + 1,
          orderer: 'self',
          external: details.external,
          status: 'queued',
          facility_id: details.facility_id,
        }
        setJobs(prev => [...(prev ?? []), job])
        // Clear any stale quote for this recipe.
        setQuotes(prev => {
          const next = { ...prev }
          delete next[recipeId]
          return next
        })
      }
    } catch (err) {
      reportError(err)
    }
    setBusyId(null)
  }, [getQty, selectedVenue, mutate, jobs, reportError])

  const handleQuote = useCallback(async (recipeId: string, mode: CraftMode) => {
    const quantity = getQty(recipeId)
    const facilityId = selectedVenue[recipeId]
    setBusyId(recipeId)
    try {
      const result = mode === 'recycle'
        ? await mutate((c) => c.spacemolt.recycle({ id: recipeId, quantity, dry_run: true, facility_id: facilityId }), { label: 'recycle_quote' })
        : await mutate((c) => c.spacemolt.craft({ id: recipeId, quantity, dry_run: true, facility_id: facilityId }), { label: 'craft_quote' })
      const details = result.delta.details as JobQuoteVariant | undefined
      setQuotes(prev => ({
        ...prev,
        [recipeId]: details ?? { error: 'Quote failed' },
      }))
    } catch (err) {
      setQuotes(prev => ({ ...prev, [recipeId]: { error: describeError(err) } }))
    }
    setBusyId(null)
  }, [getQty, selectedVenue, mutate])

  const handleCancel = useCallback(async (jobId: string) => {
    setCancellingId(jobId)
    try {
      await mutate((c) => c.spacemolt.craft({ job_id: jobId }), { label: 'craft_cancel' })
      setJobs(prev => (prev ?? []).filter(j => j.job_id !== jobId))
    } catch (err) {
      reportError(err)
    }
    setCancellingId(null)
  }, [mutate, reportError])

  const recipes = useMemo((): Recipe[] => {
    return Object.values(recipesById)
      .filter(r => !HIDDEN_CATEGORIES.has((r.category || '').toLowerCase()))
      .map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category || '',
        required_skills: r.required_skills || {},
        inputs: (r.inputs || []).map(i => ({ item_id: i.item_id, quantity: i.quantity })),
        outputs: (r.outputs || []).map(o => ({ item_id: o.item_id, quantity: o.quantity })),
        crafting_time: r.crafting_time || 0,
      }))
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(recipes.map(r => r.category).filter(Boolean))
    return [...cats].sort()
  }, [recipes])

  // Filter, group by category, sort
  const groupedRecipes = useMemo(() => {
    const search = searchQuery.toLowerCase().trim()
    const withStatus = recipes.map((recipe) => ({
      recipe,
      ...canCraftRecipe(recipe, skillsMap, storageItems),
    }))

    let filtered = withStatus
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((r) => r.recipe.category === categoryFilter)
    }
    if (filter === 'craftable') {
      filtered = filtered.filter((r) => r.craftable)
    }
    if (search) {
      filtered = filtered.filter((r) =>
        r.recipe.name.toLowerCase().includes(search) ||
        r.recipe.id.toLowerCase().includes(search) ||
        (r.recipe.outputs ?? []).some(o =>
          o.item_id.toLowerCase().includes(search) ||
          formatItemId(o.item_id).toLowerCase().includes(search)
        ) ||
        (r.recipe.inputs ?? []).some(i =>
          i.item_id.toLowerCase().includes(search) ||
          formatItemId(i.item_id).toLowerCase().includes(search)
        )
      )
    }

    // Sort: craftable first, then alphabetical
    filtered.sort((a, b) => {
      if (a.craftable !== b.craftable) return a.craftable ? -1 : 1
      return a.recipe.name.localeCompare(b.recipe.name)
    })

    // Group by category
    const groups: Record<string, typeof filtered> = {}
    for (const item of filtered) {
      const cat = item.recipe.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [recipes, skillsMap, storageItems, filter, categoryFilter, searchQuery])

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const activeJobs = jobs ?? []

  return (
    <Panel
      title="Crafting"
      icon={<Hammer size={16} />}
      headerRight={
        <div className={styles.headerActions}>
          <button
            className={shared.refreshBtn}
            onClick={() => { store.account.refresh().catch(() => {}); if (isDocked) refetchStorage() }}
            title="Refresh skills & storage"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      }
    >
        {/* Queued jobs — crafting is asynchronous now */}
        <div className={styles.jobsSection}>
          <div className={styles.jobsHeader}>
            <span className={styles.jobsTitle}>
              <Clock size={12} /> Active Jobs
              {activeJobs.length > 0 && <span className={styles.jobsCount}>{activeJobs.length}</span>}
            </span>
            <button
              className={shared.refreshBtn}
              onClick={fetchQueue}
              disabled={jobsLoading}
              title="Refresh job queue"
              type="button"
            >
              <RefreshCw size={12} className={jobsLoading ? styles.spinning : undefined} />
            </button>
          </div>
          {activeJobs.length === 0 ? (
            <div className={styles.jobsEmpty}>
              {jobs === null
                ? (jobsLoading ? 'Loading jobs…' : 'Could not load jobs — tap refresh.')
                : 'No jobs queued. Crafting runs over several ticks once queued.'}
            </div>
          ) : (
            <div className={styles.jobsList}>
              {activeJobs.map((job) => {
                const total = Math.max(1, job.runs_total)
                const done = estimateJobProgress(job, currentTick, ticksPerRunFor(job.facility_id, facilities))
                return (
                  <div key={job.job_id} className={styles.jobCard}>
                    <div className={styles.jobTop}>
                      <span className={styles.jobName}>
                        {job.mode === 'recycle' && <RotateCcw size={11} className={styles.jobModeIcon} />}
                        {job.recipe}
                      </span>
                      <button
                        className={styles.jobCancel}
                        onClick={() => handleCancel(job.job_id)}
                        disabled={cancellingId === job.job_id}
                        title="Cancel job (refunds unconsumed materials, labor, and fees)"
                        type="button"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className={styles.jobMeta}>
                      <span>{job.venue || 'Workshop'}</span>
                      {job.external && <span className={styles.jobRented}>rented</span>}
                      <span>·</span>
                      <span>{job.runs_remaining} of {job.runs_total} runs left</span>
                      {job.eta_ticks > 0 && <><span>·</span><span>~{job.eta_ticks} ticks</span></>}
                    </div>
                    <ProgressBar value={done} max={total} size="sm" showText={false} color="cyan" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!isDocked && (
          <div className={styles.dockedWarning}>
            <span className={styles.dockedWarningIcon}>
              <AlertTriangle size={14} />
            </span>
            Dock at a base with crafting &amp; storage service to queue jobs. Materials are drawn from station storage.
          </div>
        )}

        {/* Search + filter */}
        {recipes.length > 0 && (
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <Search size={12} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Search recipes or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.categorySelect}>
              <Filter size={10} className={styles.categorySelectIcon} />
              <select
                className={styles.categoryDropdown}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter('all')}
                type="button"
              >
                All
              </button>
              <button
                className={`${styles.filterBtn} ${filter === 'craftable' ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter('craftable')}
                type="button"
              >
                <Check size={10} /> Craftable
              </button>
            </div>
          </div>
        )}

        {groupedRecipes.length === 0 && (
          <div className={shared.emptyState}>
            {searchQuery || filter === 'craftable' || categoryFilter !== 'all'
              ? 'No recipes match your filters.'
              : 'No recipes available.'}
          </div>
        )}

        {/* Recipe categories as accordions */}
        {groupedRecipes.map(([category, items]) => {
          const isCollapsed = collapsedCategories.has(category)
          const craftableCount = items.filter(r => r.craftable).length
          return (
            <div key={category} className={styles.categoryGroup}>
              <button
                className={styles.categoryHeader}
                onClick={() => toggleCategory(category)}
                type="button"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className={styles.categoryName}>{category}</span>
                <span className={styles.categoryCount}>
                  {craftableCount > 0 && <span className={styles.craftableCount}>{craftableCount} craftable</span>}
                  {items.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className={styles.recipeGrid}>
                  {items.map(({ recipe, craftable, reasons }) => {
                    const isExpanded = expandedId === recipe.id
                    const qty = getQty(recipe.id)
                    const quote = quotes[recipe.id]
                    const busy = busyId === recipe.id
                    return (
                      <div
                        key={recipe.id}
                        className={`${styles.recipeCard} ${craftable ? styles.recipeCardCraftable : styles.recipeCardLocked}`}
                      >
                        {/* header is a div, not a button: BugReportButton renders
                            a <button> and buttons cannot nest */}
                        <div className={styles.recipeCardHeader}>
                          <button
                            className={styles.recipeCardToggle}
                            onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                            type="button"
                            title={craftable ? 'You can craft this' : reasons.join('; ')}
                          >
                            <div className={styles.recipeCardTitle}>
                              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              <span className={styles.recipeName}>{recipe.name}</span>
                            </div>
                          </button>
                          <BugReportButton contextType="recipe" entityName={recipe.name} entityContext={buildRecipeContext(recipe)} />
                        </div>

                        {isExpanded && (
                          <div className={styles.recipeCardBody}>
                            {recipe.description && (
                              <div className={styles.recipeDesc}>{recipe.description}</div>
                            )}
                            <div className={styles.recipeRow}>
                              <span className={styles.recipeLabel}>In:</span>
                              <span className={styles.recipeInputs}>
                                {(recipe.inputs ?? []).map((i) => {
                                  const name = formatItemId(i.item_id)
                                  const have = availableQuantity(i.item_id, storageItems)
                                  const enough = have >= i.quantity
                                  return (
                                    <span key={i.item_id} className={enough ? styles.inputOk : styles.inputMissing}>
                                      {name} x{i.quantity}{!enough && ` (${have})`}
                                    </span>
                                  )
                                })}
                                {(recipe.inputs ?? []).length === 0 && 'None'}
                              </span>
                            </div>
                            <div className={styles.recipeRow}>
                              <span className={styles.recipeLabel}>Out:</span>
                              <span className={styles.recipeOutputs}>
                                {(recipe.outputs ?? []).map((o) => {
                                  const name = formatItemId(o.item_id)
                                  return `${name} x${o.quantity}`
                                }).join(', ') || 'None'}
                              </span>
                            </div>
                            {recipe.required_skills && Object.keys(recipe.required_skills).length > 0 && (
                              <div className={styles.recipeRow}>
                                <span className={styles.recipeLabel}>Skills:</span>
                                <span className={styles.recipeSkills}>
                                  {Object.entries(recipe.required_skills)
                                    .map(([skill, level]) => {
                                      const name = titleCase(skill)
                                      const have = skillsMap?.[skill]?.level ?? 0
                                      const met = have >= (level as number)
                                      return (
                                        <span key={skill} className={met ? styles.skillMet : styles.skillUnmet}>
                                          {name} Lv{level as number}{!met && ` (have ${have})`}
                                        </span>
                                      )
                                    })}
                                </span>
                              </div>
                            )}
                            {!craftable && reasons.length > 0 && (
                              <div className={styles.reasonsList}>
                                <Lock size={10} />
                                {reasons.map((r, i) => (
                                  <span key={i} className={styles.reasonItem}>{r}</span>
                                ))}
                              </div>
                            )}

                            {/* Quote result */}
                            {quote && ('error' in quote ? (
                              <div className={styles.reasonsList}>
                                <AlertTriangle size={10} />
                                <span className={styles.reasonItem}>{quote.error}</span>
                              </div>
                            ) : (
                              <div className={styles.quoteBox}>
                                <div className={styles.quoteRow}>
                                  <span className={styles.quoteLabel}><Package size={10} /> Venue</span>
                                  <span>{quote.venue} · {quote.runs} run{quote.runs === 1 ? '' : 's'}</span>
                                </div>
                                <div className={styles.quoteRow}>
                                  <span className={styles.quoteLabel}><Coins size={10} /> Cost</span>
                                  <span className={quote.have_credits ? undefined : styles.quoteShort}>
                                    {quote.credits_total > 0
                                      ? `${quote.credits_total.toLocaleString()} cr${quote.cost?.fee ? ` (${quote.cost.labor ?? 0} labor + ${quote.cost.fee} fee)` : ''}`
                                      : 'free'}
                                  </span>
                                </div>
                                <div className={styles.quoteRow}>
                                  <span className={styles.quoteLabel}><Clock size={10} /> ETA</span>
                                  <span>~{Math.max(0, quote.est_completion_tick - currentTick)} ticks</span>
                                </div>
                                {(!quote.have_inputs || !quote.have_credits) && (
                                  <div className={styles.quoteWarn}>
                                    {!quote.have_inputs && 'Missing materials in storage. '}
                                    {!quote.have_credits && 'Not enough credits.'}
                                  </div>
                                )}
                              </div>
                            ))}

                            <div className={styles.craftControls}>
                              <button
                                type="button"
                                className={styles.quoteBtn}
                                onClick={() => setVenuePickerRecipeId(recipe.id)}
                                title="Choose which facility (or Station Workshop) queues this craft"
                              >
                                <Factory size={11} /> {venueName(selectedVenue[recipe.id], facilities)}
                              </button>
                              <div className={styles.qtyStepper}>
                                <button
                                  type="button"
                                  className={styles.qtyBtn}
                                  onClick={() => setQty(recipe.id, qty - 1)}
                                  disabled={qty <= 1}
                                  aria-label="Decrease quantity"
                                >−</button>
                                <input
                                  className={styles.qtyInput}
                                  type="number"
                                  min={1}
                                  value={qty}
                                  onChange={(e) => setQty(recipe.id, Number(e.target.value))}
                                  aria-label="Quantity"
                                />
                                <button
                                  type="button"
                                  className={styles.qtyBtn}
                                  onClick={() => setQty(recipe.id, qty + 1)}
                                  aria-label="Increase quantity"
                                >+</button>
                              </div>
                              <button
                                type="button"
                                className={styles.quoteBtn}
                                onClick={() => handleQuote(recipe.id, 'craft')}
                                disabled={busy}
                                title="Get a cost & time estimate without queuing"
                              >
                                <Calculator size={11} /> Quote
                              </button>
                              <ActionButton
                                label="Recycle"
                                icon={<RotateCcw size={12} />}
                                onClick={() => handleCraft(recipe.id, 'recycle')}
                                disabled={!isDocked || busy}
                                variant="secondary"
                                size="sm"
                              />
                              <ActionButton
                                label="Craft"
                                icon={<Hammer size={12} />}
                                onClick={() => handleCraft(recipe.id, 'craft')}
                                disabled={!isDocked || !craftable || busy}
                                loading={busy}
                                size="sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {venuePickerRecipeId && (
          <FacilityVenuePicker
            recipeName={recipesById[venuePickerRecipeId]?.name || venuePickerRecipeId}
            ownFacilities={facilities.own.filter(f => f.production?.recipe === venuePickerRecipeId)}
            factionFacilities={facilities.faction.filter(f => f.production?.recipe === venuePickerRecipeId)}
            publicFacilities={facilities.public.filter(f => f.production?.recipe === venuePickerRecipeId)}
            selected={selectedVenue[venuePickerRecipeId]}
            onSelect={(facilityId) => {
              setSelectedVenue(prev => {
                const next = { ...prev }
                if (facilityId) next[venuePickerRecipeId] = facilityId
                else delete next[venuePickerRecipeId]
                return next
              })
            }}
            onClose={() => setVenuePickerRecipeId(null)}
          />
        )}
    </Panel>
  )
}

interface FacilityLists {
  own: Facility[]
  faction: Facility[]
  public: Facility[]
}

/** Resolve a selected facility_id to a display label for the venue button. */
function venueName(facilityId: string | undefined, facilities: FacilityLists): string {
  if (!facilityId) return 'Station Workshop'
  const all = [...facilities.own, ...facilities.faction, ...facilities.public]
  const match = all.find(f => f.facility_id === facilityId)
  return match ? (match.custom_name || match.name) : 'Station Workshop'
}

/**
 * Look up a job's venue's own per-run duration for progress interpolation.
 * Station Workshop (no facility_id) has no client-visible rate — its speed
 * depends on player skills — so this returns undefined there rather than
 * guessing.
 */
function ticksPerRunFor(facilityId: string, facilities: FacilityLists): number | undefined {
  if (!facilityId) return undefined
  const all = [...facilities.own, ...facilities.faction, ...facilities.public]
  return all.find(f => f.facility_id === facilityId)?.production?.ticks_per_run
}
