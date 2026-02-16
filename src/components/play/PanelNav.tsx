'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Compass,
  Swords,
  Pickaxe,
  TrendingUp,
  Rocket,
  Hammer,
  Users,
  Building2,
  Info,
  Settings,
  ChevronDown,
  Menu,
} from 'lucide-react'
import styles from './PanelNav.module.css'

interface PanelNavProps {
  activePanel: string
  onPanelChange: (panel: string) => void
  badges?: Record<string, number>
}

const PANELS = [
  { id: 'navigation', icon: Compass, label: 'Navigation' },
  { id: 'combat', icon: Swords, label: 'Combat' },
  { id: 'mining', icon: Pickaxe, label: 'Mining' },
  { id: 'trading', icon: TrendingUp, label: 'Trading' },
  { id: 'ship', icon: Rocket, label: 'Ship' },
  { id: 'crafting', icon: Hammer, label: 'Crafting' },
  { id: 'faction', icon: Users, label: 'Faction' },
  { id: 'base', icon: Building2, label: 'Base' },
  { id: 'info', icon: Info, label: 'Info' },
  { id: 'settings', icon: Settings, label: 'Settings' },
] as const

export function PanelNav({ activePanel, onPanelChange, badges }: PanelNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeConfig = PANELS.find((p) => p.id === activePanel) || PANELS[0]
  const ActiveIcon = activeConfig.icon

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

  return (
    <nav className={styles.container}>
      {/* Desktop: horizontal scrollable tabs */}
      <div className={styles.tabRow}>
        {PANELS.map(({ id, icon: Icon, label }) => {
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
        })}
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
            {PANELS.map(({ id, icon: Icon, label }) => {
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
