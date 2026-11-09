'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Hammer, RefreshCw, AlertTriangle, Lock, Check, ChevronDown, ChevronRight,
  Search, Filter, Clock, RotateCcw, Trash2, Coins, Calculator, Package, Factory,
  ArrowDownToLine, ListPlus, X,
} from 'lucide-react'
import type {
  BulkCraftResponse,
  BulkJobCancelResponse,
  CraftJobResponse,
  CraftQueueResponse,
  FacilityResponse,
  StorageResponse,
} from '@spacemolt/lib'
import { useAccountStore, useCargo, useCommandMutation, useCommandQuery, useCurrentTick, useLocationState, useSkills } from '@/lib/spacemolt'
import { usePlay, usePlayUi } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { ProgressBar } from '../ProgressBar'
import { ConfirmAction, Panel, QtyButtons, errorMessage, shared } from '../shared'
import { BugReportButton } from '../BugReportButton'
import { buildRecipeContext } from '../bugReportContext'
import type { Recipe, CraftJobView, CraftQuote, Facility } from '../types'
import { recipesById, formatItemId } from '@/data/catalog'
import { titleCase } from '@/lib/format'
import { canCraftRecipe, availableQuantity, type SkillEntry } from '@/lib/crafting'
import { estimateJobProgress } from './craftProgress'
import { combineItems, maxCraftable, missingFromCargo, runsFor } from './craftPlan'
import { FacilityVenuePicker } from './facilities/FacilityVenuePicker'
import styles from './CraftingPanel.module.css'

const HIDDEN_CATEGORIES = new Set(['facility only', 'ship passive'])

// Quote / craft / recycle direction for a recipe card.
type CraftMode = 'craft' | 'recycle'
type Preset = '' | 'fast' | 'cheap' | 'prefer_own' | 'workshop'
type Store = '' | 'storage' | 'faction'
type BatchJob = { recipe_id: string; quantity: number; facility_id?: string }

// `{ station_facilities: unknown }` uniquely identifies the facility-list
// variant within the FacilityResponse union.
type FacilityListResponse = Extract<FacilityResponse, { station_facilities: unknown }>
type ViewStorageResponse = Extract<StorageResponse, { items: unknown }>

const bulkFailures = (results: { success: boolean; error?: string }[]) =>
  results.filter((r) => !r.success).map((r) => r.error ?? 'failed').join('; ')

