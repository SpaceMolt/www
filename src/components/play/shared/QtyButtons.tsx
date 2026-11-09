'use client'

import shared from '../shared.module.css'

/** +5/+10/+100/MAX buttons for a quantity input. Values are strings to match the input. */
export function QtyButtons({ max, current, onChange }: { max: number; current: string; onChange: (v: string) => void }) {
  const cur = parseInt(current, 10) || 0
  const add = (n: number) => onChange(String(Math.min(max, cur + n)))
  return (
    <div className={shared.qtyButtons}>
      {[5, 10, 100].map((n) => (
        <button key={n} className={shared.qtyBtn} onClick={(e) => { e.stopPropagation(); add(n) }} disabled={cur >= max} type="button">+{n}</button>
      ))}
      <button className={`${shared.qtyBtn} ${shared.qtyBtnMax}`} onClick={(e) => { e.stopPropagation(); onChange(String(max)) }} disabled={cur >= max} type="button">MAX</button>
    </div>
  )
}
