'use client'

import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import shared from '../shared.module.css'

interface ModalProps {
  title: string
  icon?: ReactNode
  onClose: () => void
  /** Optional footer actions */
  actions?: ReactNode
  children: ReactNode
}

export function Modal({ title, icon, onClose, actions, children }: ModalProps) {
  // Escape closes every modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={shared.modalBackdrop} onClick={onClose}>
      <div className={shared.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className={shared.modalHeader}>
          <span className={shared.modalTitle}>
            {icon}
            {title}
          </span>
          <button className={shared.modalClose} onClick={onClose} type="button" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className={shared.modalBody}>
          {children}
        </div>
        {actions && (
          <div className={shared.modalActions}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Confirm step for anything costly, destructive or final (decommission, scrap, sell a ship, leave a faction).
 * Children say what happens, what it costs and what is lost. Cheap undoable steps keep the inline ConfirmAction.
 */
export function ConfirmDialog({ title, confirmLabel, onConfirm, onClose, disabled, children }: {
  title: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Modal
      title={title}
      icon={<AlertTriangle size={14} />}
      onClose={onClose}
      actions={(
        <>
          <button className={shared.subtleBtn} onClick={onClose} type="button">Cancel</button>
          <button className={shared.dangerBtn} onClick={onConfirm} disabled={disabled} type="button">{confirmLabel}</button>
        </>
      )}
    >
      {children}
    </Modal>
  )
}
