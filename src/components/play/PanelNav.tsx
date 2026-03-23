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
  Hammer,
  Star,
  ChevronDown,
  Menu,
} from 'lucide-react'
import styles from './PanelNav.module.css'

interface PanelNavProps {
  activePanel: string
  onPanelChange: (panel: string) => void
  badges?: Record<string, number>
  isDocked?: boolean
  inCombat?: boolean
}

interface PanelDef {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  /** 'always' | 'docked' | 'combat' */
  visibility: 'always' | 'docked' | 'combat'
  /** Right-justify this tab (pushes to far right) */
  right?: boolean
}

const ALL_PANELS: PanelDef[] = [
  { id: 'galaxy', icon: Map, label: 'Galaxy', visibility: 'always' },
  { id: 'ship', icon: Rocket, label: 'Ship', visibility: 'always' },
  { id: 'faction', icon: Users, label: 'Faction', visibility: 'always' },
  { id: 'missions', icon: Target, label: 'Missions', visibility: 'always' },
  // Station tabs — always visible (view remotely), mutations disabled in space
  { id: 'trading', icon: TrendingUp, label: 'Market', visibility: 'always' },
  { id: 'storage', icon: Package, label: 'Storage', visibility: 'always' },
  // Docked-only tabs
  { id: 'shipyard', icon: Warehouse, label: 'Shipyard', visibility: 'docked' },
  { id: 'crafting', icon: Hammer, label: 'Crafting', visibility: 'docked' },
  { id: 'skills', icon: Star, label: 'Skills', visibility: 'always' },
  // Combat tab — only when in battle
  { id: 'combat', icon: Swords, label: 'Combat', visibility: 'combat' },
  // Right-justified
  { id: 'info', icon: Info, label: 'Info', visibility: 'always', right: true },
  { id: 'settings', icon: Settings, label: 'Settings', visibility: 'always', right: true },
]

export function PanelNav({ activePanel, onPanelChange, badges, isDocked, inCombat }: PanelNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const visiblePanels = useMemo(() => {
    return ALL_PANELS.filter((p) => {
      if (p.visibility === 'always') return true
      if (p.visibility === 'docked') return isDocked
      if (p.visibility === 'combat') return inCombat
      return false
    })
  }, [isDocked, inCombat])

  const leftPanels = visiblePanels.filter((p) => !p.right)
  const rightPanels = visiblePanels.filter((p) => p.right)

  const activeConfig = visiblePanels.find((p) => p.id === activePanel) || visiblePanels[0]
  const ActiveIcon = activeConfig.icon

  // If active panel becomes hidden (e.g. undock hides trading), fall back to galaxy
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
