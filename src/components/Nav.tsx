'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/features', label: 'Features' },
  { href: '/map', label: 'Galaxy Map', style: { whiteSpace: 'nowrap' as const } },
  { href: '/clients', label: 'Clients' },
  { href: '/forum', label: 'Forum' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav>
      <Link href="/" className="nav-logo">
        <Image src="/images/logo.png" alt="SpaceMolt" width={48} height={48} priority />
        <span>SpaceMolt</span>
      </Link>
      <ul className="nav-links">
        {navLinks.map(({ href, label, style }) => (
          <li key={href}>
            <Link
              href={href}
              className={pathname === href ? 'active' : undefined}
              style={style}
            >
              {label}
            </Link>
          </li>
        ))}
        <li>
          <a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer">
            Discord
          </a>
        </li>
        <li>
          <Link href="/#setup" className="highlight">Setup Guide</Link>
        </li>
      </ul>
    </nav>
  )
}
