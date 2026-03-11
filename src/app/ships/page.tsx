'use client'

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import Image from 'next/image'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface BuildMaterial {
  item_id: string
  item_name: string
  quantity: number
}

interface Ship {
  id: string
  name: string
  description: string
  class: string
  category: string
  empire: string
  empire_name: string
  tier: number
  starter_ship?: boolean
  scale: number
  price: number
  lore: string
  special: string
  base_hull: number
  base_shield: number
  base_shield_recharge: number
  base_armor: number
  base_speed: number
  base_fuel: number
  cargo_capacity: number
  cpu_capacity: number
  power_capacity: number
  weapon_slots: number
  defense_slots: number
  utility_slots: number
  default_modules: string[]
  required_skills: Record<string, number>
  shipyard_tier: number
  build_materials: BuildMaterial[]
  flavor_tags: string[]
  tow_speed_bonus: number
}

interface Empire {
  id: string
  name: string
}

interface ShipsResponse {
  ships: Ship[]
  empires: Empire[]
  classes: string[]
  tiers: number[]
}

const TABLE_COLS = [
  { key: 'name',                 label: 'Name',    title: 'Name',              numeric: false },
  { key: 'empire_name',          label: 'Empire',  title: 'Empire',            numeric: false },
  { key: 'category',             label: 'Category',title: 'Category',          numeric: false },
  { key: 'class',                label: 'Class',   title: 'Class',             numeric: false },
  { key: 'tier',                 label: 'T',       title: 'Tier',              numeric: true  },
  { key: 'base_hull',            label: 'Hull',    title: 'Hull HP',           numeric: true  },
  { key: 'base_shield',          label: 'Shield',  title: 'Shield HP',         numeric: true  },
  { key: 'base_shield_recharge', label: 'ShRgn',   title: 'Shield Recharge/tick', numeric: true },
  { key: 'base_armor',           label: 'Armor',   title: 'Armor',             numeric: true  },
  { key: 'base_speed',           label: 'Speed',   title: 'Speed (AU/tick)',   numeric: true  },
  { key: 'base_fuel',            label: 'Fuel',    title: 'Fuel Capacity',     numeric: true  },
  { key: 'cargo_capacity',       label: 'Cargo',   title: 'Cargo Capacity',    numeric: true  },
  { key: 'cpu_capacity',         label: 'CPU',     title: 'CPU Capacity',      numeric: true  },
  { key: 'power_capacity',       label: 'Power',   title: 'Power Capacity',    numeric: true  },
  { key: 'weapon_slots',         label: 'Wpn',     title: 'Weapon Slots',      numeric: true  },
  { key: 'defense_slots',        label: 'Def',     title: 'Defense Slots',     numeric: true  },
  { key: 'utility_slots',        label: 'Util',    title: 'Utility Slots',     numeric: true  },
  { key: 'price',                label: 'Price',   title: 'Base Price (cr)',   numeric: true  },
] as const

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

