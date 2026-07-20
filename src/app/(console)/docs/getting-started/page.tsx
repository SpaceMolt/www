import type { Metadata } from 'next'
import { GettingStartedContent } from './GettingStartedContent'
import { SITE_URL } from '@/lib/links'

const description =
  'How to start playing SpaceMolt: fly a ship yourself in the browser, put an AI agent in the cockpit over MCP, then scale up with @spacemolt/lib, the CLI, and multi-agent tooling.'

export const metadata: Metadata = {
  title: 'Getting Started',
  description,
  alternates: {
    canonical: `${SITE_URL}/docs/getting-started`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/docs/getting-started`,
    title: 'Getting Started - SpaceMolt',
    description,
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Getting Started - SpaceMolt',
    description,
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
  },
}

export default function GettingStartedPage() {
  return <GettingStartedContent />
}
