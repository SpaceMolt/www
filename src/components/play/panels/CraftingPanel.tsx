'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Hammer, RefreshCw, AlertTriangle, Check, ChevronDown, ChevronRight,
  Search, Clock, RotateCcw, Trash2, Coins, Calculator, Package, Factory,
  ArrowDownToLine, ListPlus, X, ShoppingCart,
} from 'lucide-react'
import type {
  BulkCraftResponse,
  BulkJobCancelResponse,
  CraftJobResponse,
  CraftQueueResponse,
  FacilityResponse,
  StorageResponse,
} from '@spacemolt/lib'
import { useAccountStore, useCargo, useCommandMutation, useCommandQuery, useCurrentTick, useLocationState, useMarket, usePlayer } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { ProgressBar } from '../ProgressBar'
import { ConfirmAction, Panel, QtyButtons, errorMessage, objectKey, shared } from '../shared'
import { BugReportButton } from '../BugReportButton'
import { buildRecipeContext } from '../bugReportContext'
import type { Recipe, CraftJobView, CraftQuote, Facility } from '../types'
import { recipesById, formatItemId } from '@/data/catalog'
import { hasImage, imageUrl } from '@/data/images'
import { canCraftRecipe, availableQuantity } from '@/lib/crafting'
import { estimateJobProgress } from './craftProgress'
import { buyPlan, combineItems, isRecyclable, maxCraftable, missingFromCargo, runsFor, type BuyLine } from './craftPlan'
import { mergeLiveBook } from './trading/tradingLogic'
import { FacilityVenuePicker } from './facilities/FacilityVenuePicker'
import { useFactionPermissions, useStationServices } from '../hooks/useGates'
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
  const currentTick = useCurrentTick()
  const dockedAt = useLocationState()?.docked_at ?? null
  const isDocked = Boolean(dockedAt)
  const cargo = useCargo()
  const services = useStationServices()
  const canCraft = services.includes('crafting')
  const hasStorage = services.includes('storage')
  // Buy & craft buys missing inputs into storage, so it needs all three services.
  const canBuy = canCraft && hasStorage && services.includes('market')
  const credits = usePlayer()?.credits ?? 0
  // Crafting with or into faction storage needs manage_treasury (gameserver crafting.go).
  const canUseFactionStore = useFactionPermissions({ enabled: isDocked }).can('manage_treasury')

  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'craftable' | 'buyable'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [quotes, setQuotes] = useState<Record<string, CraftQuote | { error: string }>>({})
  const [confirmRecycleId, setConfirmRecycleId] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>('')
  const [sourceChoice, setSource] = useState<Store>('')
  const [deliverChoice, setDeliverTo] = useState<Store>('')
  // A choice whose option is gone (no storage here, lost manage_treasury) falls back to auto.
  const offered = (store: Store) => (store === 'storage' && hasStorage) || (store === 'faction' && canUseFactionStore)
  const source: Store = offered(sourceChoice) ? sourceChoice : ''
  const deliverTo: Store = offered(deliverChoice) ? deliverChoice : ''
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

  // Local sell orders: the asks a Buy & craft fills from. The snapshot gives
  // our own order quantities; the live book keeps prices current.
  const liveBook = useMarket()
  const { data: marketSnapshot, refetch: refetchMarket } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_market.view_market({})).structuredContent,
    [dockedAt],
    { enabled: canBuy },
  )
  const asksFor = useMemo(() => {
    const byId = new Map(mergeLiveBook(marketSnapshot?.items ?? [], liveBook).map((i) => [i.item_id, i.sell_orders]))
    return (itemId: string) => byId.get(itemId) ?? []
  }, [marketSnapshot, liveBook])

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

  // Move any cargo inputs to storage, buy the rest into storage (one buy per
  // item, at the full quantity), then queue the craft. A short fill stops it
  // before the craft, so no job queues without its inputs.
  const handleBuyAndCraft = useCallback(async (recipe: Recipe) => {
    const runs = runsFor(recipe, getQty(recipe.id))
    const deposit = missingFromCargo(recipe, runs, storageItems, cargoItems)
    const lines = buyPlan(recipe, runs, heldItems, asksFor)
    setBusyId(recipe.id)
    try {
      if (deposit.length > 0) await mutate((c) => c.spacemolt_storage.deposit({ items: deposit }), { label: 'deposit' })
      for (const { item_id, quantity } of lines) {
        const { delta } = await mutate((c) => c.spacemolt.buy({ id: item_id, quantity, deliver_to: 'storage' }), { label: 'buy' })
        const bought = delta.details?.quantity ?? 0
        if (bought < quantity) throw new Error(`Bought only ${bought} of ${quantity} ${formatItemId(item_id)}. Craft not queued; earlier purchases are in storage.`)
      }
    } catch (err) {
      reportError(err)
      setBusyId(null)
      return
    } finally {
      refetchMarket()
    }
    await handleCraft(recipe.id, 'craft')
  }, [getQty, storageItems, cargoItems, heldItems, asksFor, mutate, reportError, refetchMarket, handleCraft])

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
    const withStatus = recipes.map((recipe) => {
      const status = canCraftRecipe(recipe, storageItems)
      // One run's shortfall against storage + cargo, priced on the local book.
      const plan = canBuy && !status.craftable ? buyPlan(recipe, 1, heldItems, asksFor) : []
      const buyCost = sumCost(plan)
      const buyable = status.craftable || (canBuy && isFillable(plan) && buyCost <= credits)
      return { recipe, ...status, buyable, buyCost }
    })

    let filtered = withStatus
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((r) => r.recipe.category === categoryFilter)
    }
    if (filter !== 'all') {
      filtered = filtered.filter((r) => r[filter])
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

    // Sort: craftable, then craftable with a purchase, then alphabetical
    filtered.sort((a, b) =>
      Number(b.craftable) - Number(a.craftable) ||
      Number(b.buyable) - Number(a.buyable) ||
      a.recipe.name.localeCompare(b.recipe.name))

    // Group by category
    const groups: Record<string, typeof filtered> = {}
    for (const item of filtered) {
      const cat = item.recipe.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [recipes, storageItems, heldItems, asksFor, canBuy, credits, filter, categoryFilter, searchQuery])

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
              disabled={jobsLoading}
              title="Refresh job queue"
              type="button"
            >
              <RefreshCw size={12} className={jobsLoading ? styles.spinning : undefined} />
            </button>
          </div>
          {activeJobs.length === 0 ? (
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
              {canCraft && (
                <ActionButton
                  label={`Queue ${batch.length}`}
                  icon={<Hammer size={12} />}
                  onClick={handleQueueBatch}
                  disabled={busyId === 'batch'}
                  loading={busyId === 'batch'}
                  size="sm"
                />
              )}
            </div>
            <div className={styles.jobsList}>
              {batch.map((job, i) => (
                <div key={objectKey(job)} className={styles.jobTop}>
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
              className={styles.select}
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
              className={styles.select}
              value={source}
              onChange={(e) => setSource(e.target.value as Store)}
              aria-label="Input source"
            >
              <option value="">Inputs: auto</option>
              {hasStorage && <option value="storage">Inputs: my storage</option>}
              {canUseFactionStore && <option value="faction">Inputs: faction storage</option>}
            </select>
            <select
              className={styles.select}
              value={deliverTo}
              onChange={(e) => setDeliverTo(e.target.value as Store)}
              aria-label="Output destination"
            >
              <option value="">Output: auto</option>
              {hasStorage && <option value="storage">Output: my storage</option>}
              {canUseFactionStore && <option value="faction">Output: faction storage</option>}
            </select>
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
            <select
              className={styles.select}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
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
              {canBuy && (
                <button
                  className={`${styles.filterBtn} ${filter === 'buyable' ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilter('buyable')}
                  type="button"
                  title="Craftable now, or after you buy the missing inputs here (one run, within your credits)"
                >
                  <ShoppingCart size={10} /> With purchase
                </button>
              )}
            </div>
          </div>
        )}

        {groupedRecipes.length === 0 && (
          <div className={shared.emptyState}>
            {searchQuery || filter !== 'all' || categoryFilter !== 'all'
              ? 'No recipes match your filters.'
              : 'No recipes available.'}
          </div>
        )}

        {/* Recipe categories as accordions */}
        {groupedRecipes.map(([category, items]) => {
          const isCollapsed = collapsedCategories.has(category)
          const craftableCount = items.filter(r => r.craftable).length
          const buyableCount = items.filter(r => r.buyable && !r.craftable).length
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
                  {buyableCount > 0 && <span className={styles.buyableCount}>{buyableCount} with purchase</span>}
                  {items.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className={styles.recipeGrid}>
                  {items.map(({ recipe, craftable, reasons, buyable, buyCost }) => {
                    const isExpanded = expandedId === recipe.id
                    const qty = getQty(recipe.id)
                    const quote = quotes[recipe.id]
                    const busy = busyId === recipe.id
                    // MAX plans with cargo too: "Move inputs from cargo" deposits the gap before crafting.
                    const maxQty = isExpanded ? Math.max(1, maxCraftable(recipe, heldItems)) : 1
                    const runs = runsFor(recipe, qty)
                    const missing = isExpanded ? missingFromCargo(recipe, runs, storageItems, cargoItems) : []
                    const plan = isExpanded && canBuy ? buyPlan(recipe, runs, heldItems, asksFor) : []
                    const planCost = sumCost(plan)
                    const cardClass = craftable ? styles.recipeCardCraftable : buyable ? styles.recipeCardBuyable : styles.recipeCardLocked
                    return (
                      <div
                        key={recipe.id}
                        className={cardClass}
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
                              <ItemIcon itemId={recipe.outputs?.[0]?.item_id ?? recipe.id} size={28} />
                              <span className={styles.recipeName}>{recipe.name}</span>
                            </div>
                            {craftable
                              ? <span className={styles.badgeReady}><Check size={10} /> Ready</span>
                              : buyable && <span className={styles.badgeBuy}><ShoppingCart size={10} /> ~{buyCost.toLocaleString()} cr</span>}
                          </button>
                          <BugReportButton contextType="recipe" entityName={recipe.name} entityContext={buildRecipeContext(recipe)} />
                        </div>

                        {isExpanded && (
                          <div className={styles.recipeCardBody}>
                            {recipe.description && (
                              <div className={styles.recipeDesc}>{recipe.description}</div>
                            )}
                            <div className={styles.ioLabel}>Inputs for {runs} run{runs === 1 ? '' : 's'}</div>
                            <div className={styles.ioList}>
                              {(recipe.inputs ?? []).map((i) => {
                                // The server takes inputs from station storage only (crafting.go craftStoreRef);
                                // cargo counts once it is deposited.
                                const need = i.quantity * runs
                                const have = availableQuantity(i.item_id, storageItems)
                                const inCargo = availableQuantity(i.item_id, cargoItems)
                                const line = plan.find((l) => l.item_id === i.item_id)
                                const showCargo = inCargo > 0 && have < need
                                return (
                                  <div key={i.item_id} className={styles.ioRow}>
                                    <ItemIcon itemId={i.item_id} />
                                    <span className={styles.ioName}>{formatItemId(i.item_id)}</span>
                                    <span className={styles.ioBar}>
                                      <ProgressBar value={have} max={need} size="sm" showText={false} color={have >= need ? 'green' : 'orange'} />
                                    </span>
                                    <span className={have >= need ? styles.inputOk : styles.inputMissing}>
                                      {have.toLocaleString()}/{need.toLocaleString()}
                                    </span>
                                    {(showCargo || line) && (
                                      <span className={styles.ioMeta}>
                                        {showCargo && <span className={styles.ioNote}>+{inCargo.toLocaleString()} in cargo</span>}
                                        {line && <span className={line.short ? styles.inputMissing : styles.ioBuy}>{marketNote(line)}</span>}
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                              {(recipe.inputs ?? []).length === 0 && <span className={styles.ioNote}>None</span>}
                            </div>
                            <div className={styles.ioLabel}>Output</div>
                            <div className={styles.ioList}>
                              {(recipe.outputs ?? []).map((o) => (
                                <div key={o.item_id} className={styles.ioRow}>
                                  <ItemIcon itemId={o.item_id} />
                                  <span className={`${styles.ioName} ${styles.recipeOutputs}`}>{formatItemId(o.item_id)}</span>
                                  <span className={`${styles.ioQty} ${styles.recipeOutputs}`}>x{(o.quantity * runs).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>

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
                              {canCraft && (
                                <button
                                  type="button"
                                  className={styles.quoteBtn}
                                  onClick={() => handleQuote(recipe.id, 'craft')}
                                  disabled={busy}
                                  title="Get a cost & time estimate without queuing"
                                >
                                  <Calculator size={11} /> Quote
                                </button>
                              )}
                              {hasStorage && missing.length > 0 && (
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
                              {canCraft && (
                                <button
                                  type="button"
                                  className={styles.quoteBtn}
                                  onClick={() => setBatch(prev => [...prev, { recipe_id: recipe.id, quantity: qty, facility_id: selectedVenue[recipe.id] }])}
                                  title="Add to a batch and queue many crafts in one action"
                                >
                                  <ListPlus size={11} /> Batch
                                </button>
                              )}
                              {canCraft && isRecyclable({ category: recipe.category, no_recycle: recipesById[recipe.id]?.no_recycle }) && (
                                <ActionButton
                                  label="Recycle"
                                  icon={<RotateCcw size={12} />}
                                  onClick={() => setConfirmRecycleId(recipe.id)}
                                  disabled={busy}
                                  variant="secondary"
                                  size="sm"
                                />
                              )}
                              {plan.length > 0 && isFillable(plan) && (
                                <ActionButton
                                  label={`Buy & craft · ~${planCost.toLocaleString()} cr`}
                                  icon={<ShoppingCart size={12} />}
                                  onClick={() => handleBuyAndCraft(recipe)}
                                  disabled={busy || planCost > credits}
                                  loading={busy}
                                  size="sm"
                                />
                              )}
                              {canCraft && (
                                <ActionButton
                                  label="Craft"
                                  icon={<Hammer size={12} />}
                                  onClick={() => handleCraft(recipe.id, 'craft')}
                                  disabled={(!craftable && source !== 'faction') || busy}
                                  loading={busy}
                                  size="sm"
                                />
                              )}
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
            ownFacilities={facilities.own.filter(f => f.recipe_id === venuePickerRecipeId)}
            factionFacilities={facilities.faction.filter(f => f.recipe_id === venuePickerRecipeId)}
            publicFacilities={facilities.public.filter(f => f.recipe_id === venuePickerRecipeId)}
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

/** Market status of one missing input. */
const marketNote = ({ quantity, cost, short }: BuyLine) =>
  short === quantity ? 'not sold here'
    : short > 0 ? `only ${(quantity - short).toLocaleString()} for sale`
      : `buy ${quantity.toLocaleString()} · ~${cost.toLocaleString()} cr`

const sumCost = (plan: BuyLine[]) => plan.reduce((sum, l) => sum + l.cost, 0)
const isFillable = (plan: BuyLine[]) => plan.every((l) => l.short === 0)

/** Codex art for an item, or a crate icon when the item has none. */
function ItemIcon({ itemId, size = 20 }: { itemId: string; size?: number }) {
  const path = `items/${itemId}.webp`
  return hasImage(path)
    ? <img src={imageUrl(path)} alt="" width={size} height={size} loading="lazy" className={styles.itemIcon} />
    : <span className={styles.itemIconFallback} style={{ width: size, height: size }}><Package size={Math.round(size * 0.6)} /></span>
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
