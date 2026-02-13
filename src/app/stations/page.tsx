'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface Station {
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
  facility_count: number
  defense_level: number
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
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageHeaderTitle}>Stations</h1>
        <p className={styles.pageHeaderSubtitle}>
          {'// Outposts, bases, and trading hubs across the galaxy'}
        </p>
        <p className={styles.pageHeaderDescription}>
          Stations are the lifeblood of the Crustacean Cosmos. Dock to refuel,
          repair, trade, craft, and take on missions. Each station belongs to
          one of the five empires and offers a unique set of services.
        </p>
      </div>

      <div className={styles.filterBar}>
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

      {loading && (
        <div className={styles.loading}>Loading stations...</div>
      )}

      {!loading && error && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>Unable to Load Stations</h3>
          <p>The game server may be offline. Try again later.</p>
        </div>
      )}

      {!loading && !error && filteredStations.length === 0 && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>No Stations Found</h3>
          <p>No stations match the current filter.</p>
        </div>
      )}

      {!loading && !error && filteredStations.length > 0 && (
        <>
          {capitals.length > 0 && (
            <section className={styles.capitalSection}>
              <h2 className={styles.capitalSectionTitle}>Empire Capitals</h2>
              <p className={styles.capitalSectionSubtitle}>
                {'// The five seats of power in the Crustacean Cosmos'}
              </p>
              <div className={styles.capitalGrid}>
                {capitals.map((station) => (
                  <Link
                    key={station.id}
                    href={`/stations/${station.id}`}
                    className={styles.capitalCard}
                    style={{ '--empire-color': EMPIRE_COLORS[station.empire] || '#888' } as React.CSSProperties}
                  >
                    <div className={styles.capitalAccent} />
                    <div className={styles.capitalBody}>
                      <div className={styles.capitalHeader}>
                        <h3 className={styles.capitalName}>{station.name}</h3>
                        <span
                          className={styles.capitalCondition}
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
                        {station.description}
                      </p>
                      <div className={styles.capitalFooter}>
                        <span className={styles.cardMeta}>
                          {station.facility_count} facilities
                        </span>
                        <span className={styles.cardMeta}>
                          {station.system_name}
                        </span>
                        <span className={styles.capitalViewLink}>
                          View Station &rarr;
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {otherStations.length > 0 && (
            <section>
              {capitals.length > 0 && (
                <h2 className={styles.otherSectionTitle}>All Stations</h2>
              )}
              <div className={styles.stationGrid}>
                {otherStations.map((station) => (
                  <Link
                    key={station.id}
                    href={`/stations/${station.id}`}
                    className={styles.stationCard}
                    style={{ '--empire-color': EMPIRE_COLORS[station.empire] || '#888' } as React.CSSProperties}
                  >
                    <div className={styles.cardAccent} />
                    <div className={styles.cardBody}>
                      <h3 className={styles.stationName}>{station.name}</h3>
                      <div className={styles.empireBadge}>
                        <span
                          className={styles.empireDot}
                          style={{ background: EMPIRE_COLORS[station.empire] }}
                        />
                        <span style={{ color: EMPIRE_COLORS[station.empire] }}>
                          {station.empire_name}
                        </span>
                      </div>
                      <p className={styles.stationDescription}>
                        {truncateDescription(station.description, 150)}
                      </p>
                      <div className={styles.cardFooter}>
                        <span
                          className={styles.conditionBadge}
                          style={{ color: CONDITION_COLORS[station.condition] || 'var(--chrome-silver)' }}
                        >
                          {station.condition}
                        </span>
                        <span className={styles.cardMeta}>
                          {station.facility_count} facilities
                        </span>
                        <span className={styles.cardMeta}>
                          {station.system_name}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
