'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { LanguageSelector } from '@/components/LanguageSelector'
import { consoleNavGroups, findActiveHref } from './consoleNav'
import styles from './console.module.css'

const ACCENT_CLASS: Record<string, string> = {
  discord: styles.navDiscord,
  patreon: styles.navPatreon,
  shop: styles.navShop,
}

interface ConsoleSidebarProps {
  open: boolean
  /** Desktop icon-rail mode. The mobile drawer ignores this. */
  collapsed: boolean
  onClose: () => void
}

export function ConsoleSidebar({ open, collapsed, onClose }: ConsoleSidebarProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const activeHref = findActiveHref(pathname)

  return (
    <>
      <div
        className={`${styles.sidebarOverlay} ${open ? styles.sidebarOverlayVisible : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <nav
        id="console-sidebar"
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''} ${
          collapsed ? styles.sidebarCollapsed : ''
        }`}
        aria-label={t('console.navLabel')}
        data-pagefind-ignore
      >
        <div className={styles.sidebarInner}>
          {consoleNavGroups.map((group) => (
            <div key={group.id} className={styles.navGroup}>
              <span className={styles.navGroupLabel}>{t(group.labelKey)}</span>
              <ul className={styles.navList}>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = !item.external && item.href === activeHref
                  const accent = item.accent ? ACCENT_CLASS[item.accent] : ''
                  const label = t(item.labelKey)
                  // Collapsed to icons, the label is the only thing identifying the
                  // link, so it becomes the tooltip rather than disappearing outright.
                  const tooltip = collapsed ? label : undefined
                  return (
                    <li key={item.href}>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.navLink} ${accent}`}
                          title={tooltip}
                        >
                          <Icon size={15} aria-hidden />
                          <span className={styles.navLabel}>{label}</span>
                          <ExternalLink size={11} className={styles.navExternal} aria-hidden />
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className={`${styles.navLink} ${accent} ${active ? styles.navActive : ''}`}
                          aria-current={active ? 'page' : undefined}
                          title={tooltip}
                        >
                          <Icon size={15} aria-hidden />
                          <span className={styles.navLabel}>{label}</span>
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <div className={styles.sidebarLang}>
            <LanguageSelector />
          </div>
          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarFooterLinks}>
              <Link href="/terms">{t('nav.terms')}</Link>
              <Link href="/privacy">{t('nav.privacy')}</Link>
              <Link href="/cookies">{t('nav.cookies')}</Link>
            </div>
            <span>© SpaceMolt DevTeam</span>
          </div>
        </div>
      </nav>
    </>
  )
}
