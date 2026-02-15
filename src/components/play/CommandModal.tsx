'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './CommandModal.module.css'

export interface FieldDef {
  name: string
  label: string
  type: 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
}

interface CommandModalProps {
  open: boolean
  onClose: () => void
  title: string
  fields: FieldDef[]
  onSubmit: (values: Record<string, string | number>) => void
}

export function CommandModal({
  open,
  onClose,
  title,
  fields,
  onSubmit,
}: CommandModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const backdropRef = useRef<HTMLDivElement>(null)

  // Reset values when modal opens
  useEffect(() => {
    if (open) {
      const defaults: Record<string, string> = {}
      for (const field of fields) {
        if (field.type === 'select' && field.options && field.options.length > 0) {
          defaults[field.name] = field.options[0].value
        } else {
          defaults[field.name] = ''
        }
      }
      setValues(defaults)
    }
  }, [open, fields])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      const result: Record<string, string | number> = {}
      for (const field of fields) {
        const raw = values[field.name] ?? ''
        if (field.required && raw.trim() === '') return
        if (field.type === 'number') {
          result[field.name] = raw === '' ? 0 : Number(raw)
        } else {
          result[field.name] = raw
        }
      }

      onSubmit(result)
    },
    [fields, values, onSubmit]
  )

  if (!open) return null

  return (
    <div
      className={styles.backdrop}
      ref={backdropRef}
      onClick={handleBackdropClick}
    >
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            {fields.map((field) => (
              <div key={field.name} className={styles.field}>
                <label className={styles.fieldLabel} htmlFor={`cmd-${field.name}`}>
                  {field.label}
                  {field.required && <span className={styles.required}>*</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    id={`cmd-${field.name}`}
                    className={styles.fieldSelect}
                    value={values[field.name] ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`cmd-${field.name}`}
                    className={styles.fieldInput}
                    type={field.type}
                    value={values[field.name] ?? ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
            >
              Execute
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
