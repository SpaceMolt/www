'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import shared from '../shared.module.css'

/** A collapsible panel section: an icon, an uppercase title, and a chevron. */
export function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button className={shared.sectionToggle} onClick={() => setOpen(!open)} type="button" aria-expanded={open}>
        <span className={shared.sectionIcon}>{icon}</span>
        <span className={shared.sectionTitle}>{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && children}
    </div>
  )
}
