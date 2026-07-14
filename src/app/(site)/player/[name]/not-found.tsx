import Link from 'next/link'
import styles from './not-found.module.css'

// Themed 404 for /player/[name]: hidden pilots and unknown callsigns land here
// instead of a broken-feeling generic error page.
export default function PlayerNotFound() {
  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Pilot Registry</p>
      <h1 className={styles.title}>No public dossier for this callsign</h1>
      <p className={styles.body}>
        Either this pilot doesn&apos;t exist, or they keep their record sealed. Space is big and
        full of ghosts.
      </p>
      <div className={styles.actions}>
        <Link href="/leaderboard" className={styles.link}>
          Browse the leaderboards →
        </Link>
        <Link href="/" className={styles.link}>
          Return home →
        </Link>
      </div>
    </main>
  )
}
