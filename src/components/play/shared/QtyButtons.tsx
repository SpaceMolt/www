'use client'

import { formatCompact } from '@/lib/format'
import shared from '../shared.module.css'

/** +5/+10/+100/MAX buttons (or other `steps`, e.g. credits) for a quantity input. Values are strings to match the input. */
export function QtyButtons({ max, current, onChange, steps = [5, 10, 100] }: { max: number; current: string; onChange: (v: string) => void; steps?: number[] }) {
  const cur = parseInt(current, 10) || 0
  const add = (n: number) => onChange(String(Math.min(max, cur + n)))
  return (
    <div className={shared.qtyButtons}>
      {steps.map((n) => (
        <button key={n} className={shared.qtyBtn} onClick={(e) => { e.stopPropagation(); add(n) }} disabled={cur >= max} type="button">+{formatCompact(n)}</button>
      ))}
      <button className={`${shared.qtyBtn} ${shared.qtyBtnMax}`} onClick={(e) => { e.stopPropagation(); onChange(String(max)) }} disabled={cur >= max} type="button">MAX</button>
    </div>
  )
}
