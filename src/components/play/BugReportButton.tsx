'use client'

import { useState, useCallback } from 'react'
import { Bug } from 'lucide-react'
import { BugReportModal } from './BugReportModal'
import { shared } from './shared'

interface BugReportButtonProps {
  contextType: 'mission' | 'ship' | 'facility' | 'recipe' | 'generic'
  entityName?: string
  entityContext?: string
  className?: string
}

export function BugReportButton({ contextType, entityName, entityContext, className }: BugReportButtonProps) {
  const [open, setOpen] = useState(false)

  const title = entityName
    ? `Bug: ${contextType} "${entityName}"`
    : 'Bug Report'

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(true)
  }, [])

  return (
    <>
      <button
        className={className || shared.iconBtn}
        onClick={handleClick}
        title="Report a bug"
        type="button"
      >
        <Bug size={11} />
      </button>
      {open && (
        <BugReportModal
          title={title}
          entityContext={entityContext || ''}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
