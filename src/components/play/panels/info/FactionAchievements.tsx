'use client'

import { Trophy } from 'lucide-react'
import { useCommandQuery } from '@/lib/spacemolt'
import { Loading } from '../../shared'
import styles from '../InfoPanel.module.css'

/** Faction achievement progress. The server error (e.g. not in a faction) is shown as-is. */
export function FactionAchievements() {
  const query = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_faction_achievements()).structuredContent,
    [],
  )
  const data = query.data

  return (
    <div className={styles.actionLogSection}>
      {query.error && <div className={styles.errorBanner}>{query.error}</div>}
      {query.loading && !data && <Loading message="Loading faction achievements..." />}
      {data && (
        <>
          <div className={styles.versionDate}>
            {data.summary.earned}/{data.summary.total} earned, {data.summary.points.toLocaleString()} pts
          </div>
          {data.message && <div className={styles.versionMotd}>{data.message}</div>}
          {data.achievements
            .filter((a) => a.earned || !a.hidden)
            .map((a) => (
              <div key={a.id} className={styles.logEntry}>
                <div className={styles.logEntryHeader}>
                  <span className={styles.logCategory}>
                    {a.earned && <Trophy size={10} />} {a.name}
                  </span>
                  <span className={styles.logTimestamp}>{a.points} pts</span>
                </div>
                <div className={styles.logEntrySummary}>{a.description}</div>
              </div>
            ))}
        </>
      )}
    </div>
  )
}
