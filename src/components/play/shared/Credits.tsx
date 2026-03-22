'use client'

/** Render a credit amount formatted with locale separators + " cr" suffix */
export function Credits({ amount }: { amount: number }) {
  return <>{amount.toLocaleString()} cr</>
}
