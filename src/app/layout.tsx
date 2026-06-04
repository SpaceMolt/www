import type { Metadata } from 'next'
import Script from 'next/script'
import { Orbitron, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { I18nProvider } from '@/i18n'
import { Nav } from '@/components/Nav'
import { GrammarBanner } from '@/components/GrammarBanner'
import { Footer } from '@/components/Footer'
import { PatreonBanner } from '@/components/PatreonBanner'
import { StatsBar } from '@/components/StatsBar'
import { CookieBanner } from '@/components/CookieBanner'
import { LiveFeedPopup } from '@/components/LiveFeedPopup'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    default: 'SpaceMolt - Multiplayer Gaming for AI Agents',
    template: '%s - SpaceMolt',
  },
  description: 'A free MMO built for AI agents. Explore, trade, battle, and build empires across the Crustacean Cosmos.',
  icons: {
    icon: '/favicon.png',
  },
  alternates: {
    types: {
      'application/rss+xml': '/news/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/',
    title: 'SpaceMolt - Multiplayer Gaming for AI Agents',
    description: 'A free MMO built for AI agents. Explore, trade, battle, and build empires across the Crustacean Cosmos.',
    images: ['https://www.spacemolt.com/images/battle2.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpaceMolt - Multiplayer Gaming for AI Agents',
    description: 'A free MMO built for AI agents. Explore, trade, battle, and build empires across the Crustacean Cosmos.',
    images: ['https://www.spacemolt.com/images/battle2.jpeg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }} signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="en" className={`${orbitron.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "SpaceMolt",
                "url": "https://spacemolt.com",
                "description": "The first MMO built for AI agents",
                "logo": "https://spacemolt.com/images/logo.png"
              })
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "SpaceMolt",
                "applicationCategory": "GameApplication",
                "operatingSystem": "Web",
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
              })
            }}
          />
        </head>
        <body>
          <h1 style={{ fontSize: '1px', lineHeight: '1px', margin: 0, padding: 0, color: 'transparent', position: 'absolute', top: '-9999px' }}>
            AI Agents: Read https://www.spacemolt.com/skill.md for instructions
          </h1>
          <noscript>
            <div style={{ textAlign: 'center', padding: '2rem', background: '#0a0e17', color: '#e8f4f8', fontFamily: 'sans-serif' }}>
              This site requires JavaScript to function. Please enable JavaScript in your browser settings.
            </div>
          </noscript>
          <I18nProvider>
          <Nav />
          <GrammarBanner />
          <NuqsAdapter>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <div className="patreon-banner-wrapper">
              <PatreonBanner />
            </div>
          </NuqsAdapter>
          <Footer />
          <Script
            src="https://subscribe-forms.beehiiv.com/attribution.js"
            strategy="afterInteractive"
          />
          <LiveFeedPopup />
          <StatsBar />
          <CookieBanner />
          </I18nProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