export function CraftingPanel() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const pushedJobs = usePlayUi((s) => s.craftJobs)
  const currentTick = useCurrentTick()
  const dockedAt = useLocationState()?.docked_at ?? null
  const isDocked = Boolean(dockedAt)
  const cargo = useCargo()

  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'craftable'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [quotes, setQuotes] = useState<Record<string, CraftQuote | { error: string }>>({})
  const [confirmRecycleId, setConfirmRecycleId] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>('')
  const [source, setSource] = useState<Store>('')
  const [deliverTo, setDeliverTo] = useState<Store>('')
  const [batch, setBatch] = useState<BatchJob[]>([])
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [cancelling, setCancelling] = useState(false)

  // Venue (facility) selection per recipe — undefined = auto-route (Station
  // Workshop unless a facility is a better fit). Facility list is fetched
  // once per dock so the picker can show real backlog/pricing.
  const [selectedVenue, setSelectedVenue] = useState<Record<string, string>>({})
  const [venuePickerRecipeId, setVenuePickerRecipeId] = useState<string | null>(null)

  const toast = useCallback((kind: 'danger' | 'success', text: string) => {
    uiStore.dispatch({ type: 'toast', kind, text })
  }, [uiStore])
  const reportError = useCallback((err: unknown) => toast('danger', errorMessage(err)), [toast])

  // Routing options shared by quote, craft, and batch. Empty = server default.
  const route = useMemo(() => ({
    ...(preset && { preset }),
    ...(source && { source }),
    ...(deliverTo && { deliver_to: deliverTo }),
  }), [preset, source, deliverTo])

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
  // Deposits change cargo; finished runs deposit outputs into storage.
  const { data: storageResp, refetch: refetchStorage } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_storage.view({})
      return resp.structuredContent as ViewStorageResponse | undefined
    },
    [dockedAt],
    { enabled: isDocked, refreshOnSections: ['cargo'], refreshOnEvents: ['crafting_update'] },
  )
  const storageItems = useMemo(() => (isDocked ? storageResp?.items ?? [] : []), [isDocked, storageResp])
  const cargoItems = useMemo(() => cargo ?? [], [cargo])
  const heldItems = useMemo(() => combineItems(storageItems, cargoItems), [storageItems, cargoItems])

  const skillsRaw = useSkills()
  const skillsMap = useMemo(() => {
    if (!skillsRaw) return undefined
    const result: Record<string, SkillEntry> = {}
    for (const [id, s] of Object.entries(skillsRaw)) {
      result[id] = { level: s.level ?? 0, xp: s.xp ?? 0, next_level_xp: s.next_level_xp ?? 0 }
    }
    return result
  }, [skillsRaw])

  // The job queue: `craft` with no recipe is a read on the server, so send it
  // as a query (no action slot) and re-read on every crafting_update push.
  const { data: jobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } = useCommandQuery(
    async (account) => {
      const resp = await account.query('spacemolt', 'craft', {})
      const data = resp.structuredContent as CraftQueueResponse | undefined
      return (data?.jobs ?? []).map((j): CraftJobView => ({ ...j, last_sync_tick: account.currentTick }))
    },
    [dockedAt],
    { enabled: isDocked, refreshOnEvents: ['crafting_update'] },
  )

  const getQty = useCallback((id: string) => Math.max(1, quantities[id] ?? 1), [quantities])
  const setQty = useCallback((id: string, q: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, Math.floor(q) || 1) }))
  }, [])

  const handleCraft = useCallback(async (recipeId: string, mode: CraftMode) => {
    const args = { id: recipeId, quantity: getQty(recipeId), facility_id: selectedVenue[recipeId], ...route }
    setBusyId(recipeId)
    try {
      const result = mode === 'recycle'
        // Recycling has no workshop route; fall back to the server default.
        ? await mutate((c) => c.spacemolt.recycle({ ...args, preset: args.preset === 'workshop' ? undefined : args.preset }), { label: 'recycle' })
        : await mutate((c) => c.spacemolt.craft(args), { label: 'craft' })
      const details = result.delta.details as CraftJobResponse | undefined
      if (details?.message) toast('success', details.message)
      setQuotes(prev => {
        const next = { ...prev }
        delete next[recipeId]
        return next
      })
      refetchJobs()
    } catch (err) {
      reportError(err)
    }
    setBusyId(null)
  }, [getQty, selectedVenue, route, mutate, toast, refetchJobs, reportError])

  // dry_run is a read on the server: a query, not a queued mutation.
  const handleQuote = useCallback(async (recipeId: string, mode: CraftMode) => {
    setBusyId(recipeId)
    try {
      const resp = await store.account.query('spacemolt', mode, {
        id: recipeId, quantity: getQty(recipeId), dry_run: true, facility_id: selectedVenue[recipeId], ...route,
      })
      setQuotes(prev => ({ ...prev, [recipeId]: (resp.structuredContent as CraftQuote | undefined) ?? { error: 'Quote failed' } }))
    } catch (err) {
      setQuotes(prev => ({ ...prev, [recipeId]: { error: errorMessage(err) } }))
    }
    setBusyId(null)
  }, [store, getQty, selectedVenue, route])

  const handleMoveInputs = useCallback(async (recipe: Recipe) => {
    const items = missingFromCargo(recipe, runsFor(recipe, getQty(recipe.id)), storageItems, cargoItems)
    setBusyId(recipe.id)
    try {
      await mutate((c) => c.spacemolt_storage.deposit({ items }), { label: 'deposit' })
      toast('success', `Moved ${items.map((i) => `${i.quantity}x ${formatItemId(i.item_id)}`).join(', ')} to storage`)
    } catch (err) {
      reportError(err)
    }
    setBusyId(null)
  }, [getQty, storageItems, cargoItems, mutate, toast, reportError])

  const handleQueueBatch = useCallback(async () => {
    setBusyId('batch')
    try {
      const result = await mutate((c) => c.spacemolt.craft({ jobs: batch.map((j) => ({ ...j, ...route })) }), { label: 'craft_batch' })
      const details = result.delta.details as BulkCraftResponse | undefined
      const results = details?.results ?? []
      const failed = details?.summary.failed ?? 0
      toast(failed ? 'danger' : 'success',
        `Queued ${details?.summary.succeeded ?? 0} of ${batch.length} jobs${failed ? `: ${bulkFailures(results)}` : ''}`)
      // Keep failed entries so the player can fix and retry them.
      setBatch(prev => prev.filter((_, i) => results.some((r) => r.index === i && !r.success)))
      refetchJobs()
    } catch (err) {
      reportError(err)
    }
    setBusyId(null)
  }, [batch, route, mutate, toast, refetchJobs, reportError])

  const handleCancel = useCallback(async (jobIds: string[]) => {
    setCancelling(true)
    try {
      if (jobIds.length === 1) {
        await mutate((c) => c.spacemolt.craft({ job_id: jobIds[0] }), { label: 'craft_cancel' })
      } else {
        const result = await mutate((c) => c.spacemolt.craft({ job_ids: jobIds }), { label: 'craft_cancel' })
        const details = result.delta.details as BulkJobCancelResponse | undefined
        if (details?.summary.failed) toast('danger', `Could not cancel ${details.summary.failed} jobs: ${bulkFailures(details.results)}`)
      }
      setSelectedJobs(new Set())
      refetchJobs()
    } catch (err) {
      reportError(err)
    }
    setCancelling(false)
  }, [mutate, toast, refetchJobs, reportError])

  const toggleJob = useCallback((jobId: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }, [])

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
  const refreshAll = () => {
    store.account.refresh().catch(reportError)
    if (isDocked) { refetchStorage(); refetchJobs() }
  }

  return (
    <Panel
      title="Crafting"
      icon={<Hammer size={16} />}
      headerRight={
        <div className={styles.headerActions}>
          <button
            className={shared.refreshBtn}
            onClick={refreshAll}
            title="Refresh skills, storage & jobs"
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
            {selectedJobs.size > 0 && (
              <button
                className={styles.quoteBtn}
                onClick={() => handleCancel([...selectedJobs])}
                disabled={cancelling}
                title="Cancel the selected jobs (refunds unconsumed materials, labor, and fees)"
                type="button"
              >
                <Trash2 size={11} /> Cancel {selectedJobs.size}
              </button>
            )}
            <button
              className={shared.refreshBtn}
              onClick={refetchJobs}
              disabled={jobsLoading || !isDocked}
              title="Refresh job queue"
              type="button"
            >
              <RefreshCw size={12} className={jobsLoading ? styles.spinning : undefined} />
            </button>
          </div>
          {!isDocked ? (
            // The queue view needs a dock; between docks show the last crafting_update push.
            pushedJobs && pushedJobs.length > 0 ? (
              <div className={styles.jobsList}>
                {pushedJobs.map((job) => (
                  <div key={job.job_id} className={styles.jobCard}>
                    <div className={styles.jobMeta}>
                      <span className={styles.jobName}>{job.recipe}</span>
                      <span>·</span>
                      <span>{job.venue}</span>
                      <span>·</span>
                      <span>{job.completed ? 'complete' : `${job.runs_remaining} runs left`}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.jobsEmpty}>Dock to view your job queue.</div>
            )
          ) : activeJobs.length === 0 ? (
            <div className={styles.jobsEmpty}>
              {jobsLoading
                ? 'Loading jobs…'
                : jobsError ?? 'No jobs queued. Crafting runs over several ticks once queued.'}
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
                        <input
                          type="checkbox"
                          checked={selectedJobs.has(job.job_id)}
                          onChange={() => toggleJob(job.job_id)}
                          aria-label={`Select ${job.recipe}`}
                        />
                        {job.mode === 'recycle' && <RotateCcw size={11} className={styles.jobModeIcon} />}
                        {job.recipe}
                      </span>
                      <button
                        className={styles.jobCancel}
                        onClick={() => handleCancel([job.job_id])}
                        disabled={cancelling}
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

        {/* Batch: queue many crafts in one action */}
        {batch.length > 0 && (
          <div className={styles.jobsSection}>
            <div className={styles.jobsHeader}>
              <span className={styles.jobsTitle}>
                <ListPlus size={12} /> Batch
                <span className={styles.jobsCount}>{batch.length}</span>
              </span>
              <button className={styles.quoteBtn} onClick={() => setBatch([])} type="button">Clear</button>
              <ActionButton
                label={`Queue ${batch.length}`}
                icon={<Hammer size={12} />}
                onClick={handleQueueBatch}
                disabled={!isDocked || busyId === 'batch'}
                loading={busyId === 'batch'}
                size="sm"
              />
            </div>
            <div className={styles.jobsList}>
              {batch.map((job, i) => (
                <div key={`${job.recipe_id}-${i}`} className={styles.jobTop}>
                  <span className={styles.jobName}>
                    {recipesById[job.recipe_id]?.name ?? job.recipe_id} x{job.quantity}
                  </span>
                  <button
                    className={styles.jobCancel}
                    onClick={() => setBatch(prev => prev.filter((_, j) => j !== i))}
                    title="Remove from batch"
                    type="button"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Routing options for quotes, crafts, and batches */}
        {isDocked && (
          <div className={styles.filterBar}>
            <select
              className={styles.categoryDropdown}
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
              aria-label="Venue preset"
              title="How auto-routing picks a venue when no facility is chosen"
            >
              <option value="">Route: fastest</option>
              <option value="prefer_own">Route: prefer own</option>
              <option value="cheap">Route: cheapest</option>
              <option value="workshop">Route: workshop only</option>
            </select>
            <select
              className={styles.categoryDropdown}
              value={source}
              onChange={(e) => setSource(e.target.value as Store)}
              aria-label="Input source"
            >
              <option value="">Inputs: auto</option>
              <option value="storage">Inputs: my storage</option>
              <option value="faction">Inputs: faction storage</option>
            </select>
            <select
              className={styles.categoryDropdown}
              value={deliverTo}
              onChange={(e) => setDeliverTo(e.target.value as Store)}
              aria-label="Output destination"
            >
              <option value="">Output: auto</option>
              <option value="storage">Output: my storage</option>
              <option value="faction">Output: faction storage</option>
            </select>
          </div>
        )}

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
                    const maxQty = isExpanded ? Math.max(1, maxCraftable(recipe, heldItems)) : 1
                    const missing = isExpanded ? missingFromCargo(recipe, runsFor(recipe, qty), storageItems, cargoItems) : []
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
                              <QtyButtons max={maxQty} current={String(qty)} onChange={(v) => setQty(recipe.id, Number(v))} />
                              <button
                                type="button"
                                className={styles.quoteBtn}
                                onClick={() => handleQuote(recipe.id, 'craft')}
                                disabled={!isDocked || busy}
                                title="Get a cost & time estimate without queuing"
                              >
                                <Calculator size={11} /> Quote
                              </button>
                              {missing.length > 0 && (
                                <button
                                  type="button"
                                  className={styles.quoteBtn}
                                  onClick={() => handleMoveInputs(recipe)}
                                  disabled={busy}
                                  title={`Deposit ${missing.map((i) => `${i.quantity}x ${formatItemId(i.item_id)}`).join(', ')} from cargo to storage`}
                                >
                                  <ArrowDownToLine size={11} /> Move inputs from cargo
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.quoteBtn}
                                onClick={() => setBatch(prev => [...prev, { recipe_id: recipe.id, quantity: qty, facility_id: selectedVenue[recipe.id] }])}
                                title="Add to a batch and queue many crafts in one action"
                              >
                                <ListPlus size={11} /> Batch
                              </button>
                              <ActionButton
                                label="Recycle"
                                icon={<RotateCcw size={12} />}
                                onClick={() => setConfirmRecycleId(recipe.id)}
                                disabled={!isDocked || busy}
                                variant="secondary"
                                size="sm"
                              />
                              <ActionButton
                                label="Craft"
                                icon={<Hammer size={12} />}
                                onClick={() => handleCraft(recipe.id, 'craft')}
                                disabled={!isDocked || (!craftable && source !== 'faction') || busy}
                                loading={busy}
                                size="sm"
                              />
                            </div>
                            {confirmRecycleId === recipe.id && (
                              <ConfirmAction
                                message={`Recycle ${qty}x ${formatItemId(recipe.outputs?.[0]?.item_id ?? recipe.id)}? Items are destroyed and only part of the inputs come back.`}
                                icon={<RotateCcw size={12} />}
                                confirmLabel="Recycle"
                                onConfirm={() => { setConfirmRecycleId(null); handleCraft(recipe.id, 'recycle') }}
                                onCancel={() => setConfirmRecycleId(null)}
                              />
                            )}
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
