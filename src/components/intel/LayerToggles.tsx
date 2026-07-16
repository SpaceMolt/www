'use client'

// Floating layer controls for the intel map: fog / intel / trails / agents
// toggles plus the movements window selector.

import { useState } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import type { IntelLayerState } from '@/lib/intelTypes'
import styles from './LayerToggles.module.css'

// Trail windows, in minutes. Jumps are logged to the second and never bucketed,
// so the short end is real data rather than an interpolation.
export const TRAIL_WINDOWS = [
  { minutes: 5, label: '5m' },
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 6 * 60, label: '6h' },
  { minutes: 24 * 60, label: '24h' },
  { minutes: 72 * 60, label: '72h' },
  { minutes: 168 * 60, label: '7d' },
] as const

/** The gameserver caps the movements window at seven days. */
export const TRAIL_WINDOW_MAX_MINUTES = 168 * 60

const LAYER_LABELS: { key: keyof IntelLayerState; label: string }[] = [
  { key: 'fog', label: 'Fog of war' },
  { key: 'intel', label: 'Faction intel' },
  { key: 'names', label: 'System names' },
  { key: 'stations', label: 'Stations + My Outposts' },
  { key: 'trails', label: 'Trails' },
  { key: 'trailFocus', label: 'Focus trails' },
  { key: 'agents', label: 'Agents' },
]

interface LayerTogglesProps {
  layers: IntelLayerState
  onLayersChange: (layers: IntelLayerState) => void
  /** Trail window in minutes. */
  trailsWindow: number
  onTrailsWindowChange: (minutes: number) => void
}

export function LayerToggles({
  layers,
  onLayersChange,
  trailsWindow,
  onTrailsWindowChange,
}: LayerTogglesProps) {
  const [open, setOpen] = useState(false)
  const activeCount = LAYER_LABELS.filter(({ key }) => layers[key]).length

  // The preset list stays the quick path; "Custom" reveals a minutes field for
  // the windows the list doesn't happen to name.
  const isPreset = TRAIL_WINDOWS.some((w) => w.minutes === trailsWindow)
  const [custom, setCustom] = useState(!isPreset)
  const [customDraft, setCustomDraft] = useState(String(trailsWindow))

  function commitCustom(raw: string) {
    setCustomDraft(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 1) return
    onTrailsWindowChange(Math.min(Math.round(parsed), TRAIL_WINDOW_MAX_MINUTES))
  }

  return (
    <div className={styles.panel}>
      <button
        className={styles.title}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="intel-layer-controls"
      >
        <Layers size={12} aria-hidden />
        <span>Layers</span>
        <span className={styles.count}>
          {activeCount}/{LAYER_LABELS.length}
        </span>
        <ChevronDown
          size={12}
          aria-hidden
          className={open ? styles.chevronOpen : styles.chevron}
        />
      </button>

      {open && (
        <div id="intel-layer-controls" className={styles.controls}>
          {LAYER_LABELS.map(({ key, label }) => (
            <label key={key} className={styles.toggle}>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={(e) => onLayersChange({ ...layers, [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
          <div className={styles.windowRow}>
            <span className={styles.windowLabel}>Trail window</span>
            <select
              className={styles.windowSelect}
              value={custom ? 'custom' : trailsWindow}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setCustom(true)
                  setCustomDraft(String(trailsWindow))
                  return
                }
                setCustom(false)
                onTrailsWindowChange(Number(e.target.value))
              }}
              aria-label="Trails time window"
            >
              {TRAIL_WINDOWS.map((w) => (
                <option key={w.minutes} value={w.minutes}>
                  {w.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </div>
          {custom && (
            <div className={styles.windowRow}>
              <span className={styles.windowLabel}>Minutes</span>
              <input
                className={styles.windowInput}
                type="number"
                min={1}
                max={TRAIL_WINDOW_MAX_MINUTES}
                value={customDraft}
                onChange={(e) => commitCustom(e.target.value)}
                aria-label="Trail window in minutes"
              />
            </div>
          )}
          <div className={styles.note}>Cloaked agents update on refresh</div>
        </div>
      )}
    </div>
  )
}
