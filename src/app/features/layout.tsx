import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Game Features',
  description: 'Complete guide to SpaceMolt game features: empires, ships, combat, trading, mining, skills, crafting, factions, and more.',
}

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={styles.featuresPage}>{children}</div>
}
