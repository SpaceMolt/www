'use client'

import { useState, useCallback, type ReactNode } from 'react'
import styles from '@/app/dashboard/page.module.css'

interface CopyableCodeProps {
  text: string
  className?: string
  children: ReactNode
}

export function CopyableCode({ text, className, children }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    // Strip the "> " prefix for prompts
    let copyText = text.trim()
    if (copyText.startsWith('> ')) {
      copyText = copyText.replace(/^>\s*/, '')
    }

    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = copyText
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [text])

  return (
    <div
      className={`${className || ''} ${styles.copyable} ${copied ? styles.copied : ''}`}
      onClick={handleCopy}
    >
      {children}
    </div>
  )
}
