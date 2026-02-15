'use client'

import type { ReactNode } from 'react'
import styles from './ActionButton.module.css'

interface ActionButtonProps {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'danger' | 'secondary'
  loading?: boolean
  size?: 'sm' | 'md'
}

const VARIANT_CLASS: Record<string, string> = {
  primary: styles.primary,
  danger: styles.danger,
  secondary: styles.secondary,
}

export function ActionButton({
  label,
  icon,
  onClick,
  disabled = false,
  variant = 'primary',
  loading = false,
  size = 'md',
}: ActionButtonProps) {
  const sizeClass = size === 'sm' ? styles.sizeSm : styles.sizeMd
  const variantClass = VARIANT_CLASS[variant] || styles.primary

  return (
    <button
      className={`${styles.button} ${variantClass} ${sizeClass}`}
      onClick={onClick}
      disabled={disabled || loading}
      type="button"
    >
      {loading ? (
        <span className={styles.spinner} />
      ) : icon ? (
        <span className={styles.icon}>{icon}</span>
      ) : null}
      {label}
    </button>
  )
}
