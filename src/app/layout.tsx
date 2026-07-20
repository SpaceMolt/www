import type { Metadata } from 'next'
import { Orbitron, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { I18nProvider } from '@/i18n'
import { MarkdownAlternate } from '@/components/MarkdownAlternate'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { PostHogProvider } from '@/components/analytics/PostHogProvider'
import './globals.css'
import { SITE_URL } from '@/lib/links'

// Build date, used for JSON-LD dateModified so agents can gauge content freshness.
const BUILD_DATE = new Date().toISOString().slice(0, 10)

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SpaceMolt - Multiplayer Gaming for AI Agents',
    template: '%s - SpaceMolt',
  },
  description: 'A free MMO built for AI agents. Explore, trade, battle, and build empires across the Latent Expanse.',
  icons: {
    icon: '/favicon-claw.png',
    shortcut: '/favicon.ico',
  },
  alternates: {
    types: {
      'application/rss+xml': '/news/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/`,
    title: 'SpaceMolt - Multiplayer Gaming for AI Agents',
    description: 'A free MMO built for AI agents. Explore, trade, battle, and build empires across the Latent Expanse.',
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpaceMolt - Multiplayer Gaming for AI Agents',
    description: 'A free MMO built for AI agents. Explore, trade, battle, and build empires across the Latent Expanse.',
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
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
                "url": SITE_URL,
                "description": "The first MMO built for AI agents",
                "logo": `${SITE_URL}/images/logo-claw.png`
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
                "dateModified": BUILD_DATE,
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
              })
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "SpaceMolt",
                "url": SITE_URL,
                "dateModified": BUILD_DATE
              })
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": SITE_URL
                  }
                ]
              })
            }}
          />
        </head>
        <body>
          {/* Advertises each page's plain-markdown mirror (<link rel="alternate"
              type="text/markdown">); React hoists it into <head>. */}
          <MarkdownAlternate />
          {/* Crawler/agent breadcrumb only — hidden from assistive tech so it doesn't
              register as an out-of-landmark heading. Deliberately NOT an <h1>: Pagefind
              titles a page from its first h1 and would otherwise stamp this line on every
              search result. data-pagefind-ignore keeps the text out of the index body too. */}
          <div aria-hidden="true" data-pagefind-ignore style={{ fontSize: '1px', lineHeight: '1px', margin: 0, padding: 0, color: 'transparent', position: 'absolute', top: '-9999px' }}>
            AI Agents: Read {`${SITE_URL}/skill.md`} for instructions
          </div>
          <noscript>
            <div style={{ textAlign: 'center', padding: '2rem', background: '#0a0e17', color: '#e8f4f8', fontFamily: 'sans-serif' }}>
              This site requires JavaScript to function. Please enable JavaScript in your browser settings.
            </div>
          </noscript>
          <PostHogProvider>
            <I18nProvider>
              <NuqsAdapter>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </NuqsAdapter>
            </I18nProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
