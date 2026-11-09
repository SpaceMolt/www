'use client'

import { useId, useState, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import shared from '../shared.module.css'

// Half the tip's max width plus a margin, so a centred tip never leaves the window.
const EDGE = 128

/**
 * Styled popover for reasons, full names and tick counts: opens on hover, keyboard focus and tap.
 * Use it instead of `title=` for anything a player needs to read. Renders children alone when content is empty.
 */
export function Tip({ content, children }: { content?: ReactNode; children: ReactNode }) {
  const id = useId()
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null)
  if (content == null || content === '' || content === false) return <>{children}</>

  const show = (e: SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const below = r.top < 80
    const x = Math.min(Math.max(r.left + r.width / 2, EDGE), window.innerWidth - EDGE)
    setAt({ x, y: below ? r.bottom + 6 : r.top - 6, below })
  }
  const hide = () => setAt(null)

  return (
    <span
      className={shared.tip}
      tabIndex={0}
      aria-describedby={at ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {at && createPortal(
        <span id={id} role="tooltip" className={`${shared.tipBox} ${at.below ? shared.tipBelow : ''}`} style={{ left: at.x, top: at.y }}>
          {content}
        </span>,
        document.body,
      )}
    </span>
  )
}
