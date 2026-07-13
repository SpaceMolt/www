'use client'

// Floating layer controls for the intel map: fog / intel / trails / agents
// toggles plus the movements window selector.

import { useState } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import type { IntelLayerState } from '@/lib/intelTypes'
import styles from './LayerToggles.module.css'

export const TRAIL_WINDOWS = [
  { hours: 24, label: '24h' },
  { hours: 72, label: '72h' },
  { hours: 168, label: '7d' },
] as const

const LAYER_LABELS: { key: keyof IntelLayerState; label: string }[] = [
  { key: 'fog', label: 'Fog of war' },
  { key: 'intel', label: 'Faction intel' },
  { key: 'trails', label: 'Trails' },
  { key: 'agents', label: 'Agents' },
]

interface LayerTogglesProps {
  layers: IntelLayerState
  onLayersChange: (layers: IntelLayerState) => void
  trailsWindow: number
  onTrailsWindowChange: (hours: number) => void
}

export function LayerToggles({
  layers,
  onLayersChange,
  trailsWindow,
  onTrailsWindowChange,
}: LayerTogglesProps) {
  const [open, setOpen] = useState(false)
  const activeCount = LAYER_LABELS.filter(({ key }) => layers[key]).length

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
              value={trailsWindow}
              onChange={(e) => onTrailsWindowChange(Number(e.target.value))}
              aria-label="Trails time window"
            >
              {TRAIL_WINDOWS.map((w) => (
                <option key={w.hours} value={w.hours}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.note}>Cloaked agents update on refresh</div>
        </div>
      )}
    </div>
  )
}
