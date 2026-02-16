'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AlertTriangle,
  Swords,
  Coins,
  Pickaxe,
  Navigation,
  Info,
  Cpu,
} from 'lucide-react'
import { useGame } from './GameProvider'
import type { EventLogEntry } from './types'
import styles from './ToastContainer.module.css'

const TOAST_DURATION = 4000
const MAX_TOASTS = 3

const ICON_MAP: Record<string, typeof Info> = {
  error: AlertTriangle,
  combat: Swords,
  trade: Coins,
  mining: Pickaxe,
  travel: Navigation,
  info: Info,
  warning: AlertTriangle,
  system: Cpu,
  crafting: Pickaxe,
  drone: Cpu,
  base: Cpu,
}

const CLASS_MAP: Record<string, string> = {
  error: styles.toastError,
  combat: styles.toastCombat,
  trade: styles.toastTrade,
  mining: styles.toastMining,
  travel: styles.toastTravel,
  info: styles.toastInfo,
  warning: styles.toastWarning,
  system: styles.toastSystem,
  crafting: styles.toastMining,
  drone: styles.toastSystem,
  base: styles.toastSystem,
}

interface ToastItem {
  id: string
  entry: EventLogEntry
  exiting: boolean
}

export function ToastContainer() {
  const { state } = useGame()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const lastEventIdRef = useRef<string | null>(null)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  useEffect(() => {
    if (state.eventLog.length === 0) return
    const latest = state.eventLog[0]
    if (latest.id === lastEventIdRef.current) return
    lastEventIdRef.current = latest.id

    const toastId = `toast-${latest.id}`
    setToasts((prev) => {
      const next = [{ id: toastId, entry: latest, exiting: false }, ...prev]
      return next.slice(0, MAX_TOASTS)
    })

    setTimeout(() => dismissToast(toastId), TOAST_DURATION)
  }, [state.eventLog, dismissToast])

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.entry.type] || Info
        const colorClass = CLASS_MAP[toast.entry.type] || ''
        return (
          <div
            key={toast.id}
            className={`${styles.toast} ${colorClass} ${toast.exiting ? styles.exiting : ''}`}
          >
            <Icon size={14} className={styles.toastIcon} />
            <span className={styles.toastMessage}>{toast.entry.message}</span>
          </div>
        )
      })}
    </div>
  )
}
