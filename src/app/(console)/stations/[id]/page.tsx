'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Wrench } from 'lucide-react'
import { useTranslation } from '@/i18n'
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
  faction_id?: string
  faction_name?: string
  faction_tag?: string
  faction_color?: string
  system_id: string
  system_name: string
  condition: string
  condition_text: string
  satisfaction_pct: number
  hull: number
  max_hull: number
  shield: number
  max_shield: number
  armor: number
  wrecked: boolean
  weapon_dps: number
  weapon_reach: number
  public_access: boolean
  facilities: Facility[]
}

export const EMPIRE_COLORS: Record<string, string> = {
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

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  service: 'stationDetail.catService',
  infrastructure: 'stationDetail.catInfrastructure',
  production: 'stationDetail.catProduction',
  faction: 'stationDetail.catFaction',
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

function BackLink({ label }: { label: string }) {
  return (
    <Link href="/stations" className={styles.backLink}>
      <ArrowLeft size={13} aria-hidden />
      {label}
    </Link>
  )
}

export default function StationDetailPage() {
  const { t } = useTranslation()
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
      <div className="console-page">
        <BackLink label={t('stationDetail.backToStations')} />
        <header className="console-page-header">
          <span className="console-page-kicker">Database</span>
          <h1 className="console-page-title">Station Dossier</h1>
          <p className="console-page-sub">{t('stationDetail.loading')}</p>
        </header>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="console-page">
        <BackLink label={t('stationDetail.backToStations')} />
        <header className="console-page-header">
          <span className="console-page-kicker">Database</span>
          <h1 className="console-page-title">{t('stationDetail.notFoundTitle')}</h1>
          <p className="console-page-sub">{t('stationDetail.notFoundDesc')}</p>
        </header>
      </div>
    )
  }

  if (error || !station) {
    return (
      <div className="console-page">
        <BackLink label={t('stationDetail.backToStations')} />
        <header className="console-page-header">
          <span className="console-page-kicker">Database</span>
          <h1 className="console-page-title">{t('stationDetail.errorTitle')}</h1>
          <p className="console-page-sub">{t('stationDetail.errorDesc')}</p>
        </header>
      </div>
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
    <div
      className="console-page"
      style={{ '--empire-color': empireColor } as React.CSSProperties}
    >
      <BackLink label={t('stationDetail.backToStations')} />

      <header className="console-page-header">
        <span className="console-page-kicker">Database</span>
        <div className={styles.titleRow}>
          <h1 className="console-page-title">{station.name}</h1>
          <div className={styles.titleBadges}>
            {station.faction_tag && (
              <Link
                href={`/faction/${encodeURIComponent(station.faction_tag)}`}
                className={styles.factionOwnerBadge}
                style={{ color: station.faction_color || 'var(--chrome-silver)' }}
              >
                [{station.faction_tag}] {station.faction_name}
              </Link>
            )}
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
        <p className="console-page-sub">
          {station.id} :: {station.system_name}
        </p>
      </header>

      {/* Overview */}
      <section className={`console-panel ${styles.panelSection}`}>
        <div className="console-panel-header">
          <FileText size={12} aria-hidden />
          <h2 className={styles.panelTitle}>Overview</h2>
        </div>
        <div className="console-panel-body">
          <p className={styles.stationDescription}>{station.description}</p>
          {station.condition_text && (
            <p className={styles.conditionText}>{station.condition_text}</p>
          )}
        </div>
      </section>

      {/* Status readout */}
      <section className={`console-panel ${styles.panelSection}`}>
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('stationDetail.system')}</span>
            <Link href="/map" className={styles.statValueLink}>
              {station.system_name}
            </Link>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('stationDetail.hull')}</span>
            <span className={styles.statValue}>
              {station.hull.toLocaleString()}/{station.max_hull.toLocaleString()}
            </span>
          </div>
          {station.max_shield > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>{t('stationDetail.shield')}</span>
              <span className={styles.statValue}>
                {station.shield.toLocaleString()}/{station.max_shield.toLocaleString()}
              </span>
            </div>
          )}
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('stationDetail.guns')}</span>
            {/* Only the batteries that can actually fire. A station with guns but
                no shells reports nothing, which is the honest answer. */}
            <span className={styles.statValue}>
              {station.weapon_dps > 0
                ? t('stationDetail.gunsValue', {
                    dps: station.weapon_dps.toLocaleString(),
                    reach: String(station.weapon_reach),
                  })
                : t('stationDetail.gunsSilent')}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('stationDetail.satisfaction')}</span>
            <span className={styles.statValue}>{station.satisfaction_pct}%</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{t('stationDetail.access')}</span>
            <span className={styles.statValue}>
              {station.public_access ? t('stationDetail.accessPublic') : t('stationDetail.accessRestricted')}
            </span>
          </div>
        </div>
      </section>

      {/* Facilities */}
      {allCategories.length > 0 && (
        <section className={styles.facilitiesSection}>
          <h2 className={styles.sectionTitle}>{t('stationDetail.facilities')}</h2>
          {allCategories.map((category) => (
            <div
              key={category}
              className={`console-panel ${styles.panelSection}`}
            >
              <div className="console-panel-header">
                <Wrench size={12} aria-hidden />
                <h3 className={styles.panelTitle}>
                  {CATEGORY_LABEL_KEYS[category] ? t(CATEGORY_LABEL_KEYS[category]) : category}
                </h3>
                <span className={styles.panelCount}>
                  {facilityGroups[category].length}
                </span>
              </div>
              <div className={styles.facilityGrid}>
                {facilityGroups[category].map((facility) => (
                  <div
                    key={facility.id}
                    className={styles.facilityCard}
                    style={{ '--facility-color': EMPIRE_COLORS[facility.empire] || empireColor } as React.CSSProperties}
                  >
                    <div className={styles.facilityHeader}>
                      <h4 className={styles.facilityName}>
                        {facility.name}
                        {facility.unique && (
                          <span className={styles.uniqueBadge}>{t('stationDetail.uniqueBadge')}</span>
                        )}
                      </h4>
                      <span
                        className={styles.maintenanceStatus}
                        title={facility.maintenance_satisfied ? 'Maintenance satisfied' : 'Maintenance needed'}
                      >
                        {facility.maintenance_satisfied ? (
                          <CheckCircle2 size={14} aria-hidden className={styles.maintenanceOk} />
                        ) : (
                          <AlertTriangle size={14} aria-hidden className={styles.maintenanceWarn} />
                        )}
                      </span>
                    </div>
                    <div className={styles.facilityMeta}>
                      <span className={styles.categoryBadge}>
                        {facility.category}
                      </span>
                      <span className={styles.facilityLevel}>
                        {t('stationDetail.level')} {facility.level} {renderLevelIndicator(facility.level)}
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
                          {expandedLore[facility.id] ? `// ${t('stationDetail.hideLore')}` : `// ${t('stationDetail.showLore')}`}
                        </button>
                        {expandedLore[facility.id] && (
                          <p className={styles.loreText}>{facility.lore}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
