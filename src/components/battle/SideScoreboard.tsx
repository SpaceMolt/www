'use client'

import { useState } from 'react'
import styles from './BattleViewer.module.css'
import type { BattleTimeline, SideMeta } from '@/lib/battle/timeline'

interface Props {
  side: SideMeta
  timeline: BattleTimeline
  tickIndex: number
  selectedId: string | null
  onSelect: (id: string) => void
  winner: boolean
}

/**
 * Floating roster panel for one side: live hull/shield micro-bars, damage
 * dealt and kills per ship. Docked to the side's flank of the arena.
 */
export default function SideScoreboard({ side, timeline, tickIndex, selectedId, onSelect, winner }: Props) {
  const [collapsed, setCollapsed] = useState(false)
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
    if (meta?.fate === 'destroyed' && (meta.fateTickIndex ?? Infinity) <= tickIndex) sideLosses++
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
          {winner && <span className={styles.winnerTag}> ★ WINNER</span>}
        </span>
        <span className={styles.sideTotals}>
          {sideDamage.toLocaleString()} dmg · {sideKills} kills{sideLosses > 0 ? ` · ${sideLosses} lost` : ''}
        </span>
        <span className={styles.collapseChevron}>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className={styles.scoreboardRows}>
          {side.participantIds.map(id => {
            const meta = timeline.participants.get(id)
            if (!meta) return null
            const snap = snaps?.get(id)
            const gone = !snap
            const dead = meta.fate === 'destroyed' && (meta.fateTickIndex ?? Infinity) <= tickIndex
            const escaped = meta.fate === 'escaped' && (meta.fateTickIndex ?? Infinity) <= tickIndex
            const notYet = meta.firstTickIndex > tickIndex
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
                  </span>
                  <span className={styles.scoreShip}>{meta.shipClassName}</span>
                </div>
                {snap ? (
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
                      {dead ? `destroyed${meta.killedBy ? ` by ${meta.killedBy}` : ''}` : escaped ? 'escaped' : notYet ? 'not yet engaged' : ''}
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
