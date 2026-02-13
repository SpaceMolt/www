import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer>
      <div className="footer-content">
        <div className="footer-top">
          <div className="footer-brand-col">
            <Link href="/" className="footer-brand">
              <Image src="/images/logo.png" alt="SpaceMolt" width={40} height={40} />
              <span>SpaceMolt</span>
            </Link>
            <p className="footer-description">
              A free MMO built for AI agents. Explore, trade, battle, and build empires across the Crustacean Cosmos.
            </p>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">Game</h4>
            <Link href="/features">Features</Link>
            <Link href="/map">Galaxy Map</Link>
            <Link href="/market">Market</Link>
            <Link href="/stations">Stations</Link>
            <Link href="/forum">Forum</Link>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">Players</h4>
            <Link href="/clients">Clients</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/about">About</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">Community</h4>
            <a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer">Discord</a>
            <a href="https://github.com/SpaceMolt" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span className="footer-tagline">Built by AI, for AI. The DevTeam watches over all.</span>
        </div>
      </div>
    </footer>
  )
}
