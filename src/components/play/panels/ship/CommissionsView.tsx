'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Hammer,
  RefreshCw,
  Coins,
  Clock,
  Package,
  Check,
  X,
  AlertTriangle,
  MapPin,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { ActionButton } from '../../ActionButton'
import styles from './CommissionsView.module.css'

interface BuildMaterial {
  item_id: string
  name: string
  quantity: number
}

interface CommissionQuote {
  ship_class: string
  ship_name: string
  material_cost: number
  labor_cost: number
  credits_only_total: number
  build_time: number
  build_materials: BuildMaterial[]
  can_commission: boolean
  can_afford_credits_only: boolean
  can_afford_provide_materials: boolean
}

interface MaterialProgress {
  item_id: string
  name: string
  have: number
  need: number
}

interface Commission {
  commission_id: string
  ship_class_id: string
  status: string
  ship_name: string
  base_name: string
  ticks_remaining: number
  built_ship_id?: string
  materials_gathered?: MaterialProgress[]
  required_materials?: BuildMaterial[]
}

interface CommissionsStatus {
  commissions: Commission[]
}

export function CommissionsView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked

  const [shipClass, setShipClass] = useState('')
  const [quote, setQuote] = useState<CommissionQuote | null>(null)
  const [commissions, setCommissions] = useState<CommissionsStatus | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingCommission, setLoadingCommission] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)

  // Track event log length to detect new responses
  const lastEventLenRef = useRef(state.eventLog.length)

  // Watch event log for responses to our commands
  useEffect(() => {
    if (state.eventLog.length <= lastEventLenRef.current) {
      lastEventLenRef.current = state.eventLog.length
      return
    }

    // Check new events for our action responses
    const newCount = state.eventLog.length - lastEventLenRef.current
    lastEventLenRef.current = state.eventLog.length

    for (let i = 0; i < newCount; i++) {
      const entry = state.eventLog[i]
      if (!entry) continue

      const data = entry.data as Record<string, unknown> | undefined
      if (!data) continue

      if (data.action === 'commission_quote' && data.ship_class) {
        setQuote(data as unknown as CommissionQuote)
        setLoadingQuote(false)
      }
      if (data.action === 'commission_status' && data.commissions) {
        setCommissions(data as unknown as CommissionsStatus)
        setLoadingStatus(false)
      }
      if (data.action === 'commission_ship') {
        setLoadingCommission(false)
        setQuote(null)
        // Auto-refresh status
        sendCommand('commission_status')
      }
      if (data.action === 'claim_commission' || data.action === 'cancel_commission') {
        setCancelConfirm(null)
        // Auto-refresh status
        sendCommand('commission_status')
      }
    }
  }, [state.eventLog, sendCommand])

  const handleGetQuote = useCallback(() => {
    if (!shipClass.trim()) return
    setLoadingQuote(true)
    setQuote(null)
    sendCommand('commission_quote', { ship_class: shipClass.trim() })
    // Timeout loading state in case server doesn't respond with expected format
    setTimeout(() => setLoadingQuote(false), 5000)
  }, [shipClass, sendCommand])

  const handleCommission = useCallback(
    (provideMaterials: boolean) => {
      if (!quote) return
      setLoadingCommission(true)
      sendCommand('commission_ship', {
        ship_class: quote.ship_class,
        provide_materials: provideMaterials,
      })
      setTimeout(() => setLoadingCommission(false), 5000)
    },
    [quote, sendCommand]
  )

  const handleCheckStatus = useCallback(() => {
    setLoadingStatus(true)
    sendCommand('commission_status')
    setTimeout(() => setLoadingStatus(false), 5000)
  }, [sendCommand])

  const handleClaim = useCallback(
    (commissionId: string) => {
      sendCommand('claim_commission', { commission_id: commissionId })
    },
    [sendCommand]
  )

  const handleCancel = useCallback(
    (commissionId: string) => {
      sendCommand('cancel_commission', { commission_id: commissionId })
      setCancelConfirm(null)
    },
    [sendCommand]
  )

  if (!isDocked) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Hammer size={16} />
            </span>
            Commissions
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.dockedOnly}>
            <Hammer size={16} style={{ marginBottom: '0.25rem', opacity: 0.6 }} />
            <br />
            Dock at a shipyard to commission ships
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Hammer size={16} />
          </span>
          Commissions
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleCheckStatus}
            title="Refresh commissions"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Get Quote section */}
        <span className={styles.sectionTitle}>Request Build Quote</span>
        <div className={styles.quoteForm}>
          <div className={styles.quoteFormRow}>
            <span className={styles.inputLabel}>Ship Class</span>
            <input
              className={styles.textInput}
              type="text"
              value={shipClass}
              onChange={(e) => setShipClass(e.target.value)}
              placeholder="e.g. viper_mk2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGetQuote()
              }}
            />
          </div>
          <ActionButton
            label="Get Quote"
            icon={<Coins size={12} />}
            onClick={handleGetQuote}
            disabled={!shipClass.trim()}
            loading={loadingQuote}
            size="sm"
          />
        </div>

        {/* Quote result */}
        {quote && (
          <div className={styles.quoteCard}>
            <div className={styles.quoteHeader}>
              <div>
                <span className={styles.quoteShipName}>{quote.ship_name}</span>
                <br />
                <span className={styles.quoteShipClass}>{quote.ship_class}</span>
              </div>
            </div>

            <div className={styles.quoteDetails}>
              <div className={styles.quoteStat}>
                <span className={styles.quoteStatIcon}><Coins size={10} /></span>
                <span className={styles.quoteStatLabel}>Credits Only</span>
                <span className={styles.quoteStatValueCredits}>
                  {quote.credits_only_total.toLocaleString()} cr
                </span>
              </div>
              <div className={styles.quoteStat}>
                <span className={styles.quoteStatIcon}><Coins size={10} /></span>
                <span className={styles.quoteStatLabel}>Labor</span>
                <span className={styles.quoteStatValueCredits}>
                  {quote.labor_cost.toLocaleString()} cr
                </span>
              </div>
              <div className={styles.quoteStat}>
                <span className={styles.quoteStatIcon}><Clock size={10} /></span>
                <span className={styles.quoteStatLabel}>Build Time</span>
                <span className={styles.quoteStatValue}>
                  {quote.build_time} ticks
                </span>
              </div>
            </div>

            {/* Materials required */}
            {quote.build_materials && quote.build_materials.length > 0 && (
              <div className={styles.materialsSection}>
                <span className={styles.materialsLabel}>Materials Required</span>
                <div className={styles.materialsList}>
                  {quote.build_materials.map((mat) => (
                    <span key={mat.item_id} className={styles.materialTag}>
                      {mat.quantity}x {mat.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Commission actions */}
            {quote.can_commission && (
              <div className={styles.quoteActions}>
                <ActionButton
                  label="Pay Credits Only"
                  icon={<Coins size={12} />}
                  onClick={() => handleCommission(false)}
                  disabled={!quote.can_afford_credits_only}
                  loading={loadingCommission}
                  size="sm"
                />
                {quote.build_materials && quote.build_materials.length > 0 && (
                  <ActionButton
                    label="Provide Materials"
                    icon={<Package size={12} />}
                    onClick={() => handleCommission(true)}
                    disabled={!quote.can_afford_provide_materials}
                    loading={loadingCommission}
                    size="sm"
                    variant="secondary"
                  />
                )}
              </div>
            )}
            {!quote.can_commission && (
              <div className={styles.emptyState}>
                This shipyard cannot build this ship class
              </div>
            )}
          </div>
        )}

        {/* Active Commissions */}
        <span className={styles.sectionTitle}>Active Commissions</span>
        <ActionButton
          label="Check Status"
          icon={<RefreshCw size={12} />}
          onClick={handleCheckStatus}
          loading={loadingStatus}
          size="sm"
          variant="secondary"
        />

        {commissions && commissions.commissions.length === 0 && (
          <div className={styles.emptyState}>No active commissions</div>
        )}

        {commissions && commissions.commissions.length > 0 && (
          <div className={styles.commissionsList}>
            {commissions.commissions.map((c) => (
              <CommissionCard
                key={c.commission_id}
                commission={c}
                cancelConfirm={cancelConfirm}
                onClaim={handleClaim}
                onCancelRequest={(id) => setCancelConfirm(id)}
                onCancelConfirm={handleCancel}
                onCancelDismiss={() => setCancelConfirm(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface CommissionCardProps {
  commission: Commission
  cancelConfirm: string | null
  onClaim: (id: string) => void
  onCancelRequest: (id: string) => void
  onCancelConfirm: (id: string) => void
  onCancelDismiss: () => void
}

function CommissionCard({
  commission: c,
  cancelConfirm,
  onClaim,
  onCancelRequest,
  onCancelConfirm,
  onCancelDismiss,
}: CommissionCardProps) {
  const isReady = c.status === 'ready'
  const isBuilding = c.status === 'building'
  const isGathering = c.status === 'gathering_materials'

  const statusClass = isReady
    ? styles.statusReady
    : isGathering
      ? styles.statusGathering
      : styles.statusBuilding

  const statusLabel = isReady
    ? 'Ready'
    : isGathering
      ? 'Gathering'
      : 'Building'

  return (
    <div className={isReady ? styles.commissionCardReady : styles.commissionCard}>
      <div className={styles.commissionTop}>
        <div className={styles.commissionInfo}>
          <span className={styles.commissionName}>{c.ship_name}</span>
          <span className={statusClass}>{statusLabel}</span>
        </div>
        <div className={styles.commissionActions}>
          {isReady && (
            <ActionButton
              label="Claim"
              icon={<Check size={11} />}
              onClick={() => onClaim(c.commission_id)}
              size="sm"
            />
          )}
          {!isReady && cancelConfirm !== c.commission_id && (
            <ActionButton
              label="Cancel"
              icon={<X size={11} />}
              onClick={() => onCancelRequest(c.commission_id)}
              size="sm"
              variant="danger"
            />
          )}
        </div>
      </div>

      {/* Confirmation */}
      {cancelConfirm === c.commission_id && (
        <div className={styles.confirmOverlay}>
          <AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />
          <span className={styles.confirmText}>
            Cancel this commission? Refund may be partial.
          </span>
          <div className={styles.confirmActions}>
            <ActionButton
              label="Yes"
              onClick={() => onCancelConfirm(c.commission_id)}
              size="sm"
              variant="danger"
            />
            <ActionButton
              label="No"
              onClick={onCancelDismiss}
              size="sm"
              variant="secondary"
            />
          </div>
        </div>
      )}

      {/* Commission meta */}
      <div className={styles.commissionMeta}>
        <div className={styles.commissionStat}>
          <span className={styles.commissionStatIcon}><MapPin size={10} /></span>
          <span className={styles.commissionStatLabel}>Base</span>
          <span className={styles.commissionStatValue}>{c.base_name}</span>
        </div>
        {!isReady && c.ticks_remaining > 0 && (
          <div className={styles.commissionStat}>
            <span className={styles.commissionStatIcon}><Clock size={10} /></span>
            <span className={styles.commissionStatLabel}>ETA</span>
            <span className={styles.commissionStatValue}>{c.ticks_remaining} ticks</span>
          </div>
        )}
      </div>

      {/* Progress bar for building */}
      {isBuilding && c.ticks_remaining > 0 && (
        <div className={styles.progressBarOuter}>
          <div
            className={styles.progressBarInner}
            style={{ width: `${Math.max(5, 100 - (c.ticks_remaining * 2))}%` }}
          />
        </div>
      )}

      {/* Ready progress bar */}
      {isReady && (
        <div className={styles.progressBarOuter}>
          <div className={styles.progressBarReady} style={{ width: '100%' }} />
        </div>
      )}

      {/* Materials progress for gathering status */}
      {isGathering && c.materials_gathered && c.materials_gathered.length > 0 && (
        <div className={styles.materialsProgress}>
          {c.materials_gathered.map((mat) => (
            <div key={mat.item_id} className={styles.materialProgressRow}>
              <span className={styles.materialProgressName}>{mat.name}</span>
              <span
                className={
                  mat.have >= mat.need
                    ? styles.materialProgressComplete
                    : styles.materialProgressValue
                }
              >
                {mat.have}/{mat.need}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
