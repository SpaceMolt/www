'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
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
