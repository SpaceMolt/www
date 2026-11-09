'use client'

import type { MouseEvent } from 'react'
import { formatCompact } from '@/lib/format'
import shared from '../shared.module.css'

const POWERS_OF_TEN = Array.from({ length: 10 }, (_, i) => 10 ** i)

/** The three largest powers of ten up to max: +1/+10/+100 for a cargo stack, +10K/+100K/+1M for a big wallet. */
export const qtySteps = (max: number): number[] => POWERS_OF_TEN.filter((n) => n <= Math.max(1, max)).slice(-3)

/**
 * Step buttons for a quantity input: a + and - button per step, MAX, and CLR.
 * Values are strings to match the input. The result stays between 0 and max.
 */
export function QtyButtons({ max, current, onChange }: { max: number; current: string; onChange: (v: string) => void }) {
  const cur = parseInt(current, 10) || 0
  const press = (n: number) => (e: MouseEvent) => {
    e.stopPropagation()
    onChange(String(Math.min(max, Math.max(0, n))))
  }
  return (
    <div className={shared.qtyButtons}>
      {qtySteps(max).map((n) => (
        <span key={n} className={shared.qtyPair}>
          <button className={shared.qtyBtn} onClick={press(cur + n)} disabled={cur >= max} aria-label={`Add ${n}`} type="button">+{formatCompact(n)}</button>
          <button className={shared.qtyBtn} onClick={press(cur - n)} disabled={cur <= 0} aria-label={`Subtract ${n}`} type="button">-{formatCompact(n)}</button>
        </span>
      ))}
      <span className={shared.qtyPair}>
        <button className={`${shared.qtyBtn} ${shared.qtyBtnMax}`} onClick={press(max)} disabled={cur >= max} aria-label={`Set to the maximum, ${max}`} type="button">MAX</button>
        <button className={shared.qtyBtn} onClick={press(0)} disabled={cur <= 0} aria-label="Clear" type="button">CLR</button>
      </span>
    </div>
  )
}
