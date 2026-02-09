'use client'

import { type ReactNode } from 'react'
import { openLightbox } from './Lightbox'

interface GalleryItemProps {
  index: number
  className?: string
  children: ReactNode
}

export function GalleryItem({ index, className, children }: GalleryItemProps) {
  return (
    <div
      className={className}
      onClick={() => openLightbox(index)}
    >
      {children}
    </div>
  )
}
