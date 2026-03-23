'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pickaxe, Square, Package } from 'lucide-react'
import { useGame } from './GameProvider'
import styles from './MiningModal.module.css'

interface MineLogEntry {
  id: string
  message: string
  type: 'yield' | 'info' | 'error'
  timestamp: number
}

interface MiningModalProps {
  onClose: () => void
}

export function MiningModal({ onClose }: MiningModalProps) {
  const { state, sendCommand } = useGame()
  const [recentLog, setRecentLog] = useState<MineLogEntry[]>([])
  const [totals, setTotals] = useState<Record<string, { name: string; quantity: number }>>({}
  )
  const [mineCount, setMineCount] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  const [mineStartTime, setMineStartTime] = useState(0)
  const [now, setNow] = useState(Date.now())
  const stopRequestedRef = useRef(false)
  const activeRef = useRef(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((message: string, type: MineLogEntry['type']) => {
    const entry: MineLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      message,
      type,
      timestamp: Date.now(),
    }
    setRecentLog(prev => [...prev.slice(-4), entry])
  }, [])

  const addYield = useCallback((resourceId: string, quantity: number) => {
    const name = resourceId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    setTotals(prev => ({
      ...prev,
      [resourceId]: {
        name,
        quantity: (prev[resourceId]?.quantity ?? 0) + quantity,
      },
    }))
    addLog(`+${quantity} ${name}`, 'yield')
  }, [addLog])

  // Tick for progress bar
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(interval)
  }, [isRunning])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [recentLog])

  // Main mining loop
  useEffect(() => {
    if (!activeRef.current) return
    activeRef.current = false // prevent double-run from strict mode

    ;(async () => {
      // Yield to let modal render
      await new Promise(r => setTimeout(r, 0))

      while (!stopRequestedRef.current) {
        const ship = state.ship
        if (ship) {
          const cargoUsed = ship.cargo_used ?? 0
          const cargoCapacity = ship.cargo_capacity ?? 0
          if (cargoCapacity > 0 && cargoUsed >= cargoCapacity) {
            addLog('Cargo hold is full!', 'info')
            break
          }
        }

        setMineStartTime(Date.now())

        try {
          const result = await sendCommand('mine')

          if (!result) {
            addLog('Mine failed — no response', 'error')
            break
          }

          if (result.error || result.code) {
            const msg = (result.message as string) || 'Mining failed'
            if ((result.code as string) === 'cargo_full' || msg.toLowerCase().includes('cargo')) {
              setStatusMessage('Cargo hold is full!')
              break
            }
            if ((result.code as string) === 'no_resources' || msg.toLowerCase().includes('no resource') || msg.toLowerCase().includes('nothing to mine')) {
              setStatusMessage('No resources available to mine')
              break
            }
            addLog(msg, 'error')
            break
          }

          // Parse yield from response
          const quantity = result.quantity as number | undefined
          const resourceId = result.resource_id as string | undefined
          const message = result.message as string | undefined

          if (quantity && resourceId) {
            addYield(resourceId, quantity)
          } else if (message) {
            addLog(message, 'info')
          } else {
            addLog('Mining...', 'info')
          }

          setMineCount(prev => prev + 1)
        } catch (err) {
          addLog(`Error: ${err instanceof Error ? err.message : 'unknown'}`, 'error')
          break
        }

        if (stopRequestedRef.current) break
      }

      setIsRunning(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [stopRequested, setStopRequested] = useState(false)

  const handleStop = useCallback(() => {
    stopRequestedRef.current = true
    setStopRequested(true)
  }, [])

  const ship = state.ship
  const cargoUsed = ship?.cargo_used ?? 0
  const cargoCapacity = ship?.cargo_capacity ?? 0
  const cargoPercent = cargoCapacity > 0 ? Math.min(100, (cargoUsed / cargoCapacity) * 100) : 0

  // Current mine action progress (estimate ~10s per tick)
  const mineElapsed = isRunning && mineStartTime > 0 ? (now - mineStartTime) / 1000 : 0
  const mineProgress = isRunning ? Math.min(100, (mineElapsed / 10) * 100) : 0

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <Pickaxe size={16} className={styles.headerIcon} />
          <span className={styles.title}>
            {isRunning ? 'Mining in Progress' : 'Mining Complete'}
          </span>
          <span className={styles.count}>{mineCount} cycle{mineCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Cargo gauge */}
        <div className={styles.cargoSection}>
          <div className={styles.cargoLabel}>
            <Package size={12} />
            <span>Cargo: {cargoUsed} / {cargoCapacity}</span>
          </div>
          <div className={styles.cargoTrack}>
            <div
              className={`${styles.cargoFill} ${cargoPercent >= 90 ? styles.cargoFillWarning : ''} ${cargoPercent >= 100 ? styles.cargoFillFull : ''}`}
              style={{ width: `${cargoPercent}%` }}
            />
          </div>
        </div>

        {/* Current action progress */}
        {isRunning && (
          <div className={styles.actionProgress}>
            <div className={styles.actionLabel}>Mining...</div>
            <div className={styles.actionTrack}>
              <div className={styles.actionFill} style={{ width: `${mineProgress}%` }} />
            </div>
          </div>
        )}

        {/* Totals */}
        {Object.keys(totals).length > 0 && (
          <div className={styles.totals}>
            <div className={styles.totalsLabel}>Total Mined</div>
            {Object.values(totals).map(({ name, quantity }) => (
              <div key={name} className={styles.totalRow}>
                <span className={styles.totalName}>{name}</span>
                <span className={styles.totalQty}>{quantity}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent activity + status */}
        <div className={styles.log}>
          {recentLog.map(entry => (
            <div key={entry.id} className={`${styles.logEntry} ${styles[`logEntry_${entry.type}`]}`}>
              {entry.message}
            </div>
          ))}
          {statusMessage && (
            <div className={`${styles.logEntry} ${styles.logEntry_info}`}>{statusMessage}</div>
          )}
          <div ref={logEndRef} />
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {isRunning ? (
            <button className={styles.stopBtn} onClick={handleStop} disabled={stopRequested}>
              <Square size={12} />
              {stopRequested ? 'Stopping after current cycle...' : 'Stop Mining'}
            </button>
          ) : (
            <button className={styles.closeBtn} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
