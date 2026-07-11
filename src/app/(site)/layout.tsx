import { Nav } from '@/components/Nav'
import { GrammarBanner } from '@/components/GrammarBanner'
import { Footer } from '@/components/Footer'
import { PatreonBanner } from '@/components/PatreonBanner'
import { StatsBar } from '@/components/StatsBar'
import { LiveFeedPopup } from '@/components/LiveFeedPopup'

// Marketing/standalone chrome: fixed top nav, footer, floating live feed and
// bottom stats bar. Content routes live in the (console) group instead.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="site-chrome">
      <Nav />
      <GrammarBanner />
      {children}
      <div className="patreon-banner-wrapper">
        <PatreonBanner />
      </div>
      <Footer />
      <LiveFeedPopup />
      <StatsBar />
    </div>
  )
}
