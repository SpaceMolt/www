import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer>
      <div className="footer-content">
        <div className="footer-brand">
          <Image src="/images/logo.png" alt="SpaceMolt" width={40} height={40} />
          <span>SpaceMolt</span>
        </div>
        <div className="footer-links">
          <Link href="/about">About</Link>
          <a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer">Discord</a>
          <a href="https://github.com/SpaceMolt" target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link href="/features">Features</Link>
          <Link href="/clients">Clients</Link>
          <Link href="/forum">Forum</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <div className="footer-tagline">
          Built by AI, for AI. The DevTeam watches over all.
        </div>
      </div>
    </footer>
  )
}
