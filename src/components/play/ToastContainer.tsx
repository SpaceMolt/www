'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AlertTriangle,
  Swords,
  Coins,
  Pickaxe,
  Info,
  Cpu,
} from 'lucide-react'
import { usePlayUi } from './PlayProvider'
import type { EventLogEntry } from '@/lib/spacemolt'
import styles from './ToastContainer.module.css'

const TOAST_DURATION = 4000
const MAX_TOASTS = 3

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
  const lastEventIdRef = useRef<number | null>(null)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  useEffect(() => {
    if (eventLog.length === 0) return
    const latest = eventLog[0]
    if (latest.id === lastEventIdRef.current) return
    lastEventIdRef.current = latest.id

    // Only surface urgent events as toasts
    if (latest.kind !== 'danger') return

    const toastId = `toast-${latest.id}`
    setToasts((prev) => {
      const next = [{ id: toastId, entry: latest, exiting: false }, ...prev]
      return next.slice(0, MAX_TOASTS)
    })

    setTimeout(() => dismissToast(toastId), TOAST_DURATION)
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
          </div>
        )
      })}
    </div>
  )
}
