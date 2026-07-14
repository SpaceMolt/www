'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Database, Landmark } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface Station {
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
  facility_count: number
  weapon_dps: number
  wrecked: boolean
}

interface Empire {
  id: string
  name: string
}

interface StationsResponse {
  stations: Station[]
  empires: Empire[]
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

const CAPITAL_IDS = new Set([
  'sol_base',
  'krynn_base',
  'haven_base',
  'nexus_base',
  'frontier_base',
])

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

function truncateDescription(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '...'
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [empires, setEmpires] = useState<Empire[]>([])
  const [activeEmpire, setActiveEmpire] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    async function fetchStations() {
      setLoading(true)
      setError(false)
      try {
        const response = await fetch(`${API_BASE}/api/stations`)
        const data: StationsResponse = await response.json()
        setStations(data.stations || [])
        setEmpires(data.empires || [])
      } catch {
        setError(true)
        setStations([])
        setEmpires([])
      } finally {
        setLoading(false)
      }
    }
    fetchStations()
  }, [])

  useEffect(() => {
    document.title = 'Stations - SpaceMolt'
  }, [])

  const filteredStations = activeEmpire
    ? stations.filter((s) => s.empire === activeEmpire)
    : stations

  const capitals = filteredStations.filter((s) => CAPITAL_IDS.has(s.id))
  const otherStations = filteredStations.filter((s) => !CAPITAL_IDS.has(s.id))

  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">{t('stations.pageTitle')}</h1>
        <p className="console-page-sub">{t('stations.pageSubtitle')}</p>
        <p className={styles.headerDesc}>{t('stations.pageDescription')}</p>
      </header>

      <h2 style={srOnly}>Filter by Empire</h2>
      <div className={styles.filterBar} role="group" aria-label="Filter by empire">
        <span className={styles.filterLabel}>Empire</span>
        <button
          className={`${styles.filterBtn} ${activeEmpire === '' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveEmpire('')}
        >
          {t('stations.filterAll')}
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
        {!loading && !error && (
          <span className={styles.recordCount}>
            {filteredStations.length} records
          </span>
        )}
      </div>

      <h2 style={srOnly}>Station Registry</h2>

      {loading && (
        <div className={styles.loading}>{t('stations.loading')}</div>
      )}

      {!loading && error && (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>{t('stations.errorTitle')}</h2>
          <p>{t('stations.errorDesc')}</p>
        </div>
      )}

      {!loading && !error && filteredStations.length === 0 && (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>{t('stations.noStationsTitle')}</h2>
          <p>{t('stations.noStationsDesc')}</p>
        </div>
      )}

      {!loading && !error && filteredStations.length > 0 && (
        <>
          {capitals.length > 0 && (
            <section className={`console-panel ${styles.panelSection}`}>
              <div className="console-panel-header">
                <Landmark size={12} aria-hidden />
                <h2 className={styles.panelTitle}>{t('stations.empireCapitals')}</h2>
                <span className={styles.panelCount}>{capitals.length}</span>
              </div>
              <div className="console-panel-body">
                <p className={styles.capitalSectionSubtitle}>
                  {t('stations.empireCapitalsSubtitle')}
                </p>
                <div className={styles.capitalGrid}>
                  {capitals.map((station) => (
                    <Link
                      key={station.id}
                      href={`/stations/${station.id}`}
                      className={styles.capitalCard}
                      style={{ '--empire-color': EMPIRE_COLORS[station.empire] || '#888' } as React.CSSProperties}
                    >
                      <div className={styles.capitalHeader}>
                        <h3 className={styles.capitalName}>{station.name}</h3>
                        <span
                          className={styles.conditionBadge}
                          style={{ color: CONDITION_COLORS[station.condition] || 'var(--chrome-silver)' }}
                        >
                          {station.condition}
                        </span>
                      </div>
                      <div className={styles.empireBadge}>
                        <span
                          className={styles.empireDot}
                          style={{ background: EMPIRE_COLORS[station.empire] }}
                        />
                        <span style={{ color: EMPIRE_COLORS[station.empire] }}>
                          {station.empire_name}
                        </span>
                      </div>
                      <p className={styles.capitalDescription}>
                        {truncateDescription(station.description, 180)}
                      </p>
                      <div className={styles.capitalFooter}>
                        <span className={styles.cardMeta}>
                          {station.facility_count} facilities
                        </span>
                        <span className={styles.cardMeta}>
                          {station.system_name}
                        </span>
                        <span className={styles.capitalViewLink}>
                          View Station
                          <ChevronRight size={12} aria-hidden />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {otherStations.length > 0 && (
            <section className={`console-panel ${styles.panelSection}`}>
              <div className="console-panel-header">
                <Database size={12} aria-hidden />
                <h2 className={styles.panelTitle}>All Stations</h2>
                <span className={styles.panelCount}>{otherStations.length}</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.registryTable}>
                  <thead>
                    <tr>
                      <th scope="col">Station</th>
                      <th scope="col">Empire</th>
                      <th scope="col">System</th>
                      <th scope="col">Condition</th>
                      <th scope="col" className={styles.numCol}>Sat</th>
                      <th scope="col" className={styles.numCol}>Fac</th>
                      <th scope="col" className={styles.numCol}>Guns</th>
                      <th scope="col" aria-hidden className={styles.chevronCol} />
                    </tr>
                  </thead>
                  <tbody>
                    {otherStations.map((station) => (
                      <tr
                        key={station.id}
                        className={styles.registryRow}
                        onClick={() => router.push(`/stations/${station.id}`)}
                      >
                        <td className={styles.nameCell}>
                          <Link
                            href={`/stations/${station.id}`}
                            className={styles.stationNameLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {station.name}
                          </Link>
                          <span className={styles.stationDesc}>
                            {truncateDescription(station.description, 110)}
                          </span>
                        </td>
                        <td className={styles.empireCell}>
                          {station.faction_tag ? (
                            <Link
                              href={`/faction/${encodeURIComponent(station.faction_tag)}`}
                              className={styles.factionOwnerLink}
                              style={{ color: station.faction_color || 'var(--chrome-silver)' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span
                                className={styles.empireDot}
                                style={{ background: station.faction_color || 'var(--chrome-silver)' }}
                              />
                              [{station.faction_tag}] {station.faction_name}
                            </Link>
                          ) : (
                            <>
                              <span
                                className={styles.empireDot}
                                style={{ background: EMPIRE_COLORS[station.empire] }}
                              />
                              <span style={{ color: EMPIRE_COLORS[station.empire] }}>
                                {station.empire_name}
                              </span>
                            </>
                          )}
                        </td>
                        <td className={styles.systemCell}>{station.system_name}</td>
                        <td>
                          <span
                            className={styles.conditionBadge}
                            style={{ color: CONDITION_COLORS[station.condition] || 'var(--chrome-silver)' }}
                          >
                            {station.condition}
                          </span>
                        </td>
                        <td className={styles.numCell}>{station.satisfaction_pct}%</td>
                        <td className={styles.numCell}>{station.facility_count}</td>
                        <td className={styles.numCell}>{station.wrecked ? 'wrecked' : station.weapon_dps.toLocaleString()}</td>
                        <td className={styles.chevronCell}>
                          <ChevronRight size={13} aria-hidden />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
