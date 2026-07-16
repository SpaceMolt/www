'use client'

import { useState, useCallback, useMemo } from 'react'
import { Bug, Loader2 } from 'lucide-react'
import type { GameState } from '@spacemolt/lib'
import { useAccountStore, useCargo, useLocationState, useModules, usePlayer, useShip, useSkills } from '@/lib/spacemolt'
import { Modal, shared } from './shared'
import { titleCase } from '@/lib/format'
import styles from './BugReportModal.module.css'

interface BugReportModalProps {
  title: string
  entityContext: string
  onClose: () => void
}

/** Same section shape as the state cache — built from the live game-state hooks, not a snapshot. */
function buildGenericContext(sections: {
  player: GameState['player']
  location: GameState['location']
  ship: GameState['ship']
  cargo: GameState['cargo']
  modules: GameState['modules']
  skills: GameState['skills']
}): string {
  const { player, location, ship, cargo, modules, skills } = sections
  const lines: string[] = []

  if (player) {
    lines.push('### Player')
    lines.push(`- **Name:** ${player.username ?? 'unknown'}`)
    lines.push(`- **ID:** \`${player.id ?? 'unknown'}\``)
    lines.push(`- **Empire:** ${player.empire || 'none'}`)
    lines.push(`- **Faction:** ${player.faction_id || 'none'}`)
    lines.push(`- **Credits:** ${(player.credits ?? 0).toLocaleString()}`)
  }

  lines.push('')
  lines.push('### Location')
  lines.push(`- **System:** ${location?.system_name || 'unknown'}`)
  lines.push(`- **POI:** ${location?.poi_name || 'unknown'}`)
  lines.push(`- **Docked:** ${location?.docked_at ? 'yes' : 'no'}`)

  if (ship) {
    lines.push('')
    lines.push('### Ship')
    lines.push(`- **Name:** ${ship.name ?? 'unknown'}`)
    lines.push(`- **Class:** ${ship.class_id || 'unknown'}`)
    lines.push(`- **Hull:** ${ship.hull ?? 0}/${ship.max_hull ?? 0}`)
    lines.push(`- **Shield:** ${ship.shield ?? 0}/${ship.max_shield ?? 0}`)
    lines.push(`- **Fuel:** ${ship.fuel ?? 0}/${ship.max_fuel ?? 0}`)
    lines.push(`- **Cargo:** ${ship.cargo_used ?? 0}/${ship.cargo_capacity ?? 0}`)
    lines.push(`- **Speed:** ${ship.speed ?? 0}`)

    if (cargo && cargo.length > 0) {
      lines.push('')
      lines.push('### Cargo')
      for (const item of cargo) {
        lines.push(`- ${item.item_name || titleCase(item.item_id ?? 'unknown')} x${item.quantity ?? 0}`)
      }
    }
  }

  if (modules && modules.length > 0) {
    lines.push('')
    lines.push('### Modules')
    for (const m of modules) {
      lines.push(`- ${m.name ?? 'unknown'} (${m.type ?? 'unknown'}) — ${m.type_id ?? 'unknown'}`)
    }
  }

  if (skills) {
    const entries = Object.entries(skills)
    if (entries.length > 0) {
      lines.push('')
      lines.push('### Skills')
      for (const [id, info] of entries) {
        lines.push(`- ${titleCase(id)}: Lv${info.level ?? 0}`)
      }
    }
  }

  return lines.join('\n')
}

export function BugReportModal({ title, entityContext, onClose }: BugReportModalProps) {
  const store = useAccountStore()
  const player = usePlayer()
  const location = useLocationState()
  const ship = useShip()
  const cargo = useCargo()
  const modules = useModules()
  const skills = useSkills()
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const genericContext = useMemo(
    () => buildGenericContext({ player, location, ship, cargo, modules, skills }),
    [player, location, ship, cargo, modules, skills],
  )
  const fullContext = entityContext
    ? `${entityContext}\n\n${genericContext}`
    : genericContext

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const body = `## Player Description\n\n${description.trim()}\n\n## Context\n\n${fullContext}`
      // Not yet in the generated Commands facade (needs a gameserver deploy) —
      // wired through the untyped query escape hatch ahead of that deploy.
      await store.account.query('spacemolt_social', 'bugreport', { title, body })
      setSubmitted(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report')
    }
    setSubmitting(false)
  }, [store, description, fullContext, title, onClose])

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
