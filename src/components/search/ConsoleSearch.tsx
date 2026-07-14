'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { SearchDialog } from './SearchDialog'
import styles from './search.module.css'

/**
 * Owns the single search dialog for the whole console: Cmd-K / Ctrl-K opens it
 * from any page, and every console page also shows the visible field at the top
 * right of the content area — that field is only a trigger for the same dialog,
 * never a second search implementation. (Pages with their own local filter box,
 * like the codex tables, keep it: that filters the list in place, while this
 * searches the whole site.)
 *
 * "/" is deliberately not bound: the console is full of text inputs and a bare
 * slash shortcut would swallow keystrokes in them.
 *
 * The field is hidden on the full-bleed workspace pages, whose own chrome owns
 * that corner: on Recon it sat on top of the system panel's header and hid the
 * system's name. Only the trigger goes away — Cmd-K still opens the dialog
 * there, and those pages have their own local filter box anyway.
 */
const FIELDLESS_ROUTES = new Set(['/intel'])

export function ConsoleSearch() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const showField = !FIELDLESS_ROUTES.has(pathname)
  const [open, setOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Closing the dialog hands focus back to whatever opened it — which, when that
  // was the docs field, would immediately re-fire its focus handler and reopen.
  // The guard covers exactly that one restore.
  const reopenGuard = useRef(false)

  const close = useCallback(() => {
    reopenGuard.current = true
    setOpen(false)
    setTimeout(() => {
      reopenGuard.current = false
    }, 0)
  }, [])

  const openFromField = useCallback(() => {
    if (!reopenGuard.current) setOpen(true)
  }, [])

  return (
    <>
      {showField && (
      <div className={styles.fieldWrap} data-pagefind-ignore>
        <Search size={14} className={styles.fieldIcon} aria-hidden />
        {/* A trigger dressed as a field: the real input lives in the dialog. Its
            own placeholder, because the dialog's is too long for a 320px control
            and clips mid-word. */}
        <input
          type="text"
          readOnly
          className={styles.field}
          placeholder={t('search.fieldPlaceholder')}
          aria-label={t('search.label')}
          aria-haspopup="dialog"
          onClick={openFromField}
          onFocus={openFromField}
        />
        <span className={styles.fieldHint} aria-hidden>
          <kbd className={styles.kbd}>{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd className={styles.kbd}>K</kbd>
        </span>
      </div>
      )}
      <SearchDialog open={open} onClose={close} />
    </>
  )
}
