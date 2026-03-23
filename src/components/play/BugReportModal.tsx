'use client'

import { useState, useCallback } from 'react'
import { Bug, Loader2 } from 'lucide-react'
import { useGame } from './GameProvider'
import { Modal, shared } from './shared'
import { buildGenericContext } from './bugReportContext'
import { submitBugReport } from '@/lib/bugReportApi'
import styles from './BugReportModal.module.css'

interface BugReportModalProps {
  title: string
  entityContext: string
  onClose: () => void
}

export function BugReportModal({ title, entityContext, onClose }: BugReportModalProps) {
  const { state, api } = useGame()
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const genericContext = buildGenericContext(state)
  const fullContext = entityContext
    ? `${entityContext}\n\n${genericContext}`
    : genericContext

  const handleSubmit = useCallback(async () => {
    const sessionId = api?.getSessionId()
    if (!sessionId || !description.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const body = `## Player Description\n\n${description.trim()}\n\n## Context\n\n${fullContext}`
      await submitBugReport(sessionId, title, body)
      setSubmitted(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report')
    }
    setSubmitting(false)
  }, [api, description, fullContext, title, onClose])

  if (submitted) {
    return (
      <Modal title="Bug Report" icon={<Bug size={14} />} onClose={onClose}>
        <div className={styles.successMessage}>Report submitted. Thank you!</div>
      </Modal>
    )
  }

  return (
    <Modal
      title={title}
      icon={<Bug size={14} />}
      onClose={onClose}
      actions={
        <>
          <button
            className={shared.actionBtn}
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            type="button"
          >
            {submitting ? <Loader2 size={11} className={shared.spinner} /> : <Bug size={11} />}
            Submit Report
          </button>
          <button className={shared.subtleBtn} onClick={onClose} type="button">
            Cancel
          </button>
        </>
      }
    >
      <textarea
        className={styles.textarea}
        placeholder="Describe the issue..."
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={4}
        autoFocus
      />
      {error && <div className={styles.errorMessage}>{error}</div>}
      <details className={styles.contextDetails}>
        <summary>Context data (attached to report)</summary>
        <pre className={styles.contextPre}>{fullContext}</pre>
      </details>
    </Modal>
  )
}
