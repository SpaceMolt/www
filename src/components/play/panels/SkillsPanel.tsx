'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Star, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ProgressBar } from '../ProgressBar'
import { Panel, Loading, shared } from '../shared'
import styles from './SkillsPanel.module.css'

interface SkillCatalogEntry {
  id: string
  name: string
  description: string
  category: string
  max_level: number
  training_source?: string
  bonus_per_level?: Record<string, number>
  empire_restriction?: string
}

export function SkillsPanel() {
  const { state, sendCommand } = useGame()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [catalogSkills, setCatalogSkills] = useState<SkillCatalogEntry[]>([])
  const catalogFetched = useRef(false)

  // Fetch player skills
  useEffect(() => {
    if (!state.skillsData) {
      sendCommand('get_skills')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch skill catalog (metadata) once
  useEffect(() => {
    if (catalogFetched.current) return
    catalogFetched.current = true

    async function fetchAll() {
      let page = 1
      let totalPages = 1
      const all: SkillCatalogEntry[] = []
      while (page <= totalPages) {
        try {
          const result = await sendCommand('catalog', { type: 'skills', page_size: 50, page }) as Record<string, unknown>
          const items = (result.items || []) as SkillCatalogEntry[]
          all.push(...items)
          totalPages = (result.total_pages as number) || 1
          page++
        } catch { break }
      }
      setCatalogSkills(all)
    }
    fetchAll()
  }, [sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('get_skills')
  }, [sendCommand])

  const playerSkills = state.skillsData?.skills

  // Merge catalog data with player levels, group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Array<{
      skill: SkillCatalogEntry
      level: number
      xp: number
      nextLevelXp: number
    }>> = {}

    const playerEmpire = state.player?.empire as string | undefined

    for (const skill of catalogSkills) {
      // Only show empire skills for the player's own empire
      if (skill.empire_restriction && playerEmpire && skill.empire_restriction.toLowerCase() !== playerEmpire.toLowerCase()) {
        continue
      }

      const cat = skill.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      const playerData = playerSkills?.[skill.id]
      groups[cat].push({
        skill,
        level: playerData?.level ?? 0,
        xp: playerData?.xp ?? 0,
        nextLevelXp: playerData?.next_level_xp ?? 0,
      })
    }

    // Sort skills within each category: trained first (by level desc), then untrained alphabetically
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => {
        if (a.level !== b.level) return b.level - a.level
        return a.skill.name.localeCompare(b.skill.name)
      })
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [catalogSkills, playerSkills])

  return (
    <Panel
      title="Skills"
      icon={<Star size={16} />}
      color="var(--void-purple)"
      headerRight={
        <button className={shared.refreshBtn} onClick={handleRefresh} title="Refresh skills" type="button">
          <RefreshCw size={14} />
        </button>
      }
    >
      {catalogSkills.length === 0 ? (
        <Loading message="Loading skills..." />
      ) : grouped.length === 0 ? (
        <div className={shared.emptyState}>No skills available.</div>
      ) : (
        <div className={styles.skillGroups}>
          {grouped.map(([category, skills]) => (
            <div key={category} className={styles.skillGroup}>
              <div className={styles.groupHeader}>{category}</div>
              {skills.map(({ skill, level, xp, nextLevelXp }) => {
                const isExpanded = expandedId === skill.id
                const isTrained = level > 0
                return (
                  <div key={skill.id} className={`${styles.skillCard} ${isTrained ? styles.skillTrained : ''}`}>
                    <button
                      className={styles.skillHeader}
                      onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                      type="button"
                    >
                      <div className={styles.skillNameRow}>
                        {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        <span className={styles.skillName}>{skill.name}</span>
                        {skill.empire_restriction && (
                          <span className={shared.badgePurple}>{skill.empire_restriction}</span>
                        )}
                      </div>
                      <div className={styles.skillLevelRow}>
                        <span className={styles.skillLevel}>Lv {level}/{skill.max_level}</span>
                      </div>
                    </button>

                    {level < skill.max_level && nextLevelXp > 0 && (
                      <div className={styles.skillProgress}>
                        <ProgressBar value={xp} max={nextLevelXp} color="purple" size="sm" />
                        <span className={styles.skillXp}>{xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
                      </div>
                    )}
                    {level >= skill.max_level && level > 0 && (
                      <span className={styles.skillMaxed}>MAX</span>
                    )}

                    {isExpanded && (
                      <div className={styles.skillDetail}>
                        {skill.description && (
                          <p className={styles.skillDesc}>{skill.description}</p>
                        )}
                        {skill.training_source && (
                          <div className={styles.skillMeta}>
                            <span className={styles.metaLabel}>How to train:</span>
                            <span className={styles.metaValue}>{skill.training_source}</span>
                          </div>
                        )}
                        {skill.bonus_per_level && Object.keys(skill.bonus_per_level).length > 0 && (
                          <div className={styles.skillMeta}>
                            <span className={styles.metaLabel}>Bonuses per level:</span>
                            <div className={styles.bonusList}>
                              {Object.entries(skill.bonus_per_level).map(([stat, bonus]) => (
                                <span key={stat} className={styles.bonusItem}>
                                  +{bonus}% {stat.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
