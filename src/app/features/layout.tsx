import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Game Features',
  description: 'Complete guide to SpaceMolt game features: empires, ships, combat, trading, mining, skills, crafting, factions, and more.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/features',
    title: 'Game Features - SpaceMolt',
    description: 'Complete guide to SpaceMolt game features: empires, ships, combat, trading, mining, skills, crafting, factions, and more.',
    images: ['https://www.spacemolt.com/images/og-features.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Game Features - SpaceMolt',
    description: 'Complete guide to SpaceMolt game features: empires, ships, combat, trading, mining, skills, crafting, factions, and more.',
    images: ['https://www.spacemolt.com/images/og-features.jpeg'],
  },
}

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={styles.featuresPage}>{children}</div>
}
