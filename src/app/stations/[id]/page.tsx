'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface Facility {
  id: string
  name: string
  description: string
  active_description: string
  category: string
  level: number
  service_type: string
  empire: string
  lore: string
  unique: boolean
  maintenance_satisfied: boolean
  active: boolean
}

interface StationDetail {
  id: string
  name: string
  description: string
  empire: string
  empire_name: string
  system_id: string
  system_name: string
  condition: string
  condition_text: string
  satisfaction_pct: number
  defense_level: number
  public_access: boolean
  facilities: Facility[]
}

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

const CONDITION_COLORS: Record<string, string> = {
  thriving: 'var(--bio-green)',
  operational: 'var(--plasma-cyan)',
  struggling: 'var(--warning-yellow)',
  critical: 'var(--claw-red)',
}

const CATEGORY_ORDER = ['service', 'infrastructure', 'production', 'faction']

const CATEGORY_LABELS: Record<string, string> = {
  service: 'Service',
  infrastructure: 'Infrastructure',
  production: 'Production',
  faction: 'Faction',
}

function groupFacilitiesByCategory(facilities: Facility[]): Record<string, Facility[]> {
  const groups: Record<string, Facility[]> = {}
  for (const facility of facilities) {
    const cat = facility.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(facility)
  }
  return groups
}

function renderLevelIndicator(level: number) {
  const maxLevel = 5
  const filled = Math.min(level, maxLevel)
  const segments: React.ReactNode[] = []
  for (let i = 0; i < maxLevel; i++) {
    segments.push(
      <span
        key={i}
        className={i < filled ? styles.levelSegmentFilled : styles.levelSegmentEmpty}
      />
    )
  }
  return <span className={styles.levelIndicator}>{segments}</span>
}

export default function StationDetailPage() {
  const params = useParams()
  const stationId = params.id as string

  const [station, setStation] = useState<StationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [expandedLore, setExpandedLore] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!stationId) return

    async function fetchStation() {
      setLoading(true)
      setError(false)
      setNotFound(false)
      try {
        const response = await fetch(
          `${API_BASE}/api/stations/${encodeURIComponent(stationId)}`
        )
        if (response.status === 404) {
          setNotFound(true)
          return
        }
        if (!response.ok) {
          setError(true)
          return
        }
        const data: StationDetail = await response.json()
        setStation(data)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchStation()
  }, [stationId])

  useEffect(() => {
    if (station) {
      document.title = `${station.name} - SpaceMolt Stations`
    } else {
      document.title = 'Station - SpaceMolt'
    }
  }, [station])

  function toggleLore(facilityId: string) {
    setExpandedLore((prev) => ({
      ...prev,
      [facilityId]: !prev[facilityId],
    }))
  }

  if (loading) {
    return (
      <main className={styles.main}>
        <Link href="/stations" className={styles.backLink}>
          &larr; Back to Stations
        </Link>
        <div className={styles.loading}>Loading station data...</div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className={styles.main}>
        <Link href="/stations" className={styles.backLink}>
          &larr; Back to Stations
        </Link>
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>Station Not Found</h3>
          <p>This station does not exist or the ID is invalid.</p>
        </div>
      </main>
    )
  }

  if (error || !station) {
    return (
      <main className={styles.main}>
        <Link href="/stations" className={styles.backLink}>
          &larr; Back to Stations
        </Link>
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>Unable to Load Station</h3>
          <p>The game server may be offline. Try again later.</p>
        </div>
      </main>
    )
  }

  const empireColor = EMPIRE_COLORS[station.empire] || '#888'
  const conditionColor = CONDITION_COLORS[station.condition] || 'var(--chrome-silver)'
  const facilityGroups = groupFacilitiesByCategory(station.facilities || [])
  const orderedCategories = CATEGORY_ORDER.filter((cat) => facilityGroups[cat])
  const extraCategories = Object.keys(facilityGroups).filter(
    (cat) => !CATEGORY_ORDER.includes(cat)
  )
  const allCategories = [...orderedCategories, ...extraCategories]

  return (
    <main className={styles.main}>
      <Link href="/stations" className={styles.backLink}>
        &larr; Back to Stations
      </Link>

      {/* Hero Section */}
      <section
        className={styles.hero}
        style={{ '--empire-color': empireColor } as React.CSSProperties}
      >
        <div className={styles.heroAccent} />
        <div className={styles.heroContent}>
          <div className={styles.heroHeader}>
            <h1 className={styles.heroTitle}>{station.name}</h1>
            <div className={styles.heroBadges}>
              <span className={styles.empireBadge}>
                <span
                  className={styles.empireDot}
                  style={{ background: empireColor }}
                />
                <span style={{ color: empireColor }}>{station.empire_name}</span>
              </span>
              <span
                className={styles.conditionBadge}
                style={{ color: conditionColor }}
              >
                {station.condition}
              </span>
            </div>
          </div>
          <p className={styles.heroDescription}>{station.description}</p>
          {station.condition_text && (
            <p className={styles.conditionText}>{station.condition_text}</p>
          )}
        </div>
      </section>

      {/* Info Bar */}
      <section className={styles.infoBar}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>System</span>
          <Link href="/map" className={styles.infoValueLink}>
            {station.system_name}
          </Link>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Defense</span>
          <span className={styles.infoValue}>{station.defense_level}%</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Satisfaction</span>
          <span className={styles.infoValue}>{station.satisfaction_pct}%</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Access</span>
          <span className={styles.infoValue}>
            {station.public_access ? 'Public' : 'Restricted'}
          </span>
        </div>
      </section>

      {/* Facilities */}
      {allCategories.length > 0 && (
        <section className={styles.facilitiesSection}>
          <h2 className={styles.sectionTitle}>Facilities</h2>
          {allCategories.map((category) => (
            <div key={category} className={styles.facilityGroup}>
              <h3 className={styles.categoryHeader}>
                {CATEGORY_LABELS[category] || category}
              </h3>
              <div className={styles.facilityGrid}>
                {facilityGroups[category].map((facility) => (
                  <div
                    key={facility.id}
                    className={styles.facilityCard}
                    style={{ '--empire-color': EMPIRE_COLORS[facility.empire] || empireColor } as React.CSSProperties}
                  >
                    <div className={styles.facilityAccent} />
                    <div className={styles.facilityBody}>
                      <div className={styles.facilityHeader}>
                        <h4 className={styles.facilityName}>
                          {facility.name}
                          {facility.unique && (
                            <span className={styles.uniqueBadge}>Unique</span>
                          )}
                        </h4>
                        <span
                          className={styles.maintenanceStatus}
                          title={facility.maintenance_satisfied ? 'Maintenance satisfied' : 'Maintenance needed'}
                        >
                          {facility.maintenance_satisfied ? '\u2714' : '\u26A0'}
                        </span>
                      </div>
                      <div className={styles.facilityMeta}>
                        <span className={styles.categoryBadge}>
                          {facility.category}
                        </span>
                        <span className={styles.facilityLevel}>
                          Lv {facility.level} {renderLevelIndicator(facility.level)}
                        </span>
                      </div>
                      <p className={styles.facilityDescription}>
                        {facility.maintenance_satisfied
                          ? facility.active_description
                          : facility.description}
                      </p>
                      {facility.lore && (
                        <div className={styles.loreSection}>
                          <button
                            className={styles.loreToggle}
                            onClick={() => toggleLore(facility.id)}
                          >
                            {expandedLore[facility.id] ? '// Hide lore' : '// Show lore'}
                          </button>
                          {expandedLore[facility.id] && (
                            <p className={styles.loreText}>{facility.lore}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
