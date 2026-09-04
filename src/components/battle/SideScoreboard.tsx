'use client'

import { useState } from 'react'
import styles from './BattleViewer.module.css'
import { useTranslation } from '@/i18n'
import type { BattleTimeline, SideMeta } from '@/lib/battle/timeline'

function identityLabelKey(actorKind: string, isNPC: boolean, isBoss: boolean): string | null {
  if (isBoss) return actorKind === 'pirate' ? 'battles.identityPirateBoss' : 'battles.identityNpcBoss'
  switch (actorKind) {
    case 'pirate': return 'battles.identityPirate'
    case 'police': return 'battles.identityPolice'
    case 'prize': return 'battles.identityPrize'
    case 'npc': return 'battles.identityNpc'
    case 'drone': return 'battles.identityDrone'
    case 'creature': return 'battles.identityWildlife'
    case 'station': return 'battles.identityStation'
    default: return isNPC ? 'battles.identityNpc' : null
  }
}

interface Props {
  side: SideMeta
  timeline: BattleTimeline
  tickIndex: number
  selectedId: string | null
  onSelect: (id: string) => void
  winner: boolean
  compact?: boolean
  focusPlayerId?: string
}

/**
 * Floating roster panel for one side: live hull/shield micro-bars, damage
 * dealt and kills per ship. Docked to the side's flank of the arena.
 */
export default function SideScoreboard({ side, timeline, tickIndex, selectedId, onSelect, winner, compact = false, focusPlayerId }: Props) {
  const { t } = useTranslation()
  // Rosters start collapsed on narrow screens where an expanded panel would
  // cover the arena. Only rendered client-side (after battle data loads), so
  // reading matchMedia in the initializer is safe.
  const [collapsed, setCollapsed] = useState(
    () => compact || (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches),
  )
  const snaps = timeline.snapshotAt[tickIndex]

  let sideDamage = 0
  let sideKills = 0
  let sideLosses = 0
  for (const id of side.participantIds) {
    const meta = timeline.participants.get(id)
    const snap = snaps?.get(id)
    // Latest known totals: current snapshot, else last snapshot they appeared in.
    const last = snap ?? timeline.snapshotAt[Math.min(meta?.lastTickIndex ?? 0, tickIndex)]?.get(id)
    sideDamage += last?.damage_dealt ?? 0
    sideKills += last?.kill_count ?? 0
    if ((meta?.fate === 'destroyed' || meta?.fate === 'captured' || meta?.fate === 'knocked_out') && (meta.fateTickIndex ?? Infinity) <= tickIndex) sideLosses++
  }

  const dockClass = side.index === 0 ? styles.scoreboardLeft : side.index === 1 ? styles.scoreboardRight : styles.scoreboardExtra

  // Sides beyond the first two dock along the bottom edge, fanned out from
  // the centre so they never stack on top of each other.
  const style: React.CSSProperties = { '--side-color': side.color } as React.CSSProperties
  if (side.index >= 2) {
    const extras = timeline.sides.length - 2
    const offset = (side.index - 2 - (extras - 1) / 2) * 252
    style.left = `calc(50% + ${offset}px)`
  }

  return (
    <div className={`${styles.scoreboard} ${dockClass}`} style={style}>
      <button className={styles.scoreboardHeader} onClick={() => setCollapsed(c => !c)} aria-expanded={!collapsed}>
        <span className={styles.sideSwatch} style={{ background: side.color }} />
        <span className={styles.sideLabel}>
          {side.label}
          {winner && <span className={styles.winnerTag}> ★ {t('battles.winner')}</span>}
        </span>
        <span className={styles.sideTotals}>
          {sideDamage.toLocaleString()} {t('battles.damage')} · {sideKills} {t('battles.kills')}{sideLosses > 0 ? ` · ${sideLosses} ${t('battles.lost')}` : ''}
        </span>
        <span className={styles.collapseChevron}>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className={styles.scoreboardRows}>
          {side.participantIds.map(id => {
            const meta = timeline.participants.get(id)
            if (!meta) return null
            const snap = snaps?.get(id)
            const dead = meta.fate === 'destroyed' && (meta.fateTickIndex ?? Infinity) <= tickIndex
            const captured = meta.fate === 'captured' && (meta.fateTickIndex ?? Infinity) <= tickIndex
            const escaped = meta.fate === 'escaped' && (meta.fateTickIndex ?? Infinity) <= tickIndex
            const knockedOut = meta.fate === 'knocked_out' && (meta.fateTickIndex ?? Infinity) <= tickIndex
            const gone = !snap || dead || captured || escaped || knockedOut
            const notYet = meta.firstTickIndex > tickIndex
            const identityKey = identityLabelKey(meta.actorKind, meta.isNPC, meta.isBoss)
            const shieldFrac = snap && snap.max_shield > 0 ? snap.shield / snap.max_shield : 0
            const hullFrac = snap && snap.max_hull > 0 ? snap.hull / snap.max_hull : 0
            const hullColor = hullFrac > 0.55 ? '#2dd4bf' : hullFrac > 0.25 ? '#ffd93d' : '#e63946'
            return (
              <button
                key={id}
                className={`${styles.scoreRow} ${selectedId === id ? styles.scoreRowSelected : ''} ${gone ? styles.scoreRowGone : ''}`}
                onClick={() => onSelect(id)}
                disabled={notYet}
              >
                <div className={styles.scoreRowTop}>
                  <span className={styles.scoreName}>
                    {dead && '✕ '}
                    {escaped && '↗ '}
                    {meta.name}
                    {id === focusPlayerId && <span className={styles.youTag}>{t('battles.stream.you')}</span>}
                  </span>
                  {identityKey && <span className={styles.actorBadge}>{t(identityKey)}</span>}
                  <span className={styles.scoreShip} title={meta.shipClassName}>{meta.shipClassName}</span>
                </div>
                {snap && !captured && !knockedOut ? (
                  <div className={styles.scoreRowBars}>
                    {snap.max_shield > 0 && (
                      <span className={styles.microBar}>
                        <span style={{ width: `${shieldFrac * 100}%`, background: '#4dabf7' }} />
                      </span>
                    )}
                    <span className={styles.microBar}>
                      <span style={{ width: `${hullFrac * 100}%`, background: hullColor }} />
                    </span>
                    <span className={styles.scoreDmg}>{(snap.damage_dealt ?? 0).toLocaleString()}</span>
                  </div>
                ) : (
                  <div className={styles.scoreRowBars}>
                    <span className={styles.scoreFate}>
                      {captured
                        ? meta.capturedBy ? t('battles.capturedIntactBy', { captor: meta.capturedBy }) : t('battles.capturedIntact')
                        : dead
                          ? meta.deathCause === 'self_destruct'
                            ? t('battles.selfDestructed')
                            : meta.killedBy ? t('battles.destroyedBy', { killer: meta.killedBy }) : t('battles.destroyed')
                          : knockedOut
                            ? meta.killedBy ? t('battles.knockedOutBy', { killer: meta.killedBy }) : t('battles.knockedOut')
                            : escaped ? t('battles.escaped') : notYet ? t('battles.notEngaged') : ''}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
