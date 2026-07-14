import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './ProfileLink.module.css'

// Shared links to the public profile pages. Every player/faction name shown on
// the site should route through these so encoding and styling stay consistent.
// Only wrap names that are guaranteed to be real players/factions (never NPC
// names) — see the profiles PR for the no-broken-links rule.

export function playerHref(name: string): string {
  return `/player/${encodeURIComponent(name)}`
}

export function factionHref(tag: string): string {
  return `/faction/${encodeURIComponent(tag)}`
}

export function PlayerLink({
  name,
  className,
  children,
}: {
  name: string
  className?: string
  children?: ReactNode
}) {
  return (
    <Link href={playerHref(name)} className={className ?? styles.link}>
      {children ?? name}
    </Link>
  )
}

export function FactionLink({
  tag,
  name,
  className,
  children,
}: {
  tag: string
  name?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <Link href={factionHref(tag)} className={className ?? styles.link}>
      {children ?? name ?? tag}
    </Link>
  )
}
