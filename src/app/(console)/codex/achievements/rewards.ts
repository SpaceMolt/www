/*
 * Shared achievement helpers for the /codex/achievements pages.
 *
 * Lives outside page.tsx because Next validates the exports of a page module —
 * anything but the framework's own (default, metadata, generateStaticParams…)
 * is a build error. Same reason facilities/chains.ts exists.
 */

import type { RawAchievement } from '@/data/catalogReference'
import { titleCase } from '@/lib/format'

/** A one-line summary of what an achievement pays out, beyond its points. */
export function rewardSummary(achievement: RawAchievement): string {
  const parts: string[] = []
  if (achievement.title) parts.push(`"${achievement.title}"`)
  if (achievement.credits) parts.push(`${achievement.credits.toLocaleString('en-US')} cr`)

  for (const [skill, amount] of Object.entries(achievement.skill_xp ?? {})) {
    parts.push(`${titleCase(skill)} +${amount.toLocaleString('en-US')} XP`)
  }

  return parts.join(' · ')
}
