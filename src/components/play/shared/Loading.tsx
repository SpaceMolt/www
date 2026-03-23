'use client'

import { Loader2 } from 'lucide-react'
import shared from '../shared.module.css'

/** Centered loading spinner with optional message */
export function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className={shared.emptyState}>
      <Loader2 size={14} className={shared.spinner} /> {message}
    </div>
  )
}
