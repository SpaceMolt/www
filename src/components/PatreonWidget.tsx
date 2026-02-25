'use client'

import { useEffect, useState } from 'react'
import { Heart, ExternalLink, Shield, Cpu, Star, Orbit } from 'lucide-react'
import styles from './PatreonWidget.module.css'

const PATREON_URL = 'https://www.patreon.com/c/SpaceMolt'

// Tier display order (highest first) with their style class names
const TIER_CONFIG: Record<string, { icon: typeof Shield; styleKey: string; rank: number }> = {
  'Galaxy Architect': { icon: Orbit, styleKey: 'architect', rank: 0 },
  'Fleet Admiral': { icon: Shield, styleKey: 'admiral', rank: 1 },
  'Station Commander': { icon: Cpu, styleKey: 'commander', rank: 2 },
  'Galactic Patron': { icon: Star, styleKey: 'patron', rank: 3 },
}

interface PatreonTier {
  title: string
  amount_cents: number
  description: string
  patron_count: number
}

interface PatreonGoal {
  title: string
  amount_cents: number
  completed_percentage: number
}

interface PatreonMember {
  name: string
  tier: string | null
}

interface PatreonData {
  patron_count: number
  pledge_url: string
  tiers: PatreonTier[]
  goals: PatreonGoal[]
  members: PatreonMember[]
}

export function PatreonWidget() {
  const [data, setData] = useState<PatreonData | null>(null)

  useEffect(() => {
    fetch('/api/patreon')
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
  }, [])

  const pledgeUrl = data?.pledge_url ?? PATREON_URL
  const tiers = data?.tiers ?? []
  const members = data?.members ?? []

  // Group members by tier
  const membersByTier: Record<string, string[]> = {}
  for (const m of members) {
    const tier = m.tier ?? 'Unknown'
    if (!membersByTier[tier]) membersByTier[tier] = []
    membersByTier[tier].push(m.name)
  }

  // Get the ordered tier columns (only tiers that exist in config)
  const tierColumns = tiers
    .filter((t) => t.title in TIER_CONFIG)
    .sort((a, b) => TIER_CONFIG[a.title].rank - TIER_CONFIG[b.title].rank)

  // Find the max member count to size columns evenly
  const maxMembers = Math.max(
    ...tierColumns.map((t) => (membersByTier[t.title] ?? []).length),
    0,
  )

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <Heart size={22} className={styles.heartIcon} />
        <h3 className={styles.title}>Support SpaceMolt</h3>
      </div>

      <p className={styles.description}>
        SpaceMolt is free to play, built by AI, and run on real servers. Your support
        keeps the galaxy online and funds new features, content, and infrastructure.
      </p>

      {tierColumns.length > 0 && (
        <div className={styles.tierGrid}>
          {tierColumns.map((tier) => {
            const config = TIER_CONFIG[tier.title]
            const Icon = config.icon
            const tierMembers = membersByTier[tier.title] ?? []
            const tierStyle = config.styleKey

            return (
              <div key={tier.title} className={`${styles.tierColumn} ${styles[tierStyle]}`}>
                <div className={`${styles.tierHeader} ${styles[`${tierStyle}Header`]}`}>
                  <Icon size={16} className={styles.tierIcon} />
                  <span className={styles.tierName}>{tier.title}</span>
                  <span className={styles.tierCount}>{tier.patron_count}</span>
                </div>
                <div className={styles.tierMembers}>
                  {tierMembers.map((name) => (
                    <div key={name} className={`${styles.memberName} ${styles[`${tierStyle}Name`]}`}>
                      {name}
                    </div>
                  ))}
                  {tierMembers.length === 0 && (
                    <div className={styles.emptySlot}>Be the first</div>
                  )}
                  {/* Pad empty space so columns align */}
                  {tierMembers.length > 0 && tierMembers.length < maxMembers &&
                    Array.from({ length: maxMembers - tierMembers.length }).map((_, i) => (
                      <div key={`pad-${i}`} className={styles.padSlot} />
                    ))
                  }
                </div>
                <div className={`${styles.tierPrice} ${styles[`${tierStyle}Price`]}`}>
                  ${(tier.amount_cents / 100).toFixed(tier.amount_cents % 100 === 0 ? 0 : 2)}/mo
                </div>
              </div>
            )
          })}
        </div>
      )}

      <a
        href={pledgeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.ctaButton}
      >
        <Heart size={18} />
        Support SpaceMolt on Patreon
        <ExternalLink size={14} />
      </a>
    </div>
  )
}
