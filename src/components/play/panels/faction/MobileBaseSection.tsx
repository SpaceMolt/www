'use client'

import { useCallback, useEffect, useState } from 'react'
import { Move, Rocket, Trash2, X } from 'lucide-react'
import type { FactionInfoResponse } from '@spacemolt/lib'
import { useCommandMutation, useCurrentTick, useMap } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { ActionButton } from '../../ActionButton'
import { shared } from '../../shared'
import styles from '../FactionPanel.module.css'
import {
  LIFECYCLE_LABEL,
  MOBILE_BASE_MAX_RADIUS_AU,
  canManageMobileBase,
  formatTicksLeft,
  mobileBasePosition,
  mobileBaseProgress,
  parseMoveTarget,
} from './mobileBaseControls'

const au = (n: number) => n.toFixed(2)

/**
 * Status and commands for the faction's mobile base: move it within its
 * system, jump it to an adjacent system, cancel a jump in preparation, or
 * decommission it.
 */
export function MobileBaseSection({
  info,
  playerId,
  onChanged,
}: {
  info: FactionInfoResponse
  playerId: string | undefined
  onChanged: () => void
}) {
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const tick = useCurrentTick()
  const { data: map } = useMap()
  const [moveX, setMoveX] = useState('')
  const [moveY, setMoveY] = useState('')
  const [jumpTarget, setJumpTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDecommission, setConfirmDecommission] = useState(false)

  const mb = info.mobile_base
  const progress = mb ? mobileBaseProgress(mb, tick) : null

  // Phase changes such as a move arriving or a jump leaving send no
  // notification, so refresh once the current phase is due to end.
  const phaseDone = Boolean(progress && progress.ticksLeft === 0)
  useEffect(() => {
    if (phaseDone) onChanged()
  }, [phaseDone, onChanged])

  const run = useCallback(
    async (label: string, action: Parameters<typeof mutate>[0]) => {
      setBusy(true)
      try {
        await mutate(action, { label })
        onChanged()
        return true
      } catch (err) {
        uiStore.dispatch({ type: 'toast', kind: 'danger', text: err instanceof Error ? err.message : String(err) })
        return false
      } finally {
        setBusy(false)
      }
    },
    [mutate, onChanged, uiStore],
  )

  if (!mb) {
    if (!info.mobile_base_commission) return null
    return (
      <div className={styles.intelSection}>
        <div className={styles.intelMeta}>
          Mobile base under construction ({info.mobile_base_commission.archetype_id}). It appears here once the shipyard delivers it.
        </div>
      </div>
    )
  }

  const canManage = canManageMobileBase(info, playerId)
  const systemName = (id: string) => map?.system(id)?.name ?? id
  const position = mobileBasePosition(mb, tick)
  const moveTarget = parseMoveTarget(moveX, moveY)
  const neighbors = mb.current_system_id ? (map?.system(mb.current_system_id)?.connections ?? []) : []
  const idle = mb.lifecycle === 'stationary' && !mb.wrecked

  let where = systemName(mb.current_system_id)
  if (mb.lifecycle === 'jumping') where = `${systemName(mb.origin.system_id)} → ${systemName(mb.destination.system_id)}`
  else if (mb.lifecycle === 'jump_preparing') where += ` → ${systemName(mb.destination.system_id)}`

  return (
    <div className={styles.intelSection}>
      <div className={styles.factionHeader}>
        <div className={styles.factionName}>{mb.name}</div>
        <span className={`${shared.badge} ${mb.wrecked ? shared.badgeRed : mb.lifecycle === 'stationary' ? shared.badgeGreen : shared.badgeCyan}`}>
          {mb.wrecked ? 'Wrecked' : LIFECYCLE_LABEL[mb.lifecycle]}
        </span>
      </div>
      <div className={styles.factionMeta}>
        <span className={styles.metaTag}>
          Location: <span className={styles.metaValue}>{where}</span>
        </span>
        {mb.lifecycle !== 'jumping' && (
          <span className={styles.metaTag}>
            Position: <span className={styles.metaValue}>{au(position.x)}, {au(position.y)} AU</span>
          </span>
        )}
        {mb.lifecycle === 'in_system_transit' && (
          <span className={styles.metaTag}>
            Heading to: <span className={styles.metaValue}>{au(mb.destination.position.x)}, {au(mb.destination.position.y)} AU</span>
          </span>
        )}
        {progress && (
          <span className={styles.metaTag}>
            {mb.lifecycle === 'jump_preparing' ? 'Departs' : 'Arrives'}:{' '}
            <span className={styles.metaValue}>
              {formatTicksLeft(progress.ticksLeft)} ({Math.round(progress.fraction * 100)}%)
            </span>
          </span>
        )}
      </div>
      {mb.lifecycle === 'jumping' && (
        <div className={styles.intelMeta}>
          In hyperspace: the station cannot be reached, and pilots aboard ride along until it arrives.
        </div>
      )}

      {canManage && idle && (
        <>
          <div className={styles.label}>Move within system (max {MOBILE_BASE_MAX_RADIUS_AU} AU from center)</div>
          <div className={styles.intelQueryRow}>
            <input className={styles.input} type="number" step="0.1" placeholder="x AU" value={moveX} onChange={(e) => setMoveX(e.target.value)} aria-label="Target x in AU" />
            <input className={styles.input} type="number" step="0.1" placeholder="y AU" value={moveY} onChange={(e) => setMoveY(e.target.value)} aria-label="Target y in AU" />
            <ActionButton
              label="Move"
              icon={<Move size={12} />}
              size="sm"
              disabled={busy || !moveTarget}
              onClick={async () => {
                if (!moveTarget) return
                if (await run('move_mobile_base', (c) => c.spacemolt_faction.move_mobile_base(moveTarget))) {
                  setMoveX('')
                  setMoveY('')
                }
              }}
            />
          </div>
          <div className={styles.label}>Jump to adjacent system (uses the archetype&apos;s jump resource from faction storage)</div>
          <div className={styles.intelQueryRow}>
            <select className={styles.select} value={jumpTarget} onChange={(e) => setJumpTarget(e.target.value)} aria-label="Jump destination">
              <option value="">Select destination</option>
              {neighbors.map((id) => (
                <option key={id} value={id}>
                  {systemName(id)}
                </option>
              ))}
            </select>
            <ActionButton
              label="Jump"
              icon={<Rocket size={12} />}
              size="sm"
              disabled={busy || !jumpTarget}
              onClick={async () => {
                if (await run('jump_mobile_base', (c) => c.spacemolt_faction.jump_mobile_base({ id: jumpTarget }))) setJumpTarget('')
              }}
            />
          </div>
        </>
      )}

      {canManage && mb.lifecycle === 'jump_preparing' && (
        <ActionButton
          label="Cancel jump"
          icon={<X size={12} />}
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => run('cancel_mobile_base_jump', (c) => c.spacemolt_faction.cancel_mobile_base_jump())}
        />
      )}

      {canManage && idle && (
        <div className={styles.formActions}>
          {confirmDecommission ? (
            <>
              <span className={styles.intelMeta}>Permanently remove this station? It must be empty.</span>
              <ActionButton
                label="Decommission"
                icon={<Trash2 size={12} />}
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  await run('decommission_mobile_base', (c) => c.spacemolt_faction.decommission_mobile_base())
                  setConfirmDecommission(false)
                }}
              />
              <ActionButton label="Keep" size="sm" variant="secondary" onClick={() => setConfirmDecommission(false)} />
            </>
          ) : (
            <ActionButton label="Decommission" icon={<Trash2 size={12} />} size="sm" variant="secondary" onClick={() => setConfirmDecommission(true)} />
          )}
        </div>
      )}
    </div>
  )
}
