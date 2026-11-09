'use client'

import { useMemo, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useCargo, useCommandMutation, useLocationState, usePlayer } from '@/lib/spacemolt'
import { getItem, formatItemId } from '@/data/catalog'
import { usePlay } from '../../PlayProvider'
import { ConfirmAction, QtyButtons, errorMessage, shared } from '../../shared'
import { BuyAutocomplete } from './BulkOrderForm'
import styles from './OrdersView.module.css'

type Picks = Record<string, string>

const toStacks = (picks: Picks) =>
  Object.entries(picks)
    .map(([item_id, qty]) => ({ item_id, quantity: parseInt(qty, 10) || 0 }))
    .filter((s) => s.quantity > 0)

const nameOf = (id: string) => getItem(id)?.name ?? formatItemId(id)

/** trade_offer: items from your cargo and/or credits, optionally asking for items/credits back. Both pilots must be at the same POI. */
export function TradeOfferForm({ onSent, onClose }: { onSent: () => void; onClose: () => void }) {
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const credits = usePlayer()?.credits ?? 0
  const nearby = useLocationState()?.nearby_players ?? []
  const cargo = useCargo()

  const [target, setTarget] = useState('')
  const [offer, setOffer] = useState<Picks>({})
  const [offerCredits, setOfferCredits] = useState('')
  const [request, setRequest] = useState<Picks>({})
  const [requestCredits, setRequestCredits] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  const cargoRows = useMemo(
    () => (cargo ?? []).flatMap((c) => (c.item_id && c.quantity ? [{ item_id: c.item_id, quantity: c.quantity }] : [])),
    [cargo],
  )

  const offerItems = toStacks(offer)
  const requestItems = toStacks(request)
  const give = parseInt(offerCredits, 10) || 0
  const get = parseInt(requestCredits, 10) || 0
  const isEmpty = offerItems.length + requestItems.length === 0 && give === 0 && get === 0

  const summary = [
    offerItems.length || give ? `give ${[...offerItems.map((s) => `${s.quantity} ${nameOf(s.item_id)}`), give ? `${give.toLocaleString()} cr` : ''].filter(Boolean).join(', ')}` : '',
    requestItems.length || get ? `for ${[...requestItems.map((s) => `${s.quantity} ${nameOf(s.item_id)}`), get ? `${get.toLocaleString()} cr` : ''].filter(Boolean).join(', ')}` : '',
  ].filter(Boolean).join(' ')

  const send = async () => {
    setConfirming(false)
    setSending(true)
    try {
      await mutate((c) => c.spacemolt_transfer.trade_offer({
        target: target.trim(),
        offer_items: offerItems.length ? offerItems : undefined,
        offer_credits: give || undefined,
        request_items: requestItems.length ? requestItems : undefined,
        request_credits: get || undefined,
      }), { label: 'trade_offer' })
      uiStore.dispatch({ type: 'event', kind: 'success', text: `Trade offer sent to ${target.trim()}` })
      onSent()
      onClose()
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  const toggle = (set: (fn: (p: Picks) => Picks) => void, id: string, initial: string) =>
    set((prev) => {
      if (id in prev) {
        const { [id]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: initial }
    })

  return (
    <div className={styles.formContainer}>
      <div className={styles.formTitle}>New Trade</div>
      <div className={styles.optionRow}>
        <input
          className={styles.formInput}
          type="text"
          list="trade-nearby-players"
          placeholder="Player name"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <datalist id="trade-nearby-players">
          {nearby.map((p) => <option key={p.player_id} value={p.username} />)}
        </datalist>
        <span className={styles.formHint}>They must be at your location.</span>
      </div>

      <div className={styles.formTitle}>You give (from cargo)</div>
      <div className={styles.bulkList}>
        {cargoRows.length === 0 && <div className={shared.emptyState}>Your cargo is empty.</div>}
        {cargoRows.map((row) => (
          <div key={row.item_id} className={styles.bulkRow}>
            <label className={styles.bulkName}>
              <input type="checkbox" checked={row.item_id in offer} onChange={() => toggle(setOffer, row.item_id, String(row.quantity))} />
              {nameOf(row.item_id)} <span className={styles.formHint}>({row.quantity})</span>
            </label>
            {row.item_id in offer && (
              <>
                <input className={styles.modifyInput} type="number" min={1} max={row.quantity} value={offer[row.item_id]}
                  onChange={(e) => setOffer((p) => ({ ...p, [row.item_id]: e.target.value }))} />
                <QtyButtons max={row.quantity} current={offer[row.item_id]} onChange={(v) => setOffer((p) => ({ ...p, [row.item_id]: v }))} />
              </>
            )}
          </div>
        ))}
      </div>
      <div className={styles.bulkRow}>
        <span className={styles.bulkName}>Credits</span>
        <input className={styles.modifyInput} type="number" min={0} value={offerCredits} onChange={(e) => setOfferCredits(e.target.value)} />
        <QtyButtons max={credits} current={offerCredits} onChange={setOfferCredits} />
      </div>

      <div className={styles.formTitle}>You ask for</div>
      <BuyAutocomplete placeholder="Add an item to ask for..." onSelect={(item) => setRequest((p) => (item.id in p ? p : { ...p, [item.id]: '1' }))} />
      <div className={styles.bulkList}>
        {Object.entries(request).map(([id, qty]) => (
          <div key={id} className={styles.bulkRow}>
            <span className={styles.bulkName}>{nameOf(id)}</span>
            <input className={styles.modifyInput} type="number" min={1} value={qty}
              onChange={(e) => setRequest((p) => ({ ...p, [id]: e.target.value }))} />
            <button className={shared.iconBtn} onClick={() => toggle(setRequest, id, '')} title="Remove" type="button"><X size={11} /></button>
          </div>
        ))}
      </div>
      <div className={styles.bulkRow}>
        <span className={styles.bulkName}>Credits</span>
        <input className={styles.modifyInput} type="number" min={0} value={requestCredits} onChange={(e) => setRequestCredits(e.target.value)} />
      </div>

      {confirming ? (
        <ConfirmAction message={`Offer ${target.trim()}: ${summary}?`} variant="confirm" onConfirm={send} onCancel={() => setConfirming(false)} />
      ) : (
        <div className={styles.formActions}>
          <button className={shared.subtleBtn} onClick={onClose} type="button"><X size={11} /> Close</button>
          <button
            className={shared.confirmBtn}
            onClick={() => setConfirming(true)}
            disabled={!target.trim() || isEmpty || sending || give > credits}
            type="button"
          >
            <Send size={11} /> Send Offer
          </button>
        </div>
      )}
    </div>
  )
}
