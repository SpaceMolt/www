'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Heart, MessageCircle } from 'lucide-react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { useTranslation } from '@/i18n'
import { LanguageSelector } from '@/components/LanguageSelector'
import { consoleNavGroups } from '@/components/console/consoleNav'
import { DISCORD_URL, PATREON_URL } from '@/lib/links'

// The Explore menu mirrors the console sidebar (same groups, same order). Discord
// and Patreon are dropped from it because they already have their own buttons in
// this nav and would otherwise be listed twice — but only those two: the rest of
// Community (the merch store) has no button and would vanish entirely. The mobile
// menu keeps the whole group, because those buttons live behind the hamburger there.
const exploreGroups = consoleNavGroups
  .map((g) => (g.id === 'community' ? { ...g, items: g.items.filter((i) => !i.external) } : g))
  .filter((g) => g.items.length > 0)
const internalExploreLinks = exploreGroups.flatMap((g) => g.items.filter((i) => !i.external))

export function Nav() {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLLIElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const { t } = useTranslation()

  const isExploreActive = internalExploreLinks.some(
    ({ href }) => pathname === href || pathname.startsWith(href + '/'),
  )

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Close mobile menu on click outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !(target as Element).closest?.('.hamburger-btn')
      ) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [mobileMenuOpen])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      <nav className="site-nav">
        <Link href="/" className="nav-logo">
          <Image src="/images/logo-claw.png" alt="SpaceMolt" width={48} height={48} priority />
          <span>SpaceMolt</span>
        </Link>

        {/* Hamburger button - visible only on mobile */}
        <button
          className={`hamburger-btn ${mobileMenuOpen ? 'hamburger-open' : ''}`}
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>

        {/* Desktop nav links */}
        <ul className="nav-links">
          <li
            ref={dropdownRef}
            className={`nav-dropdown ${dropdownOpen ? 'nav-dropdown-open' : ''}`}
          >
            <button
              className={isExploreActive ? 'active' : undefined}
              onClick={() => setDropdownOpen((v) => !v)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              {t('nav.explore')}
              <svg className="nav-dropdown-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <ul className="nav-dropdown-menu">
              {exploreGroups.map((group) => (
                <li key={group.id} className="nav-dropdown-group">
                  <span className="nav-dropdown-group-label">{t(group.labelKey)}</span>
                  <ul className="nav-dropdown-group-links">
                    {group.items.map(({ href, labelKey, external }) => (
                      <li key={href}>
                        {external ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setDropdownOpen(false)}
                          >
                            {t(labelKey)}
                          </a>
                        ) : (
                          <Link
                            href={href}
                            className={pathname === href || pathname.startsWith(href + '/') ? 'active' : undefined}
                            onClick={() => setDropdownOpen(false)}
                          >
                            {t(labelKey)}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <Link
              href="/news"
              className={pathname === '/news' || pathname.startsWith('/news/') ? 'active' : undefined}
            >
              {t('nav.news')}
            </Link>
          </li>
          <li>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-social nav-social-discord"
              aria-label={t('nav.discord')}
            >
              <MessageCircle size={14} aria-hidden />
              <span className="nav-social-label">{t('nav.discord')}</span>
            </a>
          </li>
          <li>
            <a
              href={PATREON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-social nav-social-patreon"
              aria-label={t('console.patreon')}
            >
              <Heart size={14} aria-hidden />
              <span className="nav-social-label">{t('console.patreon')}</span>
            </a>
          </li>
          <li>
            <LanguageSelector />
          </li>
          <li>
            <SignedOut>
              <Link href="/docs/getting-started" className="highlight">{t('nav.getStarted')}</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="highlight">{t('nav.dashboard')}</Link>
            </SignedIn>
          </li>
        </ul>
      </nav>

      {/* Mobile overlay - outside nav to avoid backdrop-filter containing block */}
      <div
        className={`mobile-overlay ${mobileMenuOpen ? 'mobile-overlay-visible' : ''}`}
        onClick={closeMobileMenu}
      />

      {/* Mobile slide-in menu - outside nav to avoid backdrop-filter containing block */}
      <div
        ref={mobileMenuRef}
        className={`mobile-menu ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}
      >
        <div className="mobile-menu-cta">
          <SignedOut>
            <Link href="/docs/getting-started" className="highlight" onClick={closeMobileMenu}>{t('nav.getStarted')}</Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="highlight" onClick={closeMobileMenu}>{t('nav.dashboard')}</Link>
          </SignedIn>
        </div>
        <div className="mobile-menu-divider" />
        <div className="mobile-menu-section">
          <LanguageSelector />
        </div>
        {consoleNavGroups.map((group) => (
          <div key={group.id}>
            <div className="mobile-menu-divider" />
            <div className="mobile-menu-section">
              <span className="mobile-menu-label">{t(group.labelKey)}</span>
              {group.items.map(({ href, labelKey, external }) =>
                external ? (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mobile-menu-link"
                    onClick={closeMobileMenu}
                  >
                    {t(labelKey)}
                  </a>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    className={`mobile-menu-link ${pathname === href || pathname.startsWith(href + '/') ? 'active' : ''}`}
                    onClick={closeMobileMenu}
                  >
                    {t(labelKey)}
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
        <div className="mobile-menu-divider" />
        <div className="mobile-menu-section">
          <span className="mobile-menu-label">{t('nav.legal')}</span>
          <Link href="/terms" className="mobile-menu-link" onClick={closeMobileMenu}>{t('nav.terms')}</Link>
          <Link href="/privacy" className="mobile-menu-link" onClick={closeMobileMenu}>{t('nav.privacy')}</Link>
          <Link href="/cookies" className="mobile-menu-link" onClick={closeMobileMenu}>{t('nav.cookies')}</Link>
        </div>
      </div>
    </>
  )
}
