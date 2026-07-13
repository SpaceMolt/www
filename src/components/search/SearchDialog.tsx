'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, CornerDownLeft } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { saveConsoleScrollNow } from '@/components/console/useScrollRestoration'
import {
  loadPagefind,
  resultUrlToHref,
  sectionForHref,
  SECTION_ORDER,
  type SearchSection,
} from './pagefind'
import styles from './search.module.css'

const DEBOUNCE_MS = 140
const MAX_RESULTS = 20

interface Hit {
  id: string
  href: string
  title: string
  excerpt: string
  section: SearchSection
}

type Status = 'idle' | 'loading' | 'ready' | 'unavailable'

interface SearchDialogProps {
  open: boolean
  onClose: () => void
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const router = useRouter()
  const { t } = useTranslation()

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [active, setActive] = useState(0)

  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Captured on open, restored on close: keyboard users must land back where
  // they were (the Cmd-K opener is often the docs field, sometimes nothing).
  const openerRef = useRef<HTMLElement | null>(null)

  // Escape closes, the page behind stops scrolling, and focus goes to the input.
  // (#console-main is the scroll container here, not the window — locking body
  // overflow alone would not hold it still.)
  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement as HTMLElement | null
    inputRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    const main = document.getElementById('console-main')
    const prevMain = main?.style.overflow ?? ''
    const prevBody = document.body.style.overflow
    if (main) main.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (main) main.style.overflow = prevMain
      document.body.style.overflow = prevBody
      openerRef.current?.focus?.()
    }
  }, [open, onClose])

  // Reset between openings — a stale result list flashing behind a fresh query
  // reads as a bug.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHits([])
      setActive(0)
      setStatus('idle')
    }
  }, [open])

  // Debounced query. Pagefind loads on the first keystroke of the first open,
  // so users who never search download none of it.
  useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (term === '') {
      setHits([])
      setStatus((s) => (s === 'unavailable' ? s : 'idle'))
      return
    }

    let cancelled = false
    setStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const pagefind = await loadPagefind()
        const search = await pagefind.search(term)
        const data = await Promise.all(search.results.slice(0, MAX_RESULTS).map((r) => r.data()))
        if (cancelled) return
        setHits(
          data.map((d, i) => {
            const href = resultUrlToHref(d.url)
            return {
              id: `${href}-${i}`,
              href,
              title: d.meta.title || href,
              excerpt: d.excerpt,
              section: sectionForHref(href),
            }
          })
        )
        setActive(0)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('unavailable')
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open])

  // Grouped for display, flat for keyboard navigation — the arrow keys walk the
  // same order the eye does.
  const groups = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      section,
      hits: hits.filter((h) => h.section === section),
    })).filter((g) => g.hits.length > 0)
  }, [hits])

  const ordered = useMemo(() => groups.flatMap((g) => g.hits), [groups])

  const go = useCallback(
    (href: string) => {
      // Enter on a result pushes the route directly, raising no anchor click for
      // console scroll restoration to notice — so the page behind the dialog has
      // to bank its offset here or the router's teardown scroll overwrites it.
      // (Clicking a result is a real anchor click and is already covered.)
      saveConsoleScrollNow()
      onClose()
      router.push(href)
    },
    [onClose, router]
  )

  const onDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (ordered.length === 0) return
      e.preventDefault()
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1
        return (next + ordered.length) % ordered.length
      })
      return
    }
    if (e.key === 'Enter') {
      const hit = ordered[active]
      if (hit) {
        e.preventDefault()
        go(hit.href)
      }
      return
    }
    if (e.key !== 'Tab') return

    // Focus trap: the dialog is modal, so Tab must cycle inside it.
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = dialog.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // Keep the arrow-key selection inside the scrollable result list.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, hits])

  if (!open) return null

  const term = query.trim()

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('search.label')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
      >
        <div className={styles.inputRow}>
          <Search size={16} className={styles.inputIcon} aria-hidden />
          {/* Combobox pattern: the input keeps focus while the arrow keys walk the
              list, so the active result is announced via aria-activedescendant
              rather than by moving focus. */}
          <input
            ref={inputRef}
            className={styles.input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.label')}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={ordered.length > 0}
            aria-controls="search-results"
            aria-activedescendant={ordered[active] ? `search-hit-${active}` : undefined}
          />
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('search.close')}>
            <X size={15} />
          </button>
        </div>

        <div
          className={styles.results}
          ref={listRef}
          id="search-results"
          role="listbox"
          aria-label={t('search.label')}
        >
          {status === 'unavailable' && (
            <p className={styles.note}>{t('search.unavailable')}</p>
          )}

          {status !== 'unavailable' && term === '' && (
            <p className={styles.note}>{t('search.hint')}</p>
          )}

          {status === 'loading' && term !== '' && (
            <p className={styles.note}>{t('search.searching')}</p>
          )}

          {status === 'ready' && term !== '' && ordered.length === 0 && (
            <p className={styles.note}>{t('search.empty', { query: term })}</p>
          )}

          {ordered.length > 0 &&
            groups.map((group) => (
              <div key={group.section} className={styles.group} role="group" aria-label={group.section}>
                {/* aria-hidden: the group already carries this name, so announcing
                    the heading again would just double it up. */}
                <div className={styles.groupLabel} aria-hidden>{group.section}</div>
                {group.hits.map((hit) => {
                  const index = ordered.findIndex((h) => h.id === hit.id)
                  const isActive = index === active
                  return (
                    <Link
                      key={hit.id}
                      href={hit.href}
                      id={`search-hit-${index}`}
                      role="option"
                      aria-selected={isActive}
                      className={`${styles.hit} ${isActive ? styles.hitActive : ''}`}
                      data-active={isActive}
                      onMouseEnter={() => setActive(index)}
                      // A real anchor, so middle-click and Cmd-click open a new tab.
                      // Those must leave the dialog alone; only a plain click closes it.
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                        onClose()
                      }}
                    >
                      <span className={styles.hitTitle}>{hit.title}</span>
                      {/* Pagefind hands back the excerpt with <mark> around the hits. */}
                      <span
                        className={styles.hitExcerpt}
                        dangerouslySetInnerHTML={{ __html: hit.excerpt }}
                      />
                      <span className={styles.hitPath}>{hit.href}</span>
                      {isActive && <CornerDownLeft size={13} className={styles.hitEnter} aria-hidden />}
                    </Link>
                  )
                })}
              </div>
            ))}
        </div>

        <div className={styles.footer}>
          <span><kbd className={styles.kbd}>&uarr;</kbd><kbd className={styles.kbd}>&darr;</kbd> {t('search.footerMove')}</span>
          <span><kbd className={styles.kbd}>&crarr;</kbd> {t('search.footerOpen')}</span>
          <span><kbd className={styles.kbd}>Esc</kbd> {t('search.footerClose')}</span>
        </div>
      </div>
    </div>
  )
}
