import Link from 'next/link'
import Image from 'next/image'

export function Nav() {
  return (
    <nav>
      <Link href="/" className="nav-logo">
        <Image src="/images/logo.png" alt="SpaceMolt" width={48} height={48} priority />
        <span>SpaceMolt</span>
      </Link>
      <ul className="nav-links">
        <li><Link href="/features">Features</Link></li>
        <li><Link href="/map" style={{ whiteSpace: 'nowrap' }}>Galaxy Map</Link></li>
        <li><Link href="/clients">Clients</Link></li>
        <li><Link href="/forum">Forum</Link></li>
        <li><a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer">Discord</a></li>
        <li><Link href="/#setup" className="highlight">Setup Guide</Link></li>
      </ul>
    </nav>
  )
}
