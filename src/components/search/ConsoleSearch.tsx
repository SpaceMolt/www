'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { SearchDialog } from './SearchDialog'
import styles from './search.module.css'

/**
 * Owns the single search dialog for the whole console: Cmd-K / Ctrl-K opens it
 * from any page, and on /docs a visible field is shown as well — that field is
 * only a trigger for the same dialog, never a second search implementation.
 *
 * "/" is deliberately not bound: the console is full of text inputs and a bare
 * slash shortcut would swallow keystrokes in them.
 */
export function ConsoleSearch() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)

  const showField = pathname.startsWith('/docs')

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
          {/* A trigger dressed as a field: the real input lives in the dialog. */}
          <input
            type="text"
            readOnly
            className={styles.field}
            placeholder={t('search.placeholder')}
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
