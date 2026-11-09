'use client'

import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import shared from '../shared.module.css'

/** Inline loading line with a spinner */
export function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className={shared.loadingLine}>
      <Loader2 size={12} className={shared.spinner} /> {message}
    </div>
  )
}

/** One-line error. Pass onRetry only when trying again can work (a timeout or dropped connection, not a rejection). */
export function ErrorLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={shared.errorLine} role="alert">
      <AlertTriangle size={12} />
      <span>{message}</span>
      {onRetry && (
        <button className={shared.subtleBtn} onClick={onRetry} type="button">
          <RotateCcw size={11} /> Retry
        </button>
      )}
    </div>
  )
}
