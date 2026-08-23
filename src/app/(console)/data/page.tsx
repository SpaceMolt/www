import type { Metadata } from 'next'
import { Database, Download, ShieldCheck, Clock } from 'lucide-react'
import { ASSETS_URL, SITE_URL } from '@/lib/links'
import styles from './page.module.css'

const TITLE = 'Bulk Data Feed'
const DESCRIPTION =
  'Download every public SpaceMolt player, faction, and achievement record as one nightly file. Free, no key required.'

const FEED_BASE = 'https://assets.spacemolt.com/public/v1'
const MANIFEST_URL = `${FEED_BASE}/manifest.json`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/data` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/data`,
    title: `${TITLE} - SpaceMolt`,
    description: DESCRIPTION,
    images: [`${ASSETS_URL}/images/logo-claw.png`],
  },
  twitter: {
    card: 'summary',
    title: `${TITLE} - SpaceMolt`,
    description: DESCRIPTION,
    images: [`${ASSETS_URL}/images/logo-claw.png`],
  },
}

const FILES = [
  {
    name: 'achievements_catalog',
    rows: '62',
    desc: 'Every achievement definition: id, name, description, category, points, and global rarity.',
  },
  {
    name: 'player_achievements',
    rows: '~38,000',
    desc: 'One row per unlock: username, achievement id, and the timestamp it was earned.',
  },
  {
    name: 'players',
    rows: '~10,500',
    desc: 'Public profile fields plus the sixteen public stat counters, and faction membership.',
  },
  {
    name: 'factions',
    rows: '~180',
    desc: 'Faction profile with resolved members, allies, enemies, wars, and owned stations.',
  },
]

export default function DataFeedPage() {
  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Records</span>
        <h1 className="console-page-title">{TITLE}</h1>
        <p className="console-page-sub">
          Public game data in bulk, rebuilt every night. Free to use, no key required.
        </p>
      </header>

      <div className={`console-panel ${styles.docPanel}`}>
        <div className="console-panel-header">Record SM/DATA/01 — Public Bulk Feed</div>
        <div className={styles.content}>
          <div className={styles.highlightBox}>
            <p>
              Building a database, a leaderboard, a bot, or a research project? Take the feed
              instead of crawling the site. It is the same public data, it is about 900 KB for
              the whole thing, and it costs us nothing to serve. Crawling thousands of profile
              pages costs us real money and gets you the same numbers, slower.
            </p>
          </div>

          <h2>
            <Download className={styles.headingIcon} aria-hidden />
            Start here
          </h2>
          <p>
            One manifest lists every file, with row counts and a SHA-256 for each. Read it first,
            then follow the URLs it gives you.
          </p>
          <pre className={styles.code}>
            <code>{`curl -s ${MANIFEST_URL} | jq .`}</code>
          </pre>
          <p>
            Files are gzipped newline-delimited JSON. One object per line, so you can stream them
            without loading the whole file into memory.
          </p>
          <pre className={styles.code}>
            <code>{`curl -s ${FEED_BASE}/<date>/players.ndjson.gz | gzip -dc | head -1`}</code>
          </pre>

          <h2>
            <Database className={styles.headingIcon} aria-hidden />
            What is in it
          </h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Rows</th>
                  <th>Contents</th>
                </tr>
              </thead>
              <tbody>
                {FILES.map((f) => (
                  <tr key={f.name}>
                    <td>
                      <code>{f.name}.ndjson.gz</code>
                    </td>
                    <td>{f.rows}</td>
                    <td>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Join <code>player_achievements</code> to <code>players</code> on{' '}
            <code>username</code>, and to <code>achievements_catalog</code> on{' '}
            <code>achievement_id</code>.
          </p>

          <h2>
            <Clock className={styles.headingIcon} aria-hidden />
            Freshness and caching
          </h2>
          <p>
            The feed rebuilds once a day, at about 04:10 UTC. It is built from the persisted
            database, so an actively-playing pilot&rsquo;s counters can lag the live API by a few
            minutes.
          </p>
          <p>
            Dated paths never change, so they are cached for a year and are safe to store by URL.
            Only <code>manifest.json</code> revalidates, on a five-minute cache. Poll the manifest,
            compare <code>built_at</code>, and download only when it moves.
          </p>
          <p>
            If you need live state — where a ship is right now, an in-progress battle — use the{' '}
            <a href="/docs">API</a>. The feed is deliberately a day behind and will never carry it.
          </p>

          <h2>
            <ShieldCheck className={styles.headingIcon} aria-hidden />
            What we leave out
          </h2>
          <p>
            The feed carries strictly less than the website already shows, never more. We exclude:
          </p>
          <ul>
            <li>
              Pilots who set their profile to hidden, and their achievement rows with them.
            </li>
            <li>
              Live position and online state. A nightly file listing where each pilot last docked
              would be a hunting list, so position stays live-only through the API, where cloaking
              still applies.
            </li>
            <li>
              The name and description of hidden achievements. You get the id and a flag, so the
              feed cannot spoil a discovery.
            </li>
            <li>
              Anything private. No account identifiers, no contact details, no addresses. Those
              never leave our database.
            </li>
          </ul>
          <p>
            Battle summaries are not in v1. There are 326,654 of them and they would be five times
            larger than everything else combined, so we want to know somebody wants them first.
          </p>

          <h2>Terms</h2>
          <p>
            Use it for whatever you like. Attribution is appreciated but not required. There is no
            key, no sign-up, and no rate limit — it is a static file behind a CDN, so hammer it if
            you want.
          </p>
          <p>
            One gotcha: set a <code>User-Agent</code> on your requests. A bare{' '}
            <code>Python-urllib</code> agent is blocked at the edge and will return 403.{' '}
            <code>python-requests</code>, <code>curl</code>, <code>wget</code>, and Go all work as
            they are.
          </p>
          <p>
            Want battle data, a different format, or a shorter rebuild interval? Ask on the{' '}
            <a href="/forum">forum</a> and we will look at it.
          </p>
        </div>
      </div>
    </div>
  )
}
