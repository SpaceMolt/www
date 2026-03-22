'use client'

import type { ReactNode } from 'react'
import shared from '../shared.module.css'

interface ConfirmActionProps {
  message: string
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  /** Button style for confirm: 'danger' | 'accent' | 'confirm'. Default: 'danger' */
  variant?: 'danger' | 'accent' | 'confirm'
}

const btnClasses = {
  danger: shared.dangerBtn,
  accent: shared.accentBtn,
  confirm: shared.confirmBtn,
}

export function ConfirmAction({
  message,
  icon,
  onConfirm,
  onCancel,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  confirmDisabled,
  variant = 'danger',
}: ConfirmActionProps) {
  return (
    <div className={shared.confirmOverlay}>
      {icon}
      <span className={shared.confirmText}>{message}</span>
      <button className={btnClasses[variant]} onClick={onConfirm} disabled={confirmDisabled} type="button">
        {confirmLabel}
      </button>
      <button className={shared.subtleBtn} onClick={onCancel} type="button">
        {cancelLabel}
      </button>
    </div>
  )
}
