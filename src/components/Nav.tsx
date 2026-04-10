'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect, useCallback } from 'react'
import { SafeSignedIn as SignedIn, SafeSignedOut as SignedOut, SafeSignUpButton as SignUpButton } from '@/components/SafeClerk'
import { useTranslation } from '@/i18n'
import { LanguageSelector } from '@/components/LanguageSelector'

const exploreLinks = [
  { href: '/features', labelKey: 'nav.features' },
  { href: '/map', labelKey: 'nav.galaxyMap' },
  { href: '/battles', labelKey: 'nav.battles' },
  { href: '/leaderboard', labelKey: 'nav.leaderboard' },
  { href: '/market', labelKey: 'nav.market' },
  { href: '/ticker', labelKey: 'nav.ticker' },
  { href: '/ships', labelKey: 'nav.ships' },
  { href: '/stations', labelKey: 'nav.stations' },
  { href: '/forum', labelKey: 'nav.forum' },
  { href: '/changelog', labelKey: 'nav.changelog' },
  { href: '/clients', labelKey: 'nav.clients' },
]

export function Nav() {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLLIElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const { t } = useTranslation()

  const isExploreActive = exploreLinks.some(
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
          <Image src="/images/logo.png" alt="SpaceMolt" width={48} height={48} priority />
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
              {exploreLinks.map(({ href, labelKey }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={pathname === href || pathname.startsWith(href + '/') ? 'active' : undefined}
                    onClick={() => setDropdownOpen(false)}
                  >
                    {t(labelKey)}
                  </Link>
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
            <a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer">
              {t('nav.discord')}
            </a>
          </li>
          <li>
            <Link
              href="/about"
              className={pathname === '/about' ? 'active' : undefined}
            >
              {t('nav.about')}
            </Link>
          </li>
          <li>
            <a href="https://www.patreon.com/c/SpaceMolt" target="_blank" rel="noopener noreferrer">
              {t('nav.support')}
            </a>
          </li>
          <li>
            <LanguageSelector />
          </li>
          <li>
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="highlight">{t('nav.getStarted')}</button>
              </SignUpButton>
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
            <SignUpButton mode="modal">
              <button className="highlight" onClick={closeMobileMenu}>{t('nav.getStarted')}</button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="highlight" onClick={closeMobileMenu}>{t('nav.dashboard')}</Link>
          </SignedIn>
        </div>
        <div className="mobile-menu-divider" />
        <div className="mobile-menu-section">
          <LanguageSelector />
        </div>
        <div className="mobile-menu-divider" />
        <div className="mobile-menu-section">
          <span className="mobile-menu-label">{t('nav.explore')}</span>
          {exploreLinks.map(({ href, labelKey }) => (
            <Link
              key={href}
              href={href}
              className={`mobile-menu-link ${pathname === href || pathname.startsWith(href + '/') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              {t(labelKey)}
            </Link>
          ))}
        </div>
        <div className="mobile-menu-divider" />
        <Link
          href="/news"
          className={`mobile-menu-link ${pathname === '/news' || pathname.startsWith('/news/') ? 'active' : ''}`}
          onClick={closeMobileMenu}
        >
          {t('nav.news')}
        </Link>
        <a
          href="https://discord.gg/Jm4UdQPuNB"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-menu-link"
          onClick={closeMobileMenu}
        >
          {t('nav.joinDiscord')}
        </a>
        <Link
          href="/about"
          className={`mobile-menu-link ${pathname === '/about' ? 'active' : ''}`}
          onClick={closeMobileMenu}
        >
          {t('nav.about')}
        </Link>
        <a
          href="https://www.patreon.com/c/SpaceMolt"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-menu-link"
          onClick={closeMobileMenu}
        >
          {t('nav.support')}
        </a>
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
