'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState,
} from 'nuqs'
import { Swords, Shield, Cog, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { EMPIRE_SHORT_KEYS, empireColor, shipArtSrc, type ShipListEntry } from './shipMeta'
import styles from './ships.module.css'

/*
 * The ship browser. Every hull is a real page under /codex/ships/<id>; the card
 * and the table row are anchors to it, so the catalog stays crawlable and the
 * back button returns to the list the visitor was actually looking at.
 *
 * Filters, sort, and view mode live in the URL rather than in useState: a
 * filtered list is shareable, and coming back from a detail page restores it.
 * Defaults are never serialized (nuqs clears them), so the bare /codex/ships
 * URL stays clean.
 */

const TABLE_COLS = [
  { key: 'name',                 label: 'Name',    tKey: 'ships.colName',     title: 'Name',                 numeric: false },
  { key: 'empireName',           label: 'Empire',  tKey: 'ships.colEmpire',   title: 'Empire',               numeric: false },
  { key: 'category',             label: 'Category',tKey: 'ships.colCategory', title: 'Category',             numeric: false },
  { key: 'class',                label: 'Class',   tKey: 'ships.colClass',    title: 'Class',                numeric: false },
  { key: 'tier',                 label: 'T',       tKey: 'ships.colTier',     title: 'Tier',                 numeric: true  },
  { key: 'base_hull',            label: 'Hull',    tKey: 'ships.colHull',     title: 'Hull HP',              numeric: true  },
  { key: 'base_shield',          label: 'Shield',  tKey: 'ships.colShield',   title: 'Shield HP',            numeric: true  },
  { key: 'base_shield_recharge', label: 'ShRgn',   tKey: '',                  title: 'Shield Recharge/tick', numeric: true  },
  { key: 'base_armor',           label: 'Armor',   tKey: 'ships.colArmor',    title: 'Armor',                numeric: true  },
  { key: 'base_speed',           label: 'Speed',   tKey: 'ships.colSpeed',    title: 'Speed (AU/tick)',      numeric: true  },
  { key: 'base_fuel',            label: 'Fuel',    tKey: 'ships.colFuel',     title: 'Fuel Capacity',        numeric: true  },
  { key: 'cargo_capacity',       label: 'Cargo',   tKey: 'ships.colCargo',    title: 'Cargo Capacity',       numeric: true  },
  { key: 'cpu_capacity',         label: 'CPU',     tKey: 'ships.colCPU',      title: 'CPU Capacity',         numeric: true  },
  { key: 'power_capacity',       label: 'Power',   tKey: 'ships.colPower',    title: 'Power Capacity',       numeric: true  },
  { key: 'weapon_slots',         label: 'Wpn',     tKey: 'ships.colWeapons',  title: 'Weapon Slots',         numeric: true  },
  { key: 'defense_slots',        label: 'Def',     tKey: 'ships.colDefense',  title: 'Defense Slots',        numeric: true  },
  { key: 'utility_slots',        label: 'Util',    tKey: 'ships.colUtility',  title: 'Utility Slots',        numeric: true  },
] as const

type SortKey = (typeof TABLE_COLS)[number]['key']

const SORT_KEYS = TABLE_COLS.map((c) => c.key) as unknown as SortKey[]

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

interface Empire {
  id: string
  name: string
}

interface ShipsBrowserProps {
  ships: ShipListEntry[]
  empires: Empire[]
  classes: string[]
  categories: string[]
  tiers: number[]
}

function shipHref(id: string): string {
  return `/codex/ships/${id}`
}

function GuideSection() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <div className={styles.guideSection}>
      <div className={`console-panel ${styles.guidePanel} ${open ? styles.guidePanelOpen : ''}`}>
        <button
          className={styles.guidePanelToggle}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={styles.guidePanelTitle}>{t('ships.howToGetShips')}</span>
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
                <h2 className={styles.guideColumnTitle}>{t('ships.buyFromShowroom')}</h2>
                <p>
                  The fastest way to get a new ship. Dock at any station with a shipyard and browse
                  the showroom for ships ready for immediate purchase. Shipyard managers keep their
                  showrooms stocked by sourcing materials from the market and building ships in
                  advance. Showroom prices include a convenience markup &mdash; you pay a premium,
                  but you fly out immediately.
                </p>
              </div>
              <div className={styles.guideColumn}>
                <h2 className={styles.guideColumnTitle}>{t('ships.commissionBuild')}</h2>
                <p>
                  For more control or better prices, commission a shipyard to build a ship to order.
                  Pay credits only and the shipyard sources materials from the market (with a markup),
                  or supply the build materials yourself and pay only labor. Significantly cheaper,
                  but you source every component. Build times vary by ship class.
                </p>
              </div>
              <div className={styles.guideColumn}>
                <h2 className={styles.guideColumnTitle}>{t('ships.buyFromPlayers')}</h2>
                <p>
                  Players can list stored ships for sale on any station&apos;s exchange. Prices vary
                  &mdash; sometimes below showroom price, especially for ships with modules installed.
                  The player exchange also lets you buy empire-exclusive ships outside that
                  empire&apos;s territory.
                </p>
              </div>
              <div className={styles.guideColumn}>
                <h2 className={styles.guideColumnTitle}>{t('ships.economyRole')}</h2>
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

export function ShipsBrowser({ ships, empires, classes, categories, tiers }: ShipsBrowserProps) {
  const { t } = useTranslation()

  const [viewMode, setViewMode] = useQueryState(
    'v', parseAsStringLiteral(['grid', 'table'] as const).withDefault('grid'),
  )
  const [sortCol, setSortCol] = useQueryState('s', parseAsStringLiteral(SORT_KEYS).withDefault('tier'))
  const [sortDir, setSortDir] = useQueryState(
    'd', parseAsStringLiteral(['asc', 'desc'] as const).withDefault('asc'),
  )
  const [activeEmpire, setActiveEmpire] = useQueryState('e', parseAsString.withDefault(''))
  const [activeCategory, setActiveCategory] = useQueryState('c', parseAsString.withDefault(''))
  const [activeClasses, setActiveClasses] = useQueryState(
    'cl', parseAsArrayOf(parseAsString).withDefault([]),
  )
  const [activeTier, setActiveTier] = useQueryState('t', parseAsInteger.withDefault(0))
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))

  const [classDropdownOpen, setClassDropdownOpen] = useState(false)
  const classDropdownRef = useRef<HTMLDivElement>(null)
  const [empireDropdownOpen, setEmpireDropdownOpen] = useState(false)
  const empireDropdownRef = useRef<HTMLDivElement>(null)
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false)
  const tierDropdownRef = useRef<HTMLDivElement>(null)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())

  const handleImageError = useCallback((shipId: string) => {
    setBrokenImages((prev) => {
      const next = new Set(prev)
      next.add(shipId)
      return next
    })
  }, [])

  const toggleClass = useCallback((cls: string) => {
    setActiveClasses((prev) => {
      const current = prev ?? []
      return current.includes(cls)
        ? current.filter((c) => c !== cls)
        : [...current, cls]
    })
  }, [setActiveClasses])

  const handleSort = useCallback((col: SortKey) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }, [sortCol, sortDir, setSortCol, setSortDir])

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

  const visibleClasses = useMemo(() => {
    if (!activeCategory) return classes
    const inCategory = new Set(ships.filter((s) => s.category === activeCategory).map((s) => s.class))
    return classes.filter((c) => inCategory.has(c))
  }, [classes, ships, activeCategory])

  const filteredShips = useMemo(() => {
    let result = ships
    if (activeEmpire) {
      result = result.filter((s) => s.empire === activeEmpire)
    }
    if (activeCategory) {
      result = result.filter((s) => s.category === activeCategory)
    }
    if (activeClasses.length > 0) {
      result = result.filter((s) => activeClasses.includes(s.class))
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
          s.special.toLowerCase().includes(q)
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

  return (
    <>
      <p className={styles.shipCount}>
        {t('ships.shipCount', { filtered: String(filteredShips.length), total: String(ships.length) })}
      </p>

      <h2 style={srOnly}>Filter Ships</h2>
      <h2 style={srOnly}>Ship Catalog</h2>

      <GuideSection />

      <div className={`console-panel ${styles.filterSection}`}>
        <div className={styles.filterRow}>

          {/* Empire dropdown */}
          <div className={styles.classDropdown} ref={empireDropdownRef}>
            <button
              className={`${styles.filterBtn} ${styles.classDropdownToggle} ${activeEmpire ? styles.filterBtnActive : ''}`}
              onClick={() => setEmpireDropdownOpen((v) => !v)}
              aria-expanded={empireDropdownOpen}
              aria-haspopup="true"
              style={activeEmpire ? { borderColor: empireColor(activeEmpire), color: empireColor(activeEmpire) } : undefined}
            >
              {activeEmpire
                ? <><span className={styles.empireDot} style={{ background: empireColor(activeEmpire) }} />{empires.find((e) => e.id === activeEmpire)?.name}</>
                : t('ships.allEmpires')}
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
                      <span className={styles.empireDot} style={{ background: empireColor(empire.id) }} />
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
              {activeTier === 0 ? t('ships.allTiers') : `T${activeTier}`}
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
              {activeCategory || t('ships.allCategories')}
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
              className={`${styles.filterBtn} ${styles.classDropdownToggle} ${activeClasses.length > 0 ? styles.filterBtnActive : ''}`}
              onClick={() => setClassDropdownOpen((v) => !v)}
              aria-expanded={classDropdownOpen}
              aria-haspopup="true"
            >
              {activeClasses.length === 0
                ? t('ships.allClasses')
                : activeClasses.length === 1
                  ? activeClasses[0]
                  : `${activeClasses.length} classes`}
              <svg className={styles.classDropdownChevron} width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {classDropdownOpen && (
              <div className={styles.classDropdownMenu}>
                <button
                  className={styles.classDropdownClear}
                  onClick={() => setActiveClasses([])}
                  disabled={activeClasses.length === 0}
                >
                  Clear all
                </button>
                <div className={styles.classDropdownList}>
                  {visibleClasses.map((cls) => (
                    <label key={cls} className={styles.classDropdownItem}>
                      <input
                        type="checkbox"
                        checked={activeClasses.includes(cls)}
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
            placeholder={t('ships.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Right-side controls */}
          <div className={styles.filterRowRight}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setViewMode('grid')}
                title={t('ships.gridView')}
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
                onClick={() => setViewMode('table')}
                title={t('ships.tableView')}
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

      {filteredShips.length === 0 && (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>{t('ships.noResults')}</h2>
          <p>{t('ships.noResultsDesc')}</p>
        </div>
      )}

      {filteredShips.length > 0 && viewMode === 'grid' && (
        <div className={styles.shipGrid}>
          {filteredShips.map((ship) => (
            <Link
              key={ship.id}
              href={shipHref(ship.id)}
              className={styles.shipCard}
              style={{ '--empire-color': empireColor(ship.empire) } as React.CSSProperties}
            >
              <div className={styles.cardAccent} />
              <div className={styles.cardLeft}>
                {!brokenImages.has(ship.id) && (
                  <div className={styles.shipImageWrap}>
                    <Image
                      src={shipArtSrc(ship.id)}
                      alt={ship.name}
                      width={600}
                      height={450}
                      className={styles.shipImage}
                      onError={() => handleImageError(ship.id)}
                    />
                  </div>
                )}
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.shipName}>{ship.name}</h2>
                    <span className={styles.tierBadge}>T{ship.tier}</span>
                  </div>

                  <div className={styles.cardTags}>
                    {ship.empireName && (
                      <span className={styles.empireBadge}>
                        <span
                          className={styles.empireDot}
                          style={{ background: empireColor(ship.empire) }}
                        />
                        <span style={{ color: empireColor(ship.empire) }}>{ship.empireName}</span>
                      </span>
                    )}
                    {ship.prestige && (
                      <span className={styles.prestigeBadge} title="Unlocked by completing a special achievement">
                        Achievement Unlock
                      </span>
                    )}
                    <span className={styles.classBadge}>{ship.class}</span>
                    {ship.starter && <span className={styles.priceBadge}>Free</span>}
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
                        <span className={`${styles.slotIcon} ${styles.weaponSlot}`}><Swords size={12} aria-hidden /></span>
                        {ship.weapon_slots}
                      </span>
                    )}
                    {ship.defense_slots > 0 && (
                      <span className={styles.slotItem}>
                        <span className={`${styles.slotIcon} ${styles.defenseSlot}`}><Shield size={12} aria-hidden /></span>
                        {ship.defense_slots}
                      </span>
                    )}
                    {ship.utility_slots > 0 && (
                      <span className={styles.slotItem}>
                        <span className={`${styles.slotIcon} ${styles.utilitySlot}`}><Cog size={12} aria-hidden /></span>
                        {ship.utility_slots}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {filteredShips.length > 0 && viewMode === 'table' && (
        <div className={`console-panel ${styles.tablePanel}`}>
          {/* The rows scroll in here, not in #console-main (the header is sticky
              against this scrollport), so it opts into scroll restoration. */}
          <div className={styles.tableWrap} data-scroll-restore="ships-table">
            <table className={styles.shipTable}>
              <thead>
                <tr>
                  {TABLE_COLS.map((col) => (
                    <th
                      key={col.key}
                      className={`${styles.tableHeaderCell} ${sortCol === col.key ? styles.sortActive : ''}`}
                      onClick={() => handleSort(col.key)}
                      title={col.title}
                      aria-sort={sortCol === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {col.tKey ? t(col.tKey) : col.label}
                      <span className={styles.sortIndicator} aria-hidden>
                        {sortCol === col.key
                          ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                          : <ChevronsUpDown size={11} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableShips.map((ship) => (
                  <tr
                    key={ship.id}
                    className={styles.tableRow}
                    // Convenience only — the name cell holds the real anchor, so
                    // keyboard and crawler both reach the hull without this. The
                    // click is forwarded to that anchor rather than pushed to the
                    // router, so a row click and a name click are the same
                    // navigation: one code path, and scroll restoration's
                    // anchor-click handler covers both.
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return
                      e.currentTarget.querySelector('a')?.click()
                    }}
                  >
                    <td className={`${styles.tableCell} ${styles.tableName}`}>
                      <span className={styles.tableEmpireAccent} style={{ background: empireColor(ship.empire) }} />
                      <Link href={shipHref(ship.id)} className={styles.tableNameLink}>
                        {ship.name}
                      </Link>
                    </td>
                    <td className={styles.tableCell}>
                      {ship.empireName ? (
                        <>
                          <span className={styles.empireDot} style={{ background: empireColor(ship.empire) }} />
                          {' '}{EMPIRE_SHORT_KEYS[ship.empire] ? t(EMPIRE_SHORT_KEYS[ship.empire]) : ship.empireName}
                        </>
                      ) : ship.prestige ? (
                        <span className={styles.prestigeBadge} title="Unlocked by completing a special achievement">
                          Achievement Unlock
                        </span>
                      ) : null}
                    </td>
                    <td className={styles.tableCell}>{ship.category}</td>
                    <td className={`${styles.tableCell} ${styles.tableClass}`}>{ship.class}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
