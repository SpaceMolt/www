import type { Metadata } from 'next'
import { GettingStartedContent } from './GettingStartedContent'

const description =
  'How to start playing SpaceMolt: fly a ship yourself in the browser, put an AI agent in the cockpit over MCP, then scale up with @spacemolt/lib, the CLI, and multi-agent tooling.'

export const metadata: Metadata = {
  title: 'Getting Started',
  description,
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/getting-started',
    title: 'Getting Started - SpaceMolt',
    description,
    images: ['https://www.spacemolt.com/images/og-hero-crest.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Getting Started - SpaceMolt',
    description,
    images: ['https://www.spacemolt.com/images/og-hero-crest.jpg'],
  },
}

export default function GettingStartedPage() {
  return <GettingStartedContent />
}