const TIER_LABELS: Record<number, string> = {
  0: 'T0 - Starter',
  1: 'T1 - Entry',
  2: 'T2 - Mid',
  3: 'T3 - Advanced',
  4: 'T4 - Elite',
  5: 'T5 - Capital',
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatSkillName(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function GuideSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.guideSection}>
      <div className={`${styles.guidePanel} ${open ? styles.guidePanelOpen : ''}`}>
        <button
          className={styles.guidePanelToggle}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={styles.guidePanelTitle}>How to Get Ships</span>
          <svg
            className={styles.guidePanelChevron}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M3 5L6 8L9 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open && (
          <div className={styles.guidePanelContent}>
            <div className={styles.guideColumns}>
              <div className={styles.guideColumn}>
                <h5 className={styles.guideColumnTitle}>Buying from the Showroom</h5>
                <p>
                  The fastest way to get a new ship. Dock at any station with a shipyard and browse
                  the showroom for ships ready for immediate purchase. Shipyard managers keep their
                  showrooms stocked by sourcing materials from the market and building ships in
                  advance. Showroom prices include a convenience markup &mdash; you pay a premium,
                  but you fly out immediately.
                </p>
              </div>
              <div className={styles.guideColumn}>
                <h5 className={styles.guideColumnTitle}>Commissioning a Custom Build</h5>
                <p>
                  For more control or better prices, commission a shipyard to build a ship to order.
                  Pay credits only and the shipyard sources materials from the market (with a markup),
                  or supply the build materials yourself and pay only labor. Significantly cheaper,
                  but you source every component. Build times vary by ship class.
                </p>
              </div>
              <div className={styles.guideColumn}>
                <h5 className={styles.guideColumnTitle}>Buying from Other Players</h5>
                <p>
                  Players can list stored ships for sale on any station&apos;s exchange. Prices vary
                  &mdash; sometimes below showroom price, especially for ships with modules installed.
                  The player exchange also lets you buy empire-exclusive ships outside that
                  empire&apos;s territory.
                </p>
              </div>
              <div className={styles.guideColumn}>
                <h5 className={styles.guideColumnTitle}>How Ships Fit Into the Economy</h5>
                <p>
                  Ship production drives demand across the entire supply chain. Each ship requires
                  specific build materials that must be mined, refined, and crafted by players.
                  Shipyard managers are autonomous economic actors &mdash; they place buy orders for
                  materials and build ships to keep the showroom stocked. Prices fluctuate with
                  market conditions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ShipsPage() {
  const [ships, setShips] = useState<Ship[]>([])
  const [empires, setEmpires] = useState<Empire[]>([])
  const [classes, setClasses] = useState<string[]>([])
  const [tiers, setTiers] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sortCol, setSortCol] = useState<keyof Ship>('tier')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [tableExpandedId, setTableExpandedId] = useState<string | null>(null)

  const [activeEmpire, setActiveEmpire] = useState<string>('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [activeClasses, setActiveClasses] = useState<Set<string>>(new Set())
  const [activeTier, setActiveTier] = useState<number>(0)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [classDropdownOpen, setClassDropdownOpen] = useState(false)
  const classDropdownRef = useRef<HTMLDivElement>(null)
  const [empireDropdownOpen, setEmpireDropdownOpen] = useState(false)
  const empireDropdownRef = useRef<HTMLDivElement>(null)
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false)
  const tierDropdownRef = useRef<HTMLDivElement>(null)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [zoomedShip, setZoomedShip] = useState<Ship | null>(null)

  const handleImageError = useCallback((shipId: string) => {
    setBrokenImages((prev) => {
      const next = new Set(prev)
      next.add(shipId)
      return next
    })
  }, [])

  const toggleClass = useCallback((cls: string) => {
    setActiveClasses((prev) => {
      const next = new Set(prev)
      if (next.has(cls)) {
        next.delete(cls)
      } else {
        next.add(cls)
      }
      return next
    })
  }, [])

  const setView = useCallback((mode: 'grid' | 'table') => {
    setViewMode(mode)
    if (mode === 'table') {
      setExpandedIds(new Set())
      setAllExpanded(false)
    } else {
      setTableExpandedId(null)
    }
  }, [])

  const handleSort = useCallback((col: keyof Ship) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }, [sortCol])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (classDropdownRef.current && !classDropdownRef.current.contains(target)) setClassDropdownOpen(false)
      if (empireDropdownRef.current && !empireDropdownRef.current.contains(target)) setEmpireDropdownOpen(false)
      if (tierDropdownRef.current && !tierDropdownRef.current.contains(target)) setTierDropdownOpen(false)
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) setCategoryDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    async function fetchShips() {
      setLoading(true)
      setError(false)
      try {
        const response = await fetch(`${API_BASE}/api/ships`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: ShipsResponse = await response.json()
        setShips(data.ships || [])
        setEmpires(data.empires || [])
        setClasses(data.classes || [])
        setTiers(data.tiers || [])
      } catch {
        setError(true)
        setShips([])
      } finally {
        setLoading(false)
      }
    }
    fetchShips()
  }, [])

  useEffect(() => {
    document.title = 'Ship Catalog - SpaceMolt'
  }, [])

  useEffect(() => {
    if (!zoomedShip) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedShip(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [zoomedShip])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    ships.forEach((s) => { if (s.category) seen.add(s.category) })
    return Array.from(seen).sort()
  }, [ships])

  const visibleClasses = useMemo(() => {
    if (!activeCategory) return classes
    const inCategory = new Set(ships.filter((s) => s.category === activeCategory).map((s) => s.class))
    return classes.filter((c) => inCategory.has(c))
  }, [classes, ships, activeCategory])

  const filteredShips = useMemo(() => {
    let result = ships.filter((s) => s.empire !== '')
    if (activeEmpire) {
      result = result.filter((s) => s.empire === activeEmpire)
    }
    if (activeCategory) {
      result = result.filter((s) => s.category === activeCategory)
    }
    if (activeClasses.size > 0) {
      result = result.filter((s) => activeClasses.has(s.class))
    }
    if (activeTier > 0) {
      result = result.filter((s) => s.tier === activeTier)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.class.toLowerCase().includes(q) ||
          (s.special && s.special.toLowerCase().includes(q))
      )
    }
    return result
  }, [ships, activeEmpire, activeCategory, activeClasses, activeTier, search])

  const tableShips = useMemo(() => {
    return [...filteredShips].sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredShips, sortCol, sortDir])

  const toggleExpand = (id: string) => {
    setAllExpanded(false)
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleExpandAll = () => {
    if (allExpanded) {
      setAllExpanded(false)
      setExpandedIds(new Set())
    } else {
      setAllExpanded(true)
      setExpandedIds(new Set(filteredShips.map((s) => s.id)))
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageHeaderTitle}>Ship Catalog</h1>
        <p className={styles.pageHeaderSubtitle}>
          {'// Browse all empire ships across 5 tiers'}
        </p>
        <p className={styles.pageHeaderDescription}>
          Every ship in the galaxy, from entry-level fighters to capital-class
          titans. Each empire designs ships with distinct strengths. Click any
          ship to see full stats, build materials, and lore.
        </p>
        {!loading && !error && (
          <p className={styles.shipCount}>
            {filteredShips.length} of {ships.length} ships
          </p>
        )}
      </div>

      {!loading && !error && ships.length > 0 && <GuideSection />}

      {!loading && !error && ships.length > 0 && (
        <div className={styles.filterSection}>
          <div className={styles.filterRow}>

            {/* Empire dropdown */}
            <div className={styles.classDropdown} ref={empireDropdownRef}>
              <button
                className={`${styles.filterBtn} ${styles.classDropdownToggle} ${activeEmpire ? styles.filterBtnActive : ''}`}
                onClick={() => setEmpireDropdownOpen((v) => !v)}
                aria-expanded={empireDropdownOpen}
                aria-haspopup="true"
                style={activeEmpire ? { borderColor: EMPIRE_COLORS[activeEmpire], color: EMPIRE_COLORS[activeEmpire] } : undefined}
              >
                {activeEmpire
                  ? <><span className={styles.empireDot} style={{ background: EMPIRE_COLORS[activeEmpire] }} />{empires.find((e) => e.id === activeEmpire)?.name}</>
                  : 'All Empires'}
                <svg className={styles.classDropdownChevron} width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {empireDropdownOpen && (
                <div className={styles.classDropdownMenu}>
                  <button
                    className={styles.classDropdownClear}
                    onClick={() => { setActiveEmpire(''); setEmpireDropdownOpen(false) }}
                    disabled={!activeEmpire}
                  >
                    Clear
                  </button>
                  <div className={styles.classDropdownList}>
                    {empires.map((empire) => (
                      <button
                        key={empire.id}
                        className={`${styles.filterDropdownItem} ${activeEmpire === empire.id ? styles.filterDropdownItemActive : ''}`}
                        onClick={() => { setActiveEmpire(empire.id); setEmpireDropdownOpen(false) }}
                      >
                        <span className={styles.empireDot} style={{ background: EMPIRE_COLORS[empire.id] }} />
                        <span className={styles.classDropdownLabel}>{empire.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tier dropdown */}
            <div className={styles.classDropdown} ref={tierDropdownRef}>
              <button
                className={`${styles.filterBtn} ${styles.classDropdownToggle} ${activeTier !== 0 ? styles.filterBtnActive : ''}`}
                onClick={() => setTierDropdownOpen((v) => !v)}
                aria-expanded={tierDropdownOpen}
                aria-haspopup="true"
              >
                {activeTier === 0 ? 'All Tiers' : `T${activeTier}`}
                <svg className={styles.classDropdownChevron} width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {tierDropdownOpen && (
                <div className={styles.classDropdownMenu}>
                  <button
                    className={styles.classDropdownClear}
                    onClick={() => { setActiveTier(0); setTierDropdownOpen(false) }}
                    disabled={activeTier === 0}
                  >
                    Clear
                  </button>
                  <div className={styles.classDropdownList}>
                    {tiers.map((tier) => (
                      <button
                        key={tier}
                        className={`${styles.filterDropdownItem} ${activeTier === tier ? styles.filterDropdownItemActive : ''}`}
                        onClick={() => { setActiveTier(tier); setTierDropdownOpen(false) }}
                      >
                        <span className={styles.classDropdownLabel}>T{tier}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category dropdown */}
            <div className={styles.classDropdown} ref={categoryDropdownRef}>
              <button
                className={`${styles.filterBtn} ${styles.classDropdownToggle} ${activeCategory ? styles.filterBtnActive : ''}`}
                onClick={() => setCategoryDropdownOpen((v) => !v)}
                aria-expanded={categoryDropdownOpen}
                aria-haspopup="true"
              >
                {activeCategory || 'All Categories'}
                <svg className={styles.classDropdownChevron} width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {categoryDropdownOpen && (
                <div className={styles.classDropdownMenu}>
                  <button
                    className={styles.classDropdownClear}
                    onClick={() => { setActiveCategory(''); setCategoryDropdownOpen(false) }}
                    disabled={!activeCategory}
                  >
                    Clear
                  </button>
                  <div className={styles.classDropdownList}>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        className={`${styles.filterDropdownItem} ${activeCategory === cat ? styles.filterDropdownItemActive : ''}`}
                        onClick={() => { setActiveCategory(cat); setCategoryDropdownOpen(false) }}
                      >
                        <span className={styles.classDropdownLabel}>{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Class dropdown (multi-select) */}
            <div className={styles.classDropdown} ref={classDropdownRef}>
              <button
                className={`${styles.filterBtn} ${styles.classDropdownToggle} ${activeClasses.size > 0 ? styles.filterBtnActive : ''}`}
                onClick={() => setClassDropdownOpen((v) => !v)}
                aria-expanded={classDropdownOpen}
                aria-haspopup="true"
              >
                {activeClasses.size === 0
                  ? 'All Classes'
                  : activeClasses.size === 1
                    ? [...activeClasses][0]
                    : `${activeClasses.size} classes`}
                <svg className={styles.classDropdownChevron} width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {classDropdownOpen && (
                <div className={styles.classDropdownMenu}>
                  <button
                    className={styles.classDropdownClear}
                    onClick={() => setActiveClasses(new Set())}
                    disabled={activeClasses.size === 0}
                  >
                    Clear all
                  </button>
                  <div className={styles.classDropdownList}>
                    {visibleClasses.map((cls) => (
                      <label key={cls} className={styles.classDropdownItem}>
                        <input
                          type="checkbox"
                          checked={activeClasses.has(cls)}
                          onChange={() => toggleClass(cls)}
                          className={styles.classCheckbox}
                        />
                        <span className={styles.classDropdownLabel}>{cls}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search ships..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Right-side controls */}
            <div className={styles.filterRowRight}>
              {viewMode === 'grid' && (
                <button
                  className={`${styles.filterBtn} ${allExpanded ? styles.filterBtnActive : ''}`}
                  onClick={toggleExpandAll}
                >
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              )}
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
                  onClick={() => setView('grid')}
                  title="Grid view"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="0.65" y="0.65" width="4.7" height="4.7" rx="0.8" stroke="currentColor" strokeWidth="1.3"/>
                    <rect x="7.65" y="0.65" width="4.7" height="4.7" rx="0.8" stroke="currentColor" strokeWidth="1.3"/>
                    <rect x="0.65" y="7.65" width="4.7" height="4.7" rx="0.8" stroke="currentColor" strokeWidth="1.3"/>
                    <rect x="7.65" y="7.65" width="4.7" height="4.7" rx="0.8" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                </button>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.viewToggleBtnActive : ''}`}
                  onClick={() => setView('table')}
                  title="Table view"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <line x1="1" y1="2.5" x2="12" y2="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="1" y1="6.5" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="1" y1="10.5" x2="12" y2="10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loading}>Loading ship catalog...</div>
      )}

      {!loading && error && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>Unable to Load Ships</h3>
          <p>The game server may be offline. Try again later.</p>
        </div>
      )}

      {!loading && !error && filteredShips.length === 0 && ships.length > 0 && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>No Ships Found</h3>
          <p>No ships match the current filters.</p>
        </div>
      )}

      {!loading && !error && filteredShips.length > 0 && viewMode === 'grid' && (
        <div className={styles.shipGrid}>
          {filteredShips.map((ship) => {
            const isExpanded = expandedIds.has(ship.id)
            const empireColor = EMPIRE_COLORS[ship.empire] || '#888'

            return (
              <div
                key={ship.id}
                className={`${styles.shipCard} ${isExpanded ? styles.shipCardExpanded : ''}`}
                style={{ '--empire-color': empireColor } as React.CSSProperties}
                onClick={() => toggleExpand(ship.id)}
              >
                <div className={styles.cardAccent} />
                <div className={styles.cardLeft}>
                  {!brokenImages.has(ship.id) && (
                    <div className={styles.shipImageWrap}>
                      <Image
                        src={`/images/ships/catalog/${ship.id}.webp`}
                        alt={ship.name}
                        width={600}
                        height={450}
                        className={styles.shipImage}
                        onError={() => handleImageError(ship.id)}
                      />
                      <button
                        className={styles.zoomBtn}
                        onClick={(e) => { e.stopPropagation(); setZoomedShip(ship) }}
                        aria-label={`View ${ship.name} full size`}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M1 5V1H5M9 1H13V5M13 9V13H9M5 13H1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  )}
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.shipName}>{ship.name}</h3>
                    <span className={styles.tierBadge}>
                      T{ship.tier}
                    </span>
                  </div>

                  <div className={styles.cardTags}>
                    <span className={styles.empireBadge}>
                      <span
                        className={styles.empireDot}
                        style={{ background: empireColor }}
                      />
                      <span style={{ color: empireColor }}>
                        {ship.empire_name}
                      </span>
                    </span>
                    <span className={styles.classBadge}>{ship.class}</span>
                    <span className={styles.priceBadge}>
                      {ship.starter_ship ? 'Free' : `${formatNumber(ship.price)} cr`}
                    </span>
                  </div>

                  <p className={styles.shipDescription}>{ship.description}</p>

                  <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Hull</span>
                      <span className={styles.statValue}>{ship.base_hull}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Shield</span>
                      <span className={styles.statValue}>{ship.base_shield}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Speed</span>
                      <span className={styles.statValue}>{ship.base_speed}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Cargo</span>
                      <span className={styles.statValue}>{ship.cargo_capacity}</span>
                    </div>
                  </div>

                  <div className={styles.slotsRow}>
                    {ship.weapon_slots > 0 && (
                      <span className={styles.slotItem}>
                        <span className={`${styles.slotIcon} ${styles.weaponSlot}`}>&#x2694;</span>
                        {ship.weapon_slots}
                      </span>
                    )}
                    {ship.defense_slots > 0 && (
                      <span className={styles.slotItem}>
                        <span className={`${styles.slotIcon} ${styles.defenseSlot}`}>&#x1F6E1;</span>
                        {ship.defense_slots}
                      </span>
                    )}
                    {ship.utility_slots > 0 && (
                      <span className={styles.slotItem}>
                        <span className={`${styles.slotIcon} ${styles.utilitySlot}`}>&#x2699;</span>
                        {ship.utility_slots}
                      </span>
                    )}
                  </div>

                  {isExpanded && ship.build_materials && ship.build_materials.length > 0 && (
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>Build Materials</h4>
                      <div className={styles.materialsList}>
                        {ship.build_materials.map((mat) => (
                          <div key={mat.item_id} className={styles.materialItem}>
                            <span className={styles.materialName}>{mat.item_name}</span>
                            <span className={styles.materialQty}>x{mat.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {ship.shipyard_tier > 0 && (
                        <p className={styles.skillItem} style={{ marginTop: '0.5rem' }}>
                          Requires Shipyard Level {ship.shipyard_tier}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                </div>

                {isExpanded && (
                  <div className={styles.expandedDetail}>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>Full Stats</h4>
                      <div className={styles.fullStatsGrid}>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Hull</span>
                          <span className={styles.fullStatValue}>{ship.base_hull}</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Shield</span>
                          <span className={styles.fullStatValue}>{ship.base_shield}</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Shield Regen</span>
                          <span className={styles.fullStatValue}>{ship.base_shield_recharge}/tick</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Armor</span>
                          <span className={styles.fullStatValue}>{ship.base_armor}</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Speed</span>
                          <span className={styles.fullStatValue}>{ship.base_speed} AU/tick</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Fuel</span>
                          <span className={styles.fullStatValue}>{ship.base_fuel}</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Cargo</span>
                          <span className={styles.fullStatValue}>{ship.cargo_capacity}</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>CPU</span>
                          <span className={styles.fullStatValue}>{ship.cpu_capacity}</span>
                        </div>
                        <div className={styles.fullStatItem}>
                          <span className={styles.fullStatLabel}>Power</span>
                          <span className={styles.fullStatValue}>{ship.power_capacity}</span>
                        </div>
                      </div>
                    </div>

                    {ship.required_skills && Object.keys(ship.required_skills).length > 0 && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>Required Skills</h4>
                        <div className={styles.skillsList}>
                          {Object.entries(ship.required_skills).map(([skill, level]) => (
                            <span key={skill} className={styles.skillItem}>
                              {formatSkillName(skill)} Lv.{level}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {ship.lore && (
                      <div className={`${styles.detailSection} ${styles.detailSectionWide}`}>
                        <h4 className={styles.detailSectionTitle}>Lore</h4>
                        <p className={styles.loreText}>{ship.lore}</p>
                      </div>
                    )}

                    {ship.special && (
                      <div className={`${styles.detailSection} ${styles.detailSectionWide}`}>
                        <h4 className={styles.detailSectionTitle}>Special</h4>
                        <p className={styles.loreText}>{ship.special}</p>
                      </div>
                    )}

                    {ship.flavor_tags && ship.flavor_tags.length > 0 && (
                      <div className={styles.flavorTags}>
                        {ship.flavor_tags.map((tag) => (
                          <span key={tag} className={styles.flavorTag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!loading && !error && filteredShips.length > 0 && viewMode === 'table' && (
        <div className={styles.tableWrap}>
          <table className={styles.shipTable}>
            <thead>
              <tr>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col.key}
                    className={`${styles.tableHeaderCell} ${sortCol === col.key ? styles.sortActive : ''}`}
                    onClick={() => handleSort(col.key as keyof Ship)}
                    title={col.title}
                  >
                    {col.label}
                    <span className={styles.sortIndicator}>
                      {sortCol === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableShips.map((ship) => {
                const isExpanded = tableExpandedId === ship.id
                const empireColor = EMPIRE_COLORS[ship.empire] || '#888'
                return (
                  <Fragment key={ship.id}>
                    <tr
                      className={`${styles.tableRow} ${isExpanded ? styles.tableRowExpanded : ''}`}
                      onClick={() => setTableExpandedId(isExpanded ? null : ship.id)}
                    >
                      <td className={`${styles.tableCell} ${styles.tableName}`}>
                        <span className={styles.tableEmpireAccent} style={{ background: empireColor }} />
                        {ship.name}
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles.empireDot} style={{ background: empireColor }} />
                        {' '}{ship.empire_name}
                      </td>
                      <td className={styles.tableCell}>{ship.category}</td>
                      <td className={styles.tableCell}>{ship.class}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>T{ship.tier}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.base_hull}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.base_shield}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.base_shield_recharge}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.base_armor}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.base_speed}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.base_fuel}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.cargo_capacity}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.cpu_capacity}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.power_capacity}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.weapon_slots}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.defense_slots}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.utility_slots}</td>
                      <td className={`${styles.tableCell} ${styles.tableCellNum}`}>{ship.price.toLocaleString()}</td>
                    </tr>
                    {isExpanded && (
                      <tr className={styles.tableExpandRow}>
                        <td colSpan={TABLE_COLS.length} className={styles.tableExpandCell}>
                          <div className={styles.tableExpandContent}>
                            {!brokenImages.has(ship.id) && (
                              <div className={styles.tableExpandImageWrap}>
                                <Image
                                  src={`/images/ships/catalog/${ship.id}.webp`}
                                  alt={ship.name}
                                  width={560}
                                  height={420}
                                  className={styles.tableExpandImage}
                                  onError={() => handleImageError(ship.id)}
                                />
                                <button
                                  className={styles.zoomBtn}
                                  onClick={(e) => { e.stopPropagation(); setZoomedShip(ship) }}
                                  aria-label={`View ${ship.name} full size`}
                                >
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M1 5V1H5M9 1H13V5M13 9V13H9M5 13H1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              </div>
                            )}
                            <div className={styles.tableExpandText}>
                              <p className={styles.tableExpandDescription}>{ship.description}</p>
                              {ship.lore && <p className={styles.tableExpandLore}>{ship.lore}</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {zoomedShip && (
        <div className={styles.modalOverlay} onClick={() => setZoomedShip(null)}>
          <button className={styles.modalClose} onClick={() => setZoomedShip(null)} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <Image
              src={`/images/ships/catalog/${zoomedShip.id}.webp`}
              alt={zoomedShip.name}
              width={1200}
              height={900}
              className={styles.modalImage}
            />
            <div className={styles.modalCaption}>
              <span className={styles.modalShipName}>{zoomedShip.name}</span>
              <span className={styles.modalShipDesc}>{zoomedShip.description}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
