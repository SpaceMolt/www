'use client'

import { useMemo, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useCargo, useCommandMutation, useLocationState, usePlayer } from '@/lib/spacemolt'
import { getItem, formatItemId } from '@/data/catalog'
import { ConfirmAction, ItemSelectList, QtyButtons, shared, useAction } from '../../shared'
import { normalizeCargo, selectedItems, type Selection } from '../../shared/itemSelection'
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
  const mutate = useCommandMutation()
  const credits = usePlayer()?.credits ?? 0
  const nearby = useLocationState()?.nearby_players ?? []
  const cargo = useCargo()

  const [target, setTarget] = useState('')
  const [offer, setOffer] = useState<Selection>({})
  const [offerCredits, setOfferCredits] = useState('')
  const [request, setRequest] = useState<Picks>({})
  const [requestCredits, setRequestCredits] = useState('')
  const [confirming, setConfirming] = useState(false)
  const { busy, run } = useAction()

  const cargoRows = useMemo(() => normalizeCargo(cargo), [cargo])

  const offerItems = selectedItems(cargoRows, offer)
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
    const sent = await run(
      'send',
      () => mutate((c) => c.spacemolt_transfer.trade_offer({
        target: target.trim(),
        offer_items: offerItems.length ? offerItems : undefined,
        offer_credits: give || undefined,
        request_items: requestItems.length ? requestItems : undefined,
        request_credits: get || undefined,
      }), { label: 'trade_offer' }),
      `Trade offer sent to ${target.trim()}`,
    )
    if (!sent) return
    onSent()
    onClose()
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
      <ItemSelectList items={cargoRows} selection={offer} onChange={setOffer} empty="Your cargo is empty." />
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
            disabled={!target.trim() || isEmpty || busy !== null || give > credits}
            type="button"
          >
            <Send size={11} /> Send Offer
          </button>
        </div>
      )}
    </div>
  )
}
