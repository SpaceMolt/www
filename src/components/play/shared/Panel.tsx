'use client'

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import shared from '../shared.module.css'

interface PanelProps {
  title: string
  icon?: ReactNode
  /** Theme color for header — CSS color value */
  color?: string
  /** Extra content in the header (right side) */
  headerRight?: ReactNode
  children: ReactNode
}

export function Panel({ title, icon, color, headerRight, children }: PanelProps) {
  const { headerStyle, titleStyle } = usePanelStyles(color)

  return (
    <div className={shared.panel}>
      <div className={shared.header} style={headerStyle}>
        <div className={shared.title} style={titleStyle}>
          {icon && <span className={shared.titleIcon} style={titleStyle}>{icon}</span>}
          {title}
        </div>
        {headerRight}
      </div>
      <div className={shared.content}>
        {children}
      </div>
    </div>
  )
}

/** Hide inactive tab labels while the full row is wider than the panel. */
function useCompactTabs(labels: string) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.classList.remove(shared.tabsCompact)
      el.classList.toggle(shared.tabsCompact, el.scrollWidth > el.clientWidth)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [labels])
  return ref
}

interface PanelWithTabsProps {
  title: string
  icon?: ReactNode
  color?: string
  headerRight?: ReactNode
  tabs: Array<{ id: string; label: string; icon?: ReactNode; badge?: ReactNode; hidden?: boolean }>
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
}

export function PanelWithTabs({ title, icon, color, headerRight, tabs, activeTab, onTabChange, children }: PanelWithTabsProps) {
  const { headerStyle, titleStyle } = usePanelStyles(color)
  const visibleTabs = tabs.filter(t => !t.hidden)
  const tabsRef = useCompactTabs(visibleTabs.map(t => t.label).join())

  return (
    <div className={shared.panel}>
      <div className={shared.header} style={headerStyle}>
        <div className={shared.title} style={titleStyle}>
          {icon && <span className={shared.titleIcon} style={titleStyle}>{icon}</span>}
          {title}
        </div>
        {headerRight}
      </div>
      <div className={shared.tabs} ref={tabsRef}>
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            className={`${shared.tab} ${activeTab === tab.id ? shared.tabActive : ''}`}
            style={activeTab === tab.id ? titleStyle : undefined}
            onClick={() => onTabChange(tab.id)}
            type="button"
            title={tab.label}
          >
            {tab.icon} <span className={shared.tabLabel}>{tab.label}</span>{tab.badge}
          </button>
        ))}
      </div>
      <div className={shared.content}>
        {children}
      </div>
    </div>
  )
}

function usePanelStyles(color?: string) {
  return useMemo(() => {
    const titleColor = color || 'var(--plasma-cyan)'
    const headerBg = color ? `rgba(${hexToRgb(color)}, 0.03)` : undefined
    return {
      headerStyle: headerBg ? { background: headerBg } as const : undefined,
      titleStyle: { color: titleColor } as const,
    }
  }, [color])
}

// Convert CSS variable name to RGB for rgba backgrounds
function hexToRgb(color: string): string {
  const varMap: Record<string, string> = {
    'var(--plasma-cyan)': '0, 212, 255',
    'var(--bio-green)': '45, 212, 191',
    'var(--claw-red)': '230, 57, 70',
    'var(--shell-orange)': '255, 107, 53',
    'var(--void-purple)': '155, 89, 182',
    'var(--hull-grey)': '61, 90, 108',
  }
  return varMap[color] || '0, 212, 255'
}
