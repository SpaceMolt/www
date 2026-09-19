'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useBattleData } from '@/lib/battle/useBattleData'
import { getCinemaEligibility } from '@/lib/cinema/director'
import type { CinemaFilm } from '@/lib/cinema/types'
import type { ShipAppearanceMap } from '@/lib/cinema/appearance'
import type { HardwareCatalog } from '@/lib/cinema/hardware'
import CinemaPlayer from './CinemaPlayer'
import styles from './Cinema.module.css'

export default function CinemaExperience({ battleId, appearances, hardwareCatalog }: { battleId: string; appearances: ShipAppearanceMap; hardwareCatalog: HardwareCatalog }) {
  const { t } = useTranslation()
  const data = useBattleData(battleId)
  const eligibility = getCinemaEligibility(data.summary, data.entries, data.phase)
  const [film, setFilm] = useState<CinemaFilm | null>(null)
  const [compileError, setCompileError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (eligibility !== 'ready' || !data.summary) return
    setFilm(null)
    setCompileError(false)
    let worker: Worker | null = null
    let disposed = false
    // Compilation never blocks the page, including long records with thousands
    // of ticks. The worker is terminated on navigation, retry, and completion.
    try {
      worker = new Worker(new URL('../../lib/cinema/director.worker.ts', import.meta.url))
      worker.onmessage = (event: MessageEvent<{ film?: CinemaFilm; error?: string }>) => {
        if (disposed) return
        if (event.data.film) setFilm(event.data.film)
        else setCompileError(true)
        worker?.terminate()
      }
      worker.onerror = () => {
        if (!disposed) setCompileError(true)
        worker?.terminate()
      }
      worker.postMessage({ summary: data.summary, entries: data.entries, reconciled: true, hardwareCatalog })
    } catch {
      setCompileError(true)
    }
    return () => { disposed = true; worker?.terminate() }
  }, [eligibility, data.summary, data.entries, attempt, hardwareCatalog])

  if (film && eligibility === 'ready') {
    return <CinemaPlayer film={film} appearances={appearances} />
  }

  const pending = !compileError && (eligibility === 'loading' || eligibility === 'finalizing' || eligibility === 'ready')
  const state = compileError ? 'unavailable' : eligibility === 'ready' ? 'preparing' : eligibility
  return (
    <main className={styles.shell}>
      <div className={styles.waitBackdrop} aria-hidden="true" />
      <header className={styles.header}>
        <Link href={`/battles/${encodeURIComponent(battleId)}`} className={styles.back}><ArrowLeft size={16} aria-hidden />{t('cinema.record')}</Link>
        <span className={styles.wordmark}>SpaceMolt <span>/</span> {t('cinema.cinema')}</span>
      </header>
      <section className={styles.state} aria-live="polite">
        {pending && <div className={styles.loadingMark} aria-hidden="true"><span /><span /><span /></div>}
        <p className={styles.eyebrow}>{t('cinema.series')}</p>
        <h1>{t(`cinema.state.${state}`)}</h1>
        <p className={styles.description}>{t(`cinema.state.${state}Detail`)}</p>
        {!pending && state === 'unavailable' && <button type="button" className={styles.secondary} onClick={() => { setAttempt(value => value + 1); data.retry() }} disabled={data.refreshing}><RotateCcw size={15} aria-hidden />{t('cinema.retry')}</button>}
        {!pending && state !== 'unavailable' && <Link className={styles.secondary} href={`/battles/${encodeURIComponent(battleId)}`}>{t('cinema.record')}</Link>}
      </section>
      <p className={styles.waitFooter}>{t('cinema.inspired')}</p>
    </main>
  )
}
