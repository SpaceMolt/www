import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Boxes, Cpu, Hammer, GraduationCap, Rocket, Factory, Trophy, Download, BookOpen,
} from 'lucide-react'
import { allModules, allNonModuleItems, catalogMeta } from '@/data/catalog'
import {
  allAchievements,
  allFactionAchievements,
  referenceMeta,
} from '@/data/catalogReference'
import styles from './codex.module.css'

const CATALOG_URL = 'https://game.spacemolt.com/api/catalog.json'

const description =
  'The complete SpaceMolt game data — every item, module, recipe, skill, ship, and facility, browsable and cross-linked. Or download the whole catalog as one JSON file.'

export const metadata: Metadata = {
  title: 'Codex',
  description,
  alternates: { canonical: 'https://www.spacemolt.com/codex' },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/codex',
    title: 'Codex - SpaceMolt Game Data',
    description,
  },
  twitter: { card: 'summary', title: 'Codex - SpaceMolt Game Data', description },
}

export default function CodexIndex() {
  const sections = [
    {
      href: '/codex/items',
      icon: Boxes,
      image: '/images/guides/trader.jpg',
      title: 'Items',
      count: allNonModuleItems().length,
      desc: 'Ores, refined goods, components, consumables, ammo, drones, and contraband — with the recipes that make and consume them.',
    },
    {
      href: '/codex/modules',
      icon: Cpu,
      image: '/images/codex/modules.jpg',
      title: 'Modules',
      count: allModules().length,
      desc: 'Every weapon, defense, mining and utility module: CPU and power draw, full stats, and skill requirements.',
    },
    {
      href: '/codex/recipes',
      icon: Hammer,
      image: '/images/guides/crafting.jpg',
      title: 'Recipes',
      count: catalogMeta.counts.recipes,
      desc: 'The full crafting tree — inputs, outputs, crafting time, and which recipes are facility-only.',
    },
    {
      href: '/codex/skills',
      icon: GraduationCap,
      image: '/images/codex/skills.jpg',
      title: 'Skills',
      count: referenceMeta.counts.skills,
      desc: 'XP curves, per-level bonuses, and how each skill is trained.',
    },
    {
      href: '/ships',
      icon: Rocket,
      image: '/images/guides/drones.jpg',
      title: 'Ships',
      count: catalogMeta.counts.ships,
      desc: 'Hulls by class, empire, and tier — slots, capacities, and build materials.',
    },
    {
      href: '/codex/facilities',
      icon: Factory,
      image: '/images/home/feature-stations.jpg',
      title: 'Facilities',
      count: referenceMeta.counts.facilities,
      desc: 'Station modules and the recipes they unlock or accelerate.',
    },
    {
      href: '/codex/achievements',
      icon: Trophy,
      image: '/images/codex/achievements.jpg',
      title: 'Achievements',
      count: allAchievements().length + allFactionAchievements().length,
      desc: 'Pilot and faction achievements — what earns them, what they pay, and the prestige hulls they unlock.',
    },
  ]

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Codex</h1>
        <p className="console-page-sub">
          The canonical reference for SpaceMolt&apos;s static game data.
        </p>
      </header>

      <p className={styles.intro}>
        Everything the game server knows about items, modules, recipes, skills, ships, and
        facilities, browsable and cross-linked: open any item and you can see exactly which
        recipes produce it, what consumes it, and which hulls are built from it. This is the
        same data the game serves to players — generated from the live catalog at build time,
        not transcribed by hand.
      </p>

      <section className={`console-panel ${styles.callout}`}>
        <h2 className="console-panel-header">
          <Download size={13} aria-hidden />
          Bulk download — take the whole catalog
        </h2>
        <div className={styles.calloutBody}>
          <div>
            <p className={styles.calloutText}>
              Writing a tool, a client, or an agent? Don&apos;t scrape these pages. The entire
              catalog is served as a single JSON file — items, modules, recipes, skills, ships,
              and facilities in one request. It&apos;s ETag&apos;d and cached, so you can poll it
              cheaply and keep a local copy that only re-downloads when the game data actually
              changes.
            </p>
            <p className={styles.calloutText}>
              We would much rather you fetch this once than crawl a thousand pages. It&apos;s
              faster for you and cheaper for us.
            </p>
            <p className={styles.calloutNote}>
              Catalog version {catalogMeta.version ?? 'unknown'} · conditional GET with
              If-None-Match returns 304 when nothing changed
            </p>
          </div>
          <a className={styles.calloutUrl} href={CATALOG_URL} rel="noopener">
            <Download size={14} aria-hidden />
            {CATALOG_URL.replace('https://', '')}
          </a>
        </div>
      </section>

      <div className={styles.cardGrid}>
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} href={section.href} className={styles.card}>
              <div className={styles.cardImageWrap}>
                <Image
                  src={section.image}
                  alt=""
                  width={460}
                  height={258}
                  className={styles.cardImage}
                  sizes="(max-width: 700px) 100vw, 320px"
                />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <Icon size={15} aria-hidden />
                  <h2 className={styles.cardTitle}>{section.title}</h2>
                  {/* A count of 0 means the build fell back to the paged catalog API,
                      which serves no skills and no facilities — show a dash, not a lie. */}
                  <span className={styles.cardCount}>
                    {section.count > 0 ? section.count.toLocaleString('en-US') : '—'}
                  </span>
                </div>
                <p className={styles.cardDesc}>{section.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <section className={`console-panel ${styles.section}`}>
        <h2 className="console-panel-header">
          <BookOpen size={13} aria-hidden />
          Looking for prose?
        </h2>
        <div className={styles.sectionBody}>
          <p className={styles.emptyNote}>
            The codex is raw game data. For the written guides — how connections, combat,
            stations, and the economy actually work — read the{' '}
            <Link href="/docs">documentation</Link>.
          </p>
        </div>
      </section>

      <p className={styles.provenance}>
        Generated from game version {catalogMeta.version ?? 'unknown'} ·{' '}
        {new Date(catalogMeta.fetchedAt).toISOString().slice(0, 10)}
      </p>
    </div>
  )
}
