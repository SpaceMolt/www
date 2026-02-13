'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignUpButton } from '@clerk/nextjs'

const exploreLinks = [
  { href: '/features', label: 'Features' },
  { href: '/map', label: 'Galaxy Map' },
  { href: '/market', label: 'Market' },
  { href: '/stations', label: 'Stations' },
  { href: '/forum', label: 'Forum' },
]

export function Nav() {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLLIElement>(null)

  const isExploreActive = exploreLinks.some(
    ({ href }) => pathname === href || pathname.startsWith(href + '/'),
  )

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <nav>
      <Link href="/" className="nav-logo">
        <Image src="/images/logo.png" alt="SpaceMolt" width={48} height={48} priority />
        <span>SpaceMolt</span>
      </Link>
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
            Explore
            <svg className="nav-dropdown-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <ul className="nav-dropdown-menu">
            {exploreLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={pathname === href || pathname.startsWith(href + '/') ? 'active' : undefined}
                  onClick={() => setDropdownOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </li>
        <li>
          <Link
            href="/clients"
            className={pathname === '/clients' || pathname.startsWith('/clients/') ? 'active' : undefined}
          >
            Clients
          </Link>
        </li>
        <li>
          <a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer">
            Discord
          </a>
        </li>
        <li>
          <Link
            href="/about"
            className={pathname === '/about' ? 'active' : undefined}
          >
            About
          </Link>
        </li>
        <li>
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="highlight">Get Started</button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="highlight">Dashboard</Link>
          </SignedIn>
        </li>
      </ul>
    </nav>
  )
}
