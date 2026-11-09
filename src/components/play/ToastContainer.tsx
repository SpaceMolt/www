'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AlertTriangle,
  Swords,
  Coins,
  Pickaxe,
  Info,
  X,
} from 'lucide-react'
import { usePlayUi } from './PlayProvider'
import type { EventLogEntry } from '@/lib/spacemolt'
import styles from './ToastContainer.module.css'

const TOAST_DURATION = 4000
const MAX_TOASTS = 3
/** Errors and warnings stay up until the player closes them. */
const isSticky = (entry: EventLogEntry) => entry.kind === 'danger' || entry.kind === 'warning'

const ICON_MAP: Record<string, typeof Info> = {
  danger: AlertTriangle,
  combat: Swords,
  chat: Coins,
  success: Pickaxe,
  info: Info,
  warning: AlertTriangle,
}

const CLASS_MAP: Record<string, string> = {
  danger: styles.toastError,
  combat: styles.toastCombat,
  success: styles.toastMining,
  chat: styles.toastTrade,
  info: styles.toastInfo,
  warning: styles.toastWarning,
}

interface ToastItem {
  id: string
  entry: EventLogEntry
  exiting: boolean
}

export function ToastContainer() {
  const eventLog = usePlayUi((s) => s.eventLog)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // Start at the newest existing entry so a remount does not replay old toasts.
  const lastEventIdRef = useRef(eventLog[0]?.id ?? 0)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  useEffect(() => {
    if (eventLog.length === 0) return
    const lastSeen = lastEventIdRef.current
    lastEventIdRef.current = eventLog[0].id
    // Toast only what needs attention; per-tick mining/crafting/combat stays in the log.
    // Several entries can land between renders, so take every unseen one.
    const fresh = eventLog
      .filter((entry) => entry.id > lastSeen)
      .filter((entry) => entry.toast || entry.kind === 'danger' || entry.kind === 'warning')
      .slice(0, MAX_TOASTS)
    if (fresh.length === 0) return

    setToasts((prev) =>
      [...fresh.map((entry) => ({ id: `toast-${entry.id}`, entry, exiting: false })), ...prev].slice(0, MAX_TOASTS),
    )
    for (const entry of fresh.filter((e) => !isSticky(e))) setTimeout(() => dismissToast(`toast-${entry.id}`), TOAST_DURATION)
  }, [eventLog, dismissToast])

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.entry.kind] || Info
        const colorClass = CLASS_MAP[toast.entry.kind] || ''
        return (
          <div
            key={toast.id}
            className={`${styles.toast} ${colorClass} ${toast.exiting ? styles.exiting : ''}`}
          >
            <Icon size={14} className={styles.toastIcon} />
            <span className={styles.toastMessage}>{toast.entry.text}</span>
            {isSticky(toast.entry) && (
              <button className={styles.closeBtn} onClick={() => dismissToast(toast.id)} title="Dismiss" aria-label="Dismiss" type="button">
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
