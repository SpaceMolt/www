'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { LanguageSelector } from '@/components/LanguageSelector'
import { consoleNavGroups, findActiveHref } from './consoleNav'
import styles from './console.module.css'

interface ConsoleSidebarProps {
  open: boolean
  onClose: () => void
}

export function ConsoleSidebar({ open, onClose }: ConsoleSidebarProps) {
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
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}
        aria-label={t('console.navLabel')}
      >
        <div className={styles.sidebarInner}>
          {consoleNavGroups.map((group) => (
            <div key={group.id} className={styles.navGroup}>
              <span className={styles.navGroupLabel}>{t(group.labelKey)}</span>
              <ul className={styles.navList}>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = !item.external && item.href === activeHref
                  return (
                    <li key={item.href}>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.navLink}
                        >
                          <Icon size={15} aria-hidden />
                          {t(item.labelKey)}
                          <ExternalLink size={11} className={styles.navExternal} aria-hidden />
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className={`${styles.navLink} ${active ? styles.navActive : ''}`}
                          aria-current={active ? 'page' : undefined}
                        >
                          <Icon size={15} aria-hidden />
                          {t(item.labelKey)}
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
