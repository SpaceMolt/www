'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Map,
  Swords,
  Rocket,
  Users,
  Target,
  Info,
  Settings,
  TrendingUp,
  Package,
  Warehouse,
  Building2,
  Landmark,
  Hammer,
  Star,
  Trophy,
  Skull,
  ChevronDown,
  Menu,
  Repeat,
  UserCog,
} from 'lucide-react'
import styles from './PanelNav.module.css'

interface PanelNavProps {
  activePanel: string
  onPanelChange: (panel: string) => void
  badges?: Record<string, number>
  /** Tab ids to leave out, for services this place lacks (see HUD). */
  hidden?: string[]
}

interface PanelDef {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  /** Right-justify this tab (pushes to far right) */
  right?: boolean
}

const NONE: string[] = []

const ALL_PANELS: PanelDef[] = [
  { id: 'galaxy', icon: Map, label: 'Galaxy' },
  { id: 'ship', icon: Rocket, label: 'Ship' },
  { id: 'faction', icon: Users, label: 'Faction' },
  { id: 'missions', icon: Target, label: 'Missions' },
  { id: 'autopilot', icon: Repeat, label: 'Autopilot' },
  { id: 'crew', icon: UserCog, label: 'Crew' },
  // Station tabs: view remotely, mutations disabled in space
  { id: 'trading', icon: TrendingUp, label: 'Market' },
  { id: 'storage', icon: Package, label: 'Storage' },
  // Only at a station with the matching service (HUD hides them otherwise)
  { id: 'shipyard', icon: Warehouse, label: 'Shipyard' },
  { id: 'crafting', icon: Hammer, label: 'Crafting' },
  // Always visible: the cross-station facility list and station founding work undocked.
  { id: 'facilities', icon: Building2, label: 'Facilities' },
  { id: 'station', icon: Landmark, label: 'Station' },
  { id: 'skills', icon: Star, label: 'Skills' },
  { id: 'achievements', icon: Trophy, label: 'Achievements' },
  // Salvage: the panel shows a "no wrecks" state in space; HUD hides it docked with nothing to do
  { id: 'salvage', icon: Skull, label: 'Salvage' },
  // Combat — always visible: arena status and battle history work while docked.
  { id: 'combat', icon: Swords, label: 'Combat' },
  // Right-justified
  { id: 'info', icon: Info, label: 'Info', right: true },
  { id: 'settings', icon: Settings, label: 'Settings', right: true },
]

function visiblePanelsFor(hidden: string[]): PanelDef[] {
  return ALL_PANELS.filter((p) => !hidden.includes(p.id))
}

/** Keys 1-9 switch to the first nine visible left-hand tabs, in tab-row order. */
export function panelShortcuts(hidden: string[] = []): PanelDef[] {
  return visiblePanelsFor(hidden).filter((p) => !p.right).slice(0, 9)
}

export function PanelNav({ activePanel, onPanelChange, badges, hidden = NONE }: PanelNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const visiblePanels = useMemo(() => visiblePanelsFor(hidden), [hidden])

  const leftPanels = visiblePanels.filter((p) => !p.right)
  const rightPanels = visiblePanels.filter((p) => p.right)

  const activeConfig = visiblePanels.find((p) => p.id === activePanel) || visiblePanels[0]
  const ActiveIcon = activeConfig.icon

  // If the active panel becomes hidden (e.g. undocking hides the shipyard), fall back to galaxy
  useEffect(() => {
    if (!visiblePanels.some((p) => p.id === activePanel)) {
      onPanelChange('galaxy')
    }
  }, [visiblePanels, activePanel, onPanelChange])

  useEffect(() => {
    if (!mobileOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mobileOpen])

  function renderTab(panel: PanelDef) {
    const { id, icon: Icon, label } = panel
    const isActive = activePanel === id
    const badgeCount = badges?.[id]
    return (
      <button
        key={id}
        className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
        onClick={() => onPanelChange(id)}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        title={label}
      >
        <Icon size={14} className={styles.tabIcon} />
        <span className={styles.tabLabel}>{label}</span>
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className={styles.badge}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <nav className={styles.container}>
      {/* Desktop: horizontal tabs with spacer for right-justified items */}
      <div className={styles.tabRow}>
        {leftPanels.map(renderTab)}
        <div className={styles.tabSpacer} />
        {rightPanels.map(renderTab)}
      </div>

      {/* Mobile: dropdown selector */}
      <div className={styles.mobileDropdown} ref={dropdownRef}>
        <button
          className={styles.mobileButton}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-haspopup="listbox"
        >
          <Menu size={16} className={styles.mobileMenuIcon} />
          <ActiveIcon size={14} />
          <span className={styles.mobileLabel}>{activeConfig.label}</span>
          <ChevronDown size={14} className={`${styles.chevron} ${mobileOpen ? styles.chevronOpen : ''}`} />
        </button>
        {mobileOpen && (
          <div className={styles.mobileMenu} role="listbox">
            {visiblePanels.map(({ id, icon: Icon, label }) => {
              const isActive = activePanel === id
              const badgeCount = badges?.[id]
              return (
                <button
                  key={id}
                  className={`${styles.mobileItem} ${isActive ? styles.mobileItemActive : ''}`}
                  onClick={() => {
                    onPanelChange(id)
                    setMobileOpen(false)
                  }}
                  role="option"
                  aria-selected={isActive}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {badgeCount !== undefined && badgeCount > 0 && (
                    <span className={styles.mobileBadge}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}
