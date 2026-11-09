'use client'

import { useId, useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { useCommandMutation, usePlayer } from '@/lib/spacemolt'
import { usePlay, usePlayUi } from '../../PlayProvider'
import { Credits, ItemSelectList, errorMessage, shared, useStorageMove } from '../../shared'
import type { SelectableItem, Selection } from '../../shared/itemSelection'
import type { UiState } from '@/lib/spacemolt'
import { planGift } from './giftValidation'
import styles from './StorageView.module.css'

export interface GiftShip {
  ship_id: string
  label: string
}

const selectChat = (s: UiState) => s.chatMessages
const selectGifts = (s: UiState) => s.gifts

/**
 * Gift any mix of items (from cargo or storage), credits and ships to one player. Items go in bulk
 * calls, credits in one call, and each ship in its own call (one tick each). Credits and ships work
 * undocked; items need a station.
 */
export function GiftForm({ cargo, stored, ships, isDocked }: {
  cargo: SelectableItem[]
  stored: SelectableItem[]
  ships: GiftShip[]
  isDocked: boolean
}) {
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const move = useStorageMove()
  const wallet = usePlayer()?.credits ?? 0
  const listId = useId()

  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [credits, setCredits] = useState('')
  const [source, setSource] = useState<'cargo' | 'storage'>('cargo')
  const [selection, setSelection] = useState<Selection>({})
  const [shipIds, setShipIds] = useState<string[]>([])
  const [progress, setProgress] = useState<string | null>(null)

  // No public player search exists, so suggest names this session has seen.
  const chat = usePlayUi(selectChat)
  const gifts = usePlayUi(selectGifts)
  const suggestions = useMemo(
    () => [...new Set([...chat.map((m) => m.sender), ...gifts.map((g) => g.sender)].filter(Boolean))].sort(),
    [chat, gifts],
  )

  const items = isDocked ? (source === 'cargo' ? cargo : stored) : []
  const liveShipIds = shipIds.filter((id) => ships.some((s) => s.ship_id === id))
  const result = planGift({ recipient, credits, items, selection, shipIds: liveShipIds, wallet })
  const problem = 'problem' in result ? result.problem : null

  const reportError = (err: unknown) => uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })

  const handleSend = async () => {
    if (!('plan' in result)) return
    const { plan } = result
    const target = plan.recipient
    const note = message.trim() || undefined
    let allSent = true
    try {
      if (plan.items.length > 0) {
        setProgress('Sending items...')
        const kept = await move('Gifted', plan.items, (c, batch) =>
          c.spacemolt_storage.deposit({ target, items: batch, message: note, source: source === 'storage' ? 'storage' : undefined }),
        )
        setSelection(kept)
        allSent &&= Object.keys(kept).length === 0
      }
      if (plan.credits > 0) {
        setProgress('Sending credits...')
        try {
          await mutate((c) => c.spacemolt_storage.deposit({ target, credits: plan.credits, message: note }), { label: 'send_gift' })
          setCredits('')
        } catch (err) {
          allSent = false
          reportError(err)
        }
      }
      for (const [index, shipId] of plan.shipIds.entries()) {
        setProgress(`Sending ship ${index + 1} of ${plan.shipIds.length}...`)
        try {
          await mutate((c) => c.spacemolt_storage.deposit({ target, item_id: shipId, message: note }), { label: 'gift_ship' })
          setShipIds((prev) => prev.filter((id) => id !== shipId))
        } catch (err) {
          allSent = false
          reportError(err)
        }
      }
    } finally {
      setProgress(null)
      uiStore.dispatch({ type: 'storage_changed' })
    }
    if (allSent) {
      setMessage('')
      uiStore.dispatch({ type: 'event', kind: 'success', text: `Gift sent to ${target}` })
    }
  }

  return (
    <div className={styles.giftSendForm}>
      <input
        className={shared.textInput}
        type="text"
        placeholder="Recipient username"
        list={listId}
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((name) => <option key={name} value={name} />)}
      </datalist>
      <input
        className={shared.textInput}
        type="text"
        placeholder="Message (optional)"
        maxLength={500}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className={styles.giftSendRow}>
        <input
          className={shared.textInput}
          type="number"
          min={1}
          step={1}
          placeholder="Credits"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
        <span className={styles.itemQty}>Wallet: <Credits amount={wallet} /></span>
      </div>

      {isDocked ? (
        <>
          <div className={styles.giftSendRow}>
            <span className={styles.itemQty}>Items from</span>
            {(['cargo', 'storage'] as const).map((s) => (
              <button
                key={s}
                className={source === s ? shared.accentBtn : shared.subtleBtn}
                onClick={() => { setSource(s); setSelection({}) }}
                type="button"
              >
                {s === 'cargo' ? 'Cargo' : 'Storage'}
              </button>
            ))}
          </div>
          <ItemSelectList
            items={items}
            selection={selection}
            onChange={setSelection}
            empty={source === 'cargo' ? 'Cargo hold is empty' : 'No items in storage'}
          />
        </>
      ) : (
        <div className={shared.emptyState}>Dock at a station to gift items. Credits and ships can be sent from anywhere.</div>
      )}

      {ships.length > 0 && (
        <div className={styles.itemList}>
          {ships.map((ship) => (
            <label key={ship.ship_id} className={styles.itemRow}>
              <span className={styles.itemInfo}>
                <input
                  type="checkbox"
                  checked={shipIds.includes(ship.ship_id)}
                  onChange={(e) => setShipIds((prev) => e.target.checked ? [...prev, ship.ship_id] : prev.filter((id) => id !== ship.ship_id))}
                />
                <span className={styles.itemName}>{ship.label}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {problem && recipient.trim() && <div className={styles.itemQty}>{problem}</div>}
      <button className={shared.confirmBtn} onClick={handleSend} disabled={progress !== null || problem !== null} type="button">
        <Send size={10} />
        {progress ?? 'Send Gift'}
      </button>
    </div>
  )
}
