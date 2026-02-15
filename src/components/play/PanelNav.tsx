'use client'

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
  return (
    <nav className={styles.container}>
      {PANELS.map(({ id, icon: Icon, label }) => {
        const isActive = activePanel === id
        const badgeCount = badges?.[id]
        return (
          <button
            key={id}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => onPanelChange(id)}
            title={label}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} className={styles.tabIcon} />
            {badgeCount !== undefined && badgeCount > 0 && (
              <span className={styles.badge}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
            <span className={styles.tooltip}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
