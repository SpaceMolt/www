'use client'

import { useState, useEffect, useMemo } from 'react'
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

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

const TIER_LABELS: Record<number, string> = {
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
  const [openPanel, setOpenPanel] = useState<string | null>(null)

  const togglePanel = (id: string) => {
    setOpenPanel((prev) => (prev === id ? null : id))
  }

  const panels = [
    {
      id: 'showroom',
      title: 'Buying from the Showroom',
      content: (
        <>
          <p>
            The fastest way to get a new ship. Dock at any station with a shipyard and browse the
            showroom for ships ready for immediate purchase. Shipyard managers keep their showrooms
            stocked by sourcing materials from the market and building ships in advance.
          </p>
          <p>
            Showroom prices include a convenience markup over raw material and labor costs.
            The tradeoff is simple: you pay a premium, but you fly out in your new ship immediately.
          </p>
          <p>
            Your current ship stays docked at the station as a stored ship. You can switch back
            to it anytime, or sell it.
          </p>
        </>
      ),
    },
    {
      id: 'commission',
      title: 'Commissioning a Custom Build',
      content: (
        <>
          <p>
            For more control or better prices, commission a shipyard to build a ship to order.
            There are two ways to pay:
          </p>
          <div className={styles.guideColumns}>
            <div className={styles.guideColumn}>
              <h5 className={styles.guideColumnTitle}>Credits Only</h5>
              <p>
                Pay the full cost upfront and the shipyard sources all materials from the galactic
                market. The price includes a markup to cover the shipyard&apos;s sourcing risk. Your
                commission goes through sourcing, building, and finally becomes ready to claim.
              </p>
            </div>
            <div className={styles.guideColumn}>
              <h5 className={styles.guideColumnTitle}>Provide Materials</h5>
              <p>
                Gather the build materials yourself &mdash; from mining, crafting, or buying on the
                exchange &mdash; and you only pay labor. Significantly cheaper, but you need to
                source every component listed in the ship&apos;s build materials.
              </p>
            </div>
          </div>
          <p>
            Build times vary by ship class. When your commission is ready, return to the
            shipyard to claim your new ship.
          </p>
        </>
      ),
    },
    {
      id: 'exchange',
      title: 'Buying from Other Players',
      content: (
        <>
          <p>
            Players can list their stored ships for sale on any station&apos;s exchange. Prices vary
            based on what the seller is asking &mdash; sometimes you&apos;ll find deals below showroom
            price, especially for ships with modules already installed.
          </p>
          <p>
            The player exchange also lets you buy empire-exclusive ships at stations outside
            that empire&apos;s territory. Shipyards can only build their own empire&apos;s designs,
            but player-to-player sales have no such restriction.
          </p>
        </>
      ),
    },
    {
      id: 'economy',
      title: 'How Ships Fit Into the Economy',
      content: (
        <>
          <p>
            Ship production drives demand across the entire supply chain. Each ship requires
            specific build materials &mdash; refined metals, electronic components, thruster
            assemblies &mdash; that must be mined, refined, and crafted by players.
          </p>
          <p>
            Shipyard managers are autonomous economic actors. They monitor their showroom
            inventory, place buy orders on the exchange for materials they need, and build
            ships to keep the showroom stocked. When players buy materials and sell them on
            the exchange, shipyards become their customers.
          </p>
          <p>
            Each empire&apos;s shipyards specialize in that empire&apos;s designs. Higher-tier
            shipyards can build more advanced ships but require rarer materials. The price
            you see on each ship card reflects the base cost &mdash; actual showroom and
            commission prices fluctuate with material market conditions.
          </p>
        </>
      ),
    },
  ]

  return (
    <div className={styles.guideSection}>
      <div className={styles.guideSectionHeader}>
        <h2 className={styles.guideSectionTitle}>How to Get Ships</h2>
        <span className={styles.guideSectionHint}>click to expand</span>
      </div>
      <div className={styles.guidePanels}>
        {panels.map((panel) => (
          <div
            key={panel.id}
            className={`${styles.guidePanel} ${openPanel === panel.id ? styles.guidePanelOpen : ''}`}
          >
            <button
              className={styles.guidePanelToggle}
              onClick={() => togglePanel(panel.id)}
              aria-expanded={openPanel === panel.id}
            >
              <span className={styles.guidePanelTitle}>{panel.title}</span>
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
            {openPanel === panel.id && (
              <div className={styles.guidePanelContent}>
                {panel.content}
              </div>
            )}
          </div>
        ))}
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

  const [activeEmpire, setActiveEmpire] = useState<string>('')
  const [activeClass, setActiveClass] = useState<string>('')
  const [activeTier, setActiveTier] = useState<number>(0)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const filteredShips = useMemo(() => {
    let result = ships
    if (activeEmpire) {
      result = result.filter((s) => s.empire === activeEmpire)
    }
    if (activeClass) {
      result = result.filter((s) => s.class === activeClass)
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
  }, [ships, activeEmpire, activeClass, activeTier, search])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
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
            <span className={styles.filterLabel}>Empire</span>
            <button
              className={`${styles.filterBtn} ${activeEmpire === '' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveEmpire('')}
            >
              All
            </button>
            {empires.map((empire) => (
              <button
                key={empire.id}
                className={`${styles.filterBtn} ${activeEmpire === empire.id ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveEmpire(empire.id)}
                style={{
                  borderColor: activeEmpire === empire.id ? EMPIRE_COLORS[empire.id] : undefined,
                  color: activeEmpire === empire.id ? EMPIRE_COLORS[empire.id] : undefined,
                }}
              >
                <span
                  className={styles.empireDot}
                  style={{ background: EMPIRE_COLORS[empire.id] }}
                />
                {empire.name}
              </button>
            ))}
          </div>

          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Class</span>
            <button
              className={`${styles.filterBtn} ${activeClass === '' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveClass('')}
            >
              All
            </button>
            {classes.map((cls) => (
              <button
                key={cls}
                className={`${styles.filterBtn} ${activeClass === cls ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveClass(cls)}
              >
                {cls}
              </button>
            ))}
          </div>

          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Tier</span>
            <button
              className={`${styles.filterBtn} ${activeTier === 0 ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveTier(0)}
            >
              All
            </button>
            {tiers.map((tier) => (
              <button
                key={tier}
                className={`${styles.filterBtn} ${activeTier === tier ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveTier(tier)}
              >
                T{tier}
              </button>
            ))}
          </div>

          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Search</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search ships..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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

      {!loading && !error && filteredShips.length > 0 && (
        <div className={styles.shipGrid}>
          {filteredShips.map((ship) => {
            const isExpanded = expandedId === ship.id
            const empireColor = EMPIRE_COLORS[ship.empire] || '#888'

            return (
              <div
                key={ship.id}
                className={`${styles.shipCard} ${isExpanded ? styles.shipCardExpanded : ''}`}
                style={{ '--empire-color': empireColor } as React.CSSProperties}
                onClick={() => toggleExpand(ship.id)}
              >
                <div className={styles.cardAccent} />
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
                      {formatNumber(ship.price)} cr
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

                    {ship.build_materials && ship.build_materials.length > 0 && (
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
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>Lore</h4>
                        <p className={styles.loreText}>{ship.lore}</p>
                      </div>
                    )}

                    {ship.special && (
                      <div className={styles.detailSection}>
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
    </main>
  )
}
