'use client'

// System detail side panel for the intel map. Fetches
// GET /api/intel-map/system/{id} when a system is selected and renders what
// the fleet + faction intel collectively know about it.

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Radar,
  ScanEye,
  Shield,
  Users,
  X,
} from 'lucide-react'
import type {
  IntelAgent,
  IntelEntryResource,
  IntelSystemDetailResponse,
  IntelSystemPoi,
  NearbyByPoi,
  SystemIntelEntry,
} from '@/lib/intelTypes'
import { titleCase } from '@/lib/format'
import { factionHref, playerHref } from '@/components/profile/ProfileLink'
import styles from './SystemDetailPanel.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const MARKET_ROW_LIMIT = 15

interface SystemDetailPanelProps {
  systemId: string
  systemName?: string
  authHeaders: () => Promise<Record<string, string>>
  /** Owned agents currently in this system (from the fleet snapshot) */
  agentsInSystem: IntelAgent[]
  onClose: () => void
}

function formatCredits(n: number): string {
  return n.toLocaleString()
}

function ContactsSection({ poiId, contacts }: { poiId: string; contacts: NearbyByPoi }) {
  const npcCounts: string[] = []
  if (contacts.pirate_count > 0) npcCounts.push(`${contacts.pirate_count} pirate${contacts.pirate_count === 1 ? '' : 's'}`)
  if (contacts.empire_npc_count > 0) npcCounts.push(`${contacts.empire_npc_count} empire NPC${contacts.empire_npc_count === 1 ? '' : 's'}`)
  if (contacts.creature_count > 0) npcCounts.push(`${contacts.creature_count} creature${contacts.creature_count === 1 ? '' : 's'}`)

  return (
    <div className={styles.poiContacts}>
      <div className={styles.poiContactsHeader}>{titleCase(poiId)}</div>
      {contacts.unknown_signature && (
        <div className={styles.unknownSignature}>
          <ScanEye size={12} />
          Unknown signature detected
        </div>
      )}
      {contacts.nearby.map((contact) => (
        <div key={contact.player_id} className={styles.contactRow}>
          <span className={styles.contactName}>
            {contact.clan_tag && <span className={styles.contactTag}>[{contact.clan_tag}]</span>}
            <a
              href={playerHref(contact.username)}
              className={styles.contactLink}
              target="_blank"
              rel="noreferrer"
            >
              {contact.username}
            </a>
            {contact.faction_tag && !contact.clan_tag && (
              <span className={styles.contactTag}>
                <a
                  href={factionHref(contact.faction_tag)}
                  className={styles.contactLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  [{contact.faction_tag}]
                </a>
              </span>
            )}
          </span>
          <span className={styles.contactMeta}>
            {contact.ship_class || ''}
            {contact.in_combat ? ' · in combat' : ''}
            {contact.offline ? ' · offline' : ''}
          </span>
        </div>
      ))}
      {contacts.offline_collapsed > 0 && (
        <div className={styles.contactNote}>
          +{contacts.offline_collapsed} offline pilot{contacts.offline_collapsed === 1 ? '' : 's'}
        </div>
      )}
      {npcCounts.length > 0 && <div className={styles.contactNote}>{npcCounts.join(' · ')}</div>}
      {contacts.nearby.length === 0 &&
        !contacts.offline_collapsed &&
        npcCounts.length === 0 &&
        !contacts.unknown_signature && (
          <div className={styles.contactNote}>No other ships detected</div>
        )}
    </div>
  )
}

/** A tick is 10 seconds of game time. */
const describeAge = (ticks: number) => {
  const minutes = Math.round((ticks * 10) / 60)
  if (minutes < 1) return 'moments ago'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

/** One deposit: ore, how rich, how much is left, and how mined-out it is. */
function ResourceRow({ resource }: { resource: IntelEntryResource }) {
  const { resource_id, richness, remaining_display, depletion_percent } = resource
  const depleted = depletion_percent ?? 0

  return (
    <div className={styles.resourceRow}>
      <span className={styles.resourceName}>{titleCase(resource_id)}</span>
      {richness ? <span className={styles.resourceRichness}>R{richness}</span> : <span />}
      <span className={styles.resourceRemaining}>{remaining_display}</span>
      {depletion_percent === undefined ? (
        <span />
      ) : (
        <span className={styles.depletion} title={`${depleted.toFixed(0)}% depleted`}>
          <span className={styles.depletionTrack}>
            <span className={styles.depletionFill} style={{ width: `${depleted}%` }} />
          </span>
          <span className={styles.depletionPct}>{depleted.toFixed(0)}%</span>
        </span>
      )}
    </div>
  )
}

/**
 * One POI. Beyond the name and type it carries the station vitals the public map
 * already shows, plus any deposit readings — badged with whether an agent is
 * standing on the deposit right now or it came second-hand from the faction
 * pool, because a stale "full" reading on a mined-out belt is worse than none.
 */
function PoiRow({ poi }: { poi: IntelSystemPoi }) {
  const live = poi.resource_source === 'live'
  const resources = poi.resources ?? []

  return (
    <div className={styles.poiItem}>
      <div className={styles.poiRow}>
        <span className={styles.poiName}>{poi.name}</span>
        <span className={styles.poiType}>
          {titleCase(poi.type)}
          {poi.hidden ? ' · deep-core' : ''}
          {poi.online ? ` · ${poi.online} here` : ''}
        </span>
      </div>

      {poi.station_name && (
        <div className={styles.stationBlock}>
          <div className={styles.stationLine}>
            {poi.station_condition && (
              <span className={styles.stationCondition}>{poi.station_condition}</span>
            )}
            {/* A player faction's station sits in lawless space and has no empire,
                so the owner is the only thing that identifies it. */}
            {poi.station_faction_name ? (
              <span
                className={styles.stationFaction}
                style={
                  poi.station_faction_color
                    ? { color: poi.station_faction_color }
                    : undefined
                }
              >
                {poi.station_faction_tag
                  ? `[${poi.station_faction_tag}] ${poi.station_faction_name}`
                  : poi.station_faction_name}
              </span>
            ) : poi.station_empire ? (
              <span className={styles.stationEmpire}>{titleCase(poi.station_empire)}</span>
            ) : null}
          </div>
          {poi.station_services?.length ? (
            <div className={styles.serviceChips}>
              {poi.station_services.map((service) => (
                <span key={service} className={styles.serviceChip}>
                  {titleCase(service)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {poi.players?.length ? (
        <div className={styles.poiPlayers}>
          {poi.players.map((p) => (
            <span key={p.username} className={styles.poiPlayer}>
              {p.clan_tag ? `[${p.clan_tag}] ` : ''}
              {p.username}
            </span>
          ))}
        </div>
      ) : null}

      {resources.length > 0 && (
        <div className={styles.resourceBlock}>
          <div className={styles.readingHeader}>
            <span className={live ? styles.readingLive : styles.readingStale}>
              {live ? 'live' : describeAge(poi.resource_age_ticks ?? 0)}
            </span>
            <span className={styles.readingSource}>
              {live ? 'current reading' : 'faction intel · may be out of date'}
            </span>
          </div>
          {resources.map((resource) => (
            <ResourceRow key={resource.resource_id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  )
}

function IntelEntrySection({ entry }: { entry: SystemIntelEntry }) {
  const provenance = entry.entry.auto_synced
    ? 'live sync'
    : entry.entry.submitter_name
      ? `submitted by ${entry.entry.submitter_name}${entry.entry.submitted_at_tick ? `, tick ${entry.entry.submitted_at_tick}` : ''}`
      : entry.entry.submitted_at_tick
        ? `tick ${entry.entry.submitted_at_tick}`
        : 'archived'
  const poiCount = entry.entry.pois?.length ?? 0
  const resourcePois = entry.entry.pois?.filter((p) => p.resources && p.resources.length > 0) ?? []

  return (
    <div className={styles.intelEntry}>
      <div className={styles.intelProvenance}>
        <span className={styles.intelTag}>{entry.source_tag}</span>
        <span className={styles.intelLevel}>L{entry.intel_level}</span>
        {entry.live && <span className={styles.intelLive}>live</span>}
        {entry.via_ally_of && <span className={styles.intelVia}>via ally</span>}
        <span className={styles.intelProvenanceText}>{provenance}</span>
      </div>
      {poiCount > 0 && (
        <div className={styles.intelSummary}>
          {poiCount} POI{poiCount === 1 ? '' : 's'} recorded
          {resourcePois.length > 0 && ` · resources at ${resourcePois.length}`}
        </div>
      )}
      {resourcePois.slice(0, 4).map((poi) => (
        <div key={poi.id} className={styles.intelResourceRow}>
          <span className={styles.intelPoiName}>{poi.name}</span>
          <span className={styles.intelResources}>
            {(poi.resources ?? [])
              .slice(0, 3)
              .map((r) =>
                r.remaining_display
                  ? `${titleCase(r.resource_id)} (${r.remaining_display})`
                  : titleCase(r.resource_id),
              )
              .join(', ')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SystemDetailPanel({
  systemId,
  systemName,
  authHeaders,
  agentsInSystem,
  onClose,
}: SystemDetailPanelProps) {
  const [detail, setDetail] = useState<IntelSystemDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  // A 404 now means the system genuinely does not exist. A system the fleet has
  // simply never scouted answers with the public baseline and has_intel=false.
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    setError(null)
    setDetail(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/intel-map/system/${systemId}`, { headers })
      if (res.status === 404) {
        setNotFound(true)
      } else if (!res.ok) {
        setError(`Server returned ${res.status}`)
      } else {
        setDetail(await res.json())
      }
    } catch {
      setError('Could not reach game server')
    } finally {
      setLoading(false)
    }
  }, [authHeaders, systemId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const contactEntries = detail ? Object.entries(detail.nearby_by_poi ?? {}) : []

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{detail?.system.name || systemName || systemId}</div>
          {detail?.system.empire && (
            <div className={styles.panelSub}>{titleCase(detail.system.empire)}</div>
          )}
          {detail?.system.police_level !== undefined && (
            <div className={styles.panelPolice}>
              <Shield size={11} />
              Police level {detail.system.police_level}
            </div>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close system detail">
          <X size={16} />
        </button>
      </div>

      <div className={styles.panelContent}>
        {loading ? (
          <div className={styles.loading}>Scanning intel archives...</div>
        ) : notFound ? (
          <div className={styles.noIntel}>
            <Radar size={28} />
            <p>No such system.</p>
          </div>
        ) : error ? (
          <div className={styles.errorBox}>
            <AlertTriangle size={14} />
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={fetchDetail}>
              Retry
            </button>
          </div>
        ) : detail ? (
          <>
            {/* No agent of ours has been here and no intel pool covers it, so what
                follows is public knowledge — the same thing the public galaxy map
                shows anyone. Say so plainly rather than passing it off as intel. */}
            {!detail.has_intel && (
              <div className={styles.publicOnly}>
                <Radar size={13} />
                <span>
                  No intel here yet — showing public knowledge only. Send an agent to
                  see deposits, contacts and station holdings.
                </span>
              </div>
            )}

            {/* Agents here */}
            {agentsInSystem.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Users size={13} />
                  Your agents here ({agentsInSystem.length})
                </h3>
                <div className={styles.agentChips}>
                  {agentsInSystem.map((agent) => (
                    <span key={agent.id} className={styles.agentChip}>
                      {agent.username}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Nearby contacts per POI (only POIs with an online owned agent) */}
            {contactEntries.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <ScanEye size={13} />
                  Local contacts
                </h3>
                {contactEntries.map(([poiId, contacts]) => (
                  <ContactsSection key={poiId} poiId={poiId} contacts={contacts} />
                ))}
              </section>
            )}

            {/* Docked stations and owned faction outposts */}
            {detail.stations.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Building2 size={13} />
                  Stations &amp; Outposts
                </h3>
                {detail.stations.map((station) => (
                  <div key={station.base_id} className={styles.station}>
                    <div className={styles.stationHeader}>
                      <span className={styles.stationName}>
                        {station.name}
                        {station.type === 'outpost' && (
                          <span className={styles.outpostBadge}>Outpost</span>
                        )}
                      </span>
                      {station.condition_text && (
                        <span className={styles.stationCondition}>{station.condition_text}</span>
                      )}
                    </div>
                    {station.services && station.services.length > 0 && (
                      <div className={styles.serviceChips}>
                        {station.services.map((service) => (
                          <span key={service} className={styles.serviceChip}>
                            {service.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    {station.market && station.market.length > 0 && (
                      <>
                        <table className={styles.marketTable}>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Bid</th>
                              <th>Ask</th>
                              <th>Spread</th>
                            </tr>
                          </thead>
                          <tbody>
                            {station.market.slice(0, MARKET_ROW_LIMIT).map((row) => (
                              <tr key={row.item_id}>
                                <td className={styles.marketItem}>{row.item_name}</td>
                                <td>{row.best_bid > 0 ? formatCredits(row.best_bid) : '—'}</td>
                                <td>{row.best_ask > 0 ? formatCredits(row.best_ask) : '—'}</td>
                                <td>
                                  {row.spread !== undefined && row.spread > 0
                                    ? formatCredits(row.spread)
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {station.market.length > MARKET_ROW_LIMIT && (
                          <div className={styles.marketMore}>
                            {station.market.length - MARKET_ROW_LIMIT} more items not shown
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* Known POIs */}
            {detail.pois.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Radar size={13} />
                  Points of interest ({detail.pois.length})
                </h3>
                <div className={styles.poiList}>
                  {detail.pois.map((poi) => (
                    <PoiRow key={poi.id} poi={poi} />
                  ))}
                </div>
              </section>
            )}

            {/* Faction intel entries */}
            {detail.intel_entries.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Shield size={13} />
                  Faction intel
                </h3>
                {detail.intel_entries.map((entry, i) => (
                  <IntelEntrySection key={`${entry.source_faction_id}-${i}`} entry={entry} />
                ))}
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
