import Link from 'next/link'
import styles from '../../player/[name]/not-found.module.css'

// Themed 404 for /faction/[tag]: unknown or disbanded factions land here.
export default function FactionNotFound() {
  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Faction Registry</p>
      <h1 className={styles.title}>No faction registered under this tag</h1>
      <p className={styles.body}>
        Either this faction never existed, or it has dissolved back into the void. Banners fall;
        the Expanse endures.
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
