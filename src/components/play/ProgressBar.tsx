'use client'

import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  value: number
  max: number
  color?: string
  label?: string
  showText?: boolean
  size?: 'sm' | 'md'
}

const COLOR_CLASS_MAP: Record<string, string> = {
  cyan: styles.fillCyan,
  green: styles.fillGreen,
  orange: styles.fillOrange,
  purple: styles.fillPurple,
  blue: styles.fillBlue,
  red: styles.fillRed,
  yellow: styles.fillYellow,
}

export function ProgressBar({
  value,
  max,
  color,
  label,
  showText = true,
  size = 'md',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(value, max))
  const pct = max > 0 ? (clamped / max) * 100 : 0

  let fillClass: string
  if (color && COLOR_CLASS_MAP[color]) {
    fillClass = COLOR_CLASS_MAP[color]
  } else if (pct < 25) {
    fillClass = styles.fillRed
  } else if (pct < 50) {
    fillClass = styles.fillYellow
  } else {
    fillClass = styles.fillCyan
  }

  const trackClass = `${styles.track} ${size === 'sm' ? styles.trackSm : styles.trackMd}`

  return (
    <div className={styles.container}>
      {(label || showText) && (
        <div className={styles.labelRow}>
          {label && <span className={styles.label}>{label}</span>}
          {showText && (
            <span className={styles.valueText}>
              {clamped.toLocaleString()} / {max.toLocaleString()}
            </span>
          )}
        </div>
      )}
      <div className={trackClass}>
        <div
          className={`${styles.fill} ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
