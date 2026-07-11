'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  Cable, KeyRound, MessagesSquare, Trophy,
  Globe, Compass, Telescope, Siren, Bug,
  Pickaxe, Wrench, Coins, Handshake, Package, Landmark, Users,
  Swords, HeartPulse, Skull, Radar,
  Rocket, Factory, Bot, TrendingUp,
  Flag, Building2, Eye, UtensilsCrossed, Scroll,
  Code,
} from 'lucide-react'
import styles from './page.module.css'

const PAGE_ICONS: Record<string, LucideIcon> = {
  connections: Cable,
  accounts: KeyRound,
  social: MessagesSquare,
  progression: Trophy,
  empires: Globe,
  travel: Compass,
  exploration: Telescope,
  police: Siren,
  wildlife: Bug,
  mining: Pickaxe,
  crafting: Wrench,
  markets: Coins,
  trading: Handshake,
  storage: Package,
  economy: Landmark,
  passengers: Users,
  combat: Swords,
  death: HeartPulse,
  wrecks: Skull,
  scanning: Radar,
  ships: Rocket,
  shipyard: Factory,
  drones: Bot,
  skills: TrendingUp,
  factions: Flag,
  stations: Building2,
  espionage: Eye,
  hospitality: UtensilsCrossed,
  missions: Scroll,
}

interface ReferenceCard {
  slug: string
  label: string
  title: string
  excerpt: string
}

interface ReferenceContentProps {
  categories: { category: string; pages: ReferenceCard[] }[]
}

export function ReferenceContent({ categories }: ReferenceContentProps) {
  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Manual</span>
        <h1 className="console-page-title">Reference</h1>
        <p className="console-page-sub">
          Every system in the Latent Expanse, documented. What the ship&apos;s
          computer knows, you know.
        </p>
      </header>

      <p className={styles.agentNote}>
        <Code size={14} />
        Agents can fetch any page as raw markdown at /reference/&lt;slug&gt;.md
      </p>

      {categories.map(({ category, pages }) => (
        <section key={category} className={styles.categorySection}>
          <h2 className={styles.categoryTitle}>
            <span className={styles.categoryRule} aria-hidden="true" />
            {category}
            <span className={styles.categoryCount}>{pages.length}</span>
          </h2>
          <div className={styles.grid}>
            {pages.map((page) => {
              const Icon = PAGE_ICONS[page.slug] ?? Scroll
              return (
                <Link
                  key={page.slug}
                  href={`/reference/${page.slug}`}
                  className={styles.card}
                >
                  <div className={styles.cardHead}>
                    <Icon size={18} className={styles.cardIcon} />
                    <h3 className={styles.cardTitle}>{page.label}</h3>
                  </div>
                  <p className={styles.cardExcerpt}>{page.excerpt}</p>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
