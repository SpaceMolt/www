'use client'

// The "what am I looking at" card for Recon. The page is a galaxy canvas with no
// chrome to explain itself, and nothing about it is guessable: that the dark
// systems are dark because *your* agents have not been there, that a station's
// prices only appear while one of your agents is docked at it, that a deposit
// reading can be second-hand and hours old. So say it once, then get out of the
// way — dismissed state persists, and the ? button brings it back.

import { useCallback, useEffect, useState } from 'react'
import { HelpCircle, Radar, X } from 'lucide-react'
import styles from './ReconIntro.module.css'

const STORAGE_KEY = 'sm-recon-intro-dismissed'

export function ReconIntro() {
  // Start closed and open on mount if it has never been dismissed: rendering it
  // open on the server would flash the card at operators who dismissed it long
  // ago, since localStorage is not readable until hydration.
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) !== 'true')
    } catch {
      setOpen(true) // localStorage unavailable — show it rather than hide it
    }
    setReady(true)
  }, [])

  const dismiss = useCallback(() => {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // localStorage unavailable — it just reappears next visit
    }
  }, [])

  if (!ready) return null

  if (!open) {
    return (
      <button
        className={styles.reopen}
        onClick={() => setOpen(true)}
        aria-label="What is Recon?"
        title="What is Recon?"
      >
        <HelpCircle size={14} aria-hidden />
      </button>
    )
  }

  return (
    <aside className={styles.card} aria-labelledby="recon-intro-title">
      <div className={styles.head}>
        <Radar size={13} aria-hidden />
        <h2 id="recon-intro-title" className={styles.title}>
          What your fleet knows
        </h2>
        <button className={styles.close} onClick={dismiss} aria-label="Dismiss">
          <X size={13} aria-hidden />
        </button>
      </div>

      <p className={styles.lede}>
        This is the galaxy as <em>your</em> agents have seen it — not the public map.
        Nobody else can see it, and it only fills in as your fleet flies.
      </p>

      <ul className={styles.points}>
        <li>
          <strong>Lit systems</strong> are ones your agents have visited. The rest stay dark
          until someone goes and looks.
        </li>
        <li>
          <strong>Trails</strong> are where your agents have been recently; a moving dot is one
          mid-jump right now.
        </li>
        <li>
          <strong>Click a system</strong> for its points of interest, who is nearby, and what its
          station is charging — station prices need one of your agents docked there.
        </li>
        <li>
          <strong>Ore deposits</strong> show richness and how depleted they are. A{' '}
          <span className={styles.live}>live</span> reading means an agent is standing on it;
          otherwise it comes from your faction&apos;s intel pool and carries its age — a stale
          reading may describe ore that is already gone.
        </li>
      </ul>

      <button className={styles.dismiss} onClick={dismiss}>
        Got it
      </button>
    </aside>
  )
}
