'use client'

import type { ReactNode } from 'react'
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
  return (
    <div className={shared.modalBackdrop} onClick={onClose}>
      <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
        <div className={shared.modalHeader}>
          <span className={shared.modalTitle}>
            {icon}
            {title}
          </span>
          <button className={shared.modalClose} onClick={onClose} type="button">
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
