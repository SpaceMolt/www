'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import { ACTIONS, type ActionDef, type ActionParam } from '@spacemolt/lib'
import { useAccountStore } from '@/lib/spacemolt'
import styles from './CommandModal.module.css'

interface CommandModalProps {
  open: boolean
  onClose: () => void
}

interface FieldDef {
  name: string
  label: string
  type: 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]
  required: boolean
  placeholder?: string
}

const COMMAND_KEYS = Object.keys(ACTIONS).sort()

function fieldForParam(param: ActionParam): FieldDef {
  if (param.enumValues && param.enumValues.length > 0) {
    return {
      name: param.name,
      label: param.name,
      type: 'select',
      options: param.enumValues.map((value) => ({ value, label: value })),
      required: param.required,
      placeholder: param.description,
    }
  }
  if (param.type === 'boolean') {
    return {
      name: param.name,
      label: param.name,
      type: 'select',
      options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
      required: param.required,
      placeholder: param.description,
    }
  }
  return {
    name: param.name,
    label: param.name,
    type: param.type === 'number' ? 'number' : 'text',
    required: param.required,
    placeholder: param.description,
  }
}

/** Parse a command's typed params into the payload `account.send` expects. */
function buildPayload(params: readonly ActionParam[], values: Record<string, string>): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {}
  for (const param of params) {
    const raw = values[param.name] ?? ''
    if (param.required && raw.trim() === '') return null
    if (raw.trim() === '') continue
    if (param.type === 'number') payload[param.name] = Number(raw)
    else if (param.type === 'boolean') payload[param.name] = raw === 'true'
    else payload[param.name] = raw
  }
  return payload
}

/**
 * Developer console: pick any v2 command from the generated ACTIONS catalog,
 * fill in its params, and run it through `account.send`. Not wired into any
 * panel yet — kept as a generic escape-hatch UI.
 */
export function CommandModal({ open, onClose }: CommandModalProps) {
  const store = useAccountStore()
  const [commandKey, setCommandKey] = useState<string>(COMMAND_KEYS[0] ?? '')
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const actionDef: ActionDef | undefined = ACTIONS[commandKey]
  const fields = useMemo(() => actionDef?.params.map(fieldForParam) ?? [], [actionDef])

  // Reset form state whenever the modal opens or the selected command changes
  useEffect(() => {
    if (!open) return
    const defaults: Record<string, string> = {}
    for (const field of fields) {
      defaults[field.name] = field.type === 'select' && field.options && field.options.length > 0 ? field.options[0].value : ''
    }
    setValues(defaults)
    setError(null)
    setResult(null)
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
      if (e.target === backdropRef.current) onClose()
    },
    [onClose],
  )

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!actionDef) return
      const payload = buildPayload(actionDef.params, values)
      if (!payload) return

      setSubmitting(true)
      setError(null)
      setResult(null)
      try {
        const response = await store.account.send(actionDef.tool, actionDef.action, payload)
        const display = 'delta' in response ? response.delta : (response.structuredContent ?? response.result)
        setResult(JSON.stringify(display, null, 2))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Command failed')
      }
      setSubmitting(false)
    },
    [actionDef, values, store],
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
          <span className={styles.title}>Run Command</span>
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
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="cmd-select">
                Command
              </label>
              <select
                id="cmd-select"
                className={styles.fieldSelect}
                value={commandKey}
                onChange={(e) => setCommandKey(e.target.value)}
              >
                {COMMAND_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
            {actionDef?.summary && <p className={styles.summary}>{actionDef.summary}</p>}

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

            {error && <div className={styles.error}>{error}</div>}
            {result && <pre className={styles.result}>{result}</pre>}
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
              disabled={submitting || !actionDef}
            >
              {submitting ? 'Running…' : 'Execute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
