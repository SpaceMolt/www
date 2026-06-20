'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Hammer, RefreshCw, AlertTriangle, Lock, Check, ChevronDown, ChevronRight,
  Search, Filter, Clock, RotateCcw, Trash2, Coins, Calculator, Package,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import { ProgressBar } from '../ProgressBar'
import { Panel, shared } from '../shared'
import { BugReportButton } from '../BugReportButton'
import { buildRecipeContext } from '../bugReportContext'
import type { Recipe, CraftJobView, CraftQuote } from '../types'
import { recipesById, formatItemId } from '@/data/catalog'
import { titleCase } from '@/lib/format'
import { canCraftRecipe, availableQuantity } from '@/lib/crafting'
import styles from './CraftingPanel.module.css'

const HIDDEN_CATEGORIES = new Set(['facility only', 'ship passive'])

// Quote / craft / recycle direction for a recipe card.
type CraftMode = 'craft' | 'recycle'

export function CraftingPanel() {
  const { state, sendCommand } = useGame()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'craftable'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [quotes, setQuotes] = useState<Record<string, CraftQuote | { error: string }>>({})

  // Queued jobs across all venues (craft action=queue). null = not yet loaded.
  const [jobs, setJobs] = useState<CraftJobView[] | null>(null)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Fetch skills on mount (needed for craftability check)
  useEffect(() => {
    if (!state.skillsData) sendCommand('get_skills')
  }, [state.skillsData, sendCommand])

  // When docked, fetch station storage — crafting escrows inputs from station
  // storage (NOT cargo), so the craftable filter and material counts read from
  // there. See gameserver crafting.go ("station-storage-centric, no cargo path").
  useEffect(() => {
    if (state.isDocked && !state.storageData) {
      sendCommand('view_storage')
    }
  }, [state.isDocked, state.storageData, sendCommand])

  // Crafting is queued, not instant. `craft` with no recipe returns the
  // player's job queue. It costs a mutation (1/tick), so we load it once on
  // mount and otherwise update optimistically + via an explicit refresh.
  const fetchQueue = useCallback(async () => {
    setJobsLoading(true)
    const r = await sendCommand('craft', {})
    if (!r.error && Array.isArray(r.jobs)) {
      setJobs(r.jobs as CraftJobView[])
    } else if (!r.error) {
      setJobs([])
    }
    setJobsLoading(false)
  }, [sendCommand])

  useEffect(() => {
    if (jobs === null) fetchQueue()
  }, [jobs, fetchQueue])

  const getQty = useCallback((id: string) => Math.max(1, quantities[id] ?? 1), [quantities])
  const setQty = useCallback((id: string, q: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, Math.floor(q) || 1) }))
  }, [])

  const handleCraft = useCallback(async (recipeId: string, mode: CraftMode) => {
    const quantity = getQty(recipeId)
    setBusyId(recipeId)
    const r = await sendCommand(mode, { recipe_id: recipeId, quantity })
    setBusyId(null)
    if (!r.error && r.job_id) {
      // Optimistically add the queued job (re-fetching would be rate-limited).
      const job: CraftJobView = {
        job_id: r.job_id as string,
        venue: r.venue as string | undefined,
        recipe: (r.recipe as string) || recipeId,
        mode: (r.mode as string) || mode,
        produces: r.produces as CraftJobView['produces'],
        runs_total: (r.runs as number) ?? 0,
        runs_done: 0,
        runs_remaining: (r.runs as number) ?? 0,
        progress: 0,
        eta_ticks: Math.max(0, ((r.est_completion_tick as number) ?? 0) - state.currentTick),
        position: (jobs?.length ?? 0) + 1,
        orderer: 'self',
        external: r.external as boolean | undefined,
        status: 'queued',
        facility_id: (r.facility_id as string) || '',
      }
      setJobs(prev => [...(prev ?? []), job])
      // Clear any stale quote for this recipe.
      setQuotes(prev => {
        const next = { ...prev }
        delete next[recipeId]
        return next
      })
    }
  }, [getQty, sendCommand, state.currentTick, jobs])

  const handleQuote = useCallback(async (recipeId: string, mode: CraftMode) => {
    const quantity = getQty(recipeId)
    setBusyId(recipeId)
    const r = await sendCommand(mode, { recipe_id: recipeId, quantity, dry_run: true })
    setBusyId(null)
    setQuotes(prev => ({
      ...prev,
      [recipeId]: r.error
        ? { error: (r.message as string) || 'Quote failed' }
        : (r as unknown as CraftQuote),
    }))
  }, [getQty, sendCommand])

  const handleCancel = useCallback(async (jobId: string) => {
    setCancellingId(jobId)
    const r = await sendCommand('craft', { job_id: jobId })
    setCancellingId(null)
    if (!r.error) {
      setJobs(prev => (prev ?? []).filter(j => j.job_id !== jobId))
    }
  }, [sendCommand])

  const storageItems = useMemo(
    () => (state.isDocked ? state.storageData?.items ?? [] : []),
    [state.isDocked, state.storageData?.items],
  )
  const skillsMap = state.skillsData?.skills

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

  const isDocked = state.isDocked
  const activeJobs = jobs ?? []

  return (
    <Panel
      title="Crafting"
      icon={<Hammer size={16} />}
      headerRight={
        <div className={styles.headerActions}>
          <button
            className={shared.refreshBtn}
            onClick={() => { sendCommand('get_skills'); if (isDocked) sendCommand('view_storage') }}
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
                const done = job.runs_done + (job.progress || 0)
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
                        <button
                          className={styles.recipeCardHeader}
                          onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                          type="button"
                          title={craftable ? 'You can craft this' : reasons.join('; ')}
                        >
                          <div className={styles.recipeCardTitle}>
                            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            <span className={styles.recipeName}>{recipe.name}</span>
                            <BugReportButton contextType="recipe" entityName={recipe.name} entityContext={buildRecipeContext(recipe)} />
                          </div>
                        </button>

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
                                  <span>~{Math.max(0, quote.est_completion_tick - state.currentTick)} ticks</span>
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
    </Panel>
  )
}
