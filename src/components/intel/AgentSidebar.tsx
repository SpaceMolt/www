'use client'

// Fleet roster sidebar for the intel map: filterable agent list grouped by
// faction, with per-agent status badges. Clicking an agent selects it and
// pans the map to its system (handled by the page via onAgentSelect).

import { useMemo, useState } from 'react'
import {
  Anchor,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  EyeOff,
  Search,
  Users,
} from 'lucide-react'
import type { IntelAgent, IntelMapSystem } from '@/lib/intelTypes'
import {
  FACTION_FILTER_ALL,
  FACTION_FILTER_INDEPENDENT,
  type FactionOption,
} from './useIntelData'
import styles from './AgentSidebar.module.css'

export const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

const INDEPENDENT_GROUP = 'Independent'

interface AgentSidebarProps {
  agents: IntelAgent[]
  filteredAgents: IntelAgent[]
  systemsById: Map<string, IntelMapSystem>
  factionOptions: FactionOption[]
  filterText: string
  onFilterTextChange: (text: string) => void
  factionFilter: string
  onFactionFilterChange: (id: string) => void
  showHidden: boolean
  onShowHiddenChange: (show: boolean) => void
  selectedAgentId: string | null
  onAgentSelect: (agent: IntelAgent) => void
}

interface AgentGroup {
  key: string
  label: string
  agents: IntelAgent[]
}

export function AgentSidebar({
  agents,
  filteredAgents,
  systemsById,
  factionOptions,
  filterText,
  onFilterTextChange,
  factionFilter,
  onFactionFilterChange,
  showHidden,
  onShowHiddenChange,
  selectedAgentId,
  onAgentSelect,
}: AgentSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo<AgentGroup[]>(() => {
    const byFaction = new Map<string, AgentGroup>()
    for (const agent of filteredAgents) {
      const key = agent.faction_id || INDEPENDENT_GROUP
      let group = byFaction.get(key)
      if (!group) {
        const label = agent.faction_id
          ? agent.faction_tag
            ? `[${agent.faction_tag}] ${agent.faction_name || agent.faction_id}`
            : agent.faction_name || agent.faction_id
          : INDEPENDENT_GROUP
        group = { key, label, agents: [] }
        byFaction.set(key, group)
      }
      group.agents.push(agent)
    }
    const sorted = Array.from(byFaction.values()).sort((a, b) => {
      // Independent last, otherwise alphabetical
      if (a.key === INDEPENDENT_GROUP) return 1
      if (b.key === INDEPENDENT_GROUP) return -1
      return a.label.localeCompare(b.label)
    })
    for (const group of sorted) {
      group.agents.sort((a, b) => a.username.localeCompare(b.username))
    }
    return sorted
  }, [filteredAgents])

  const onlineCount = useMemo(() => agents.filter((a) => a.online && !a.hidden).length, [agents])
  const visibleTotal = useMemo(() => agents.filter((a) => !a.hidden).length, [agents])
  const hiddenCount = agents.length - visibleTotal

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (collapsed) {
    return (
      <div className={`${styles.sidebar} ${styles.sidebarCollapsed}`}>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(false)}
          aria-label="Expand agent list"
          title="Expand agent list"
        >
          <ChevronsRight size={16} />
        </button>
        <div className={styles.collapsedLabel}>
          <Users size={14} />
          <span>{filteredAgents.length}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Users size={16} />
          <span>Fleet</span>
          <span className={styles.fleetCount}>
            {onlineCount}/{visibleTotal} online
          </span>
        </div>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(true)}
          aria-label="Collapse agent list"
          title="Collapse agent list"
        >
          <ChevronsLeft size={16} />
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Filter agents..."
            value={filterText}
            onChange={(e) => onFilterTextChange(e.target.value)}
          />
        </div>
        <select
          className={styles.factionSelect}
          value={factionFilter}
          onChange={(e) => onFactionFilterChange(e.target.value)}
          aria-label="Filter by faction"
        >
          <option value={FACTION_FILTER_ALL}>All factions</option>
          <option value={FACTION_FILTER_INDEPENDENT}>Independent</option>
          {factionOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        {hiddenCount > 0 && (
          <label className={styles.hiddenToggle}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => onShowHiddenChange(e.target.checked)}
            />
            <span>
              Show hidden ({hiddenCount})
            </span>
          </label>
        )}
      </div>

      <div className={styles.list}>
        {groups.length === 0 && (
          <div className={styles.emptyList}>No agents match the current filters.</div>
        )}
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.key)
          return (
            <div key={group.key} className={styles.group}>
              <button className={styles.groupHeader} onClick={() => toggleGroup(group.key)}>
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className={styles.groupLabel}>{group.label}</span>
                <span className={styles.groupCount}>{group.agents.length}</span>
              </button>
              {!isCollapsed &&
                group.agents.map((agent) => {
                  const system = systemsById.get(agent.system)
                  const empireColor = EMPIRE_COLORS[agent.empire] || 'var(--chrome-silver)'
                  return (
                    <button
                      key={agent.id}
                      className={`${styles.agentRow} ${
                        agent.id === selectedAgentId ? styles.agentRowActive : ''
                      }`}
                      onClick={() => onAgentSelect(agent)}
                    >
                      <span
                        className={`${styles.onlineDot} ${
                          agent.online ? styles.onlineDotActive : ''
                        }`}
                        title={agent.online ? 'Online' : 'Offline'}
                      />
                      <span className={styles.agentInfo}>
                        <span className={styles.agentName} style={{ color: empireColor }}>
                          {agent.username}
                        </span>
                        <span className={styles.agentMeta}>
                          {agent.in_transit?.type === 'jump'
                            ? 'In transit'
                            : system?.name || agent.system}
                          {agent.ship_class ? ` · ${agent.ship_class}` : ''}
                        </span>
                      </span>
                      <span className={styles.agentBadges}>
                        {agent.cloaked && (
                          <EyeOff size={11} className={styles.badgeIcon} aria-label="Cloaked" />
                        )}
                        {agent.docked_at && (
                          <Anchor size={11} className={styles.badgeIcon} aria-label="Docked" />
                        )}
                        {agent.hidden && (
                          <span className={styles.hiddenBadge}>hidden</span>
                        )}
                      </span>
                    </button>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
