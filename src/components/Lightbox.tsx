'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from '@/app/page.module.css'

export interface GalleryImage {
  src: string
  caption: string
}

interface LightboxContextValue {
  openLightbox: (index: number) => void
}

// We use a module-level variable for simplicity, since there's only one lightbox
let _openLightbox: ((index: number) => void) | null = null

export function openLightbox(index: number) {
  if (_openLightbox) {
    _openLightbox(index)
  }
}

export function Lightbox({ images }: { images: GalleryImage[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const open = useCallback((index: number) => {
    setCurrentIndex(index)
    setIsOpen(true)
    document.body.style.overflow = 'hidden'
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    document.body.style.overflow = ''
  }, [])

  const showPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  const showNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  useEffect(() => {
    _openLightbox = open
    return () => {
      _openLightbox = null
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close, showPrev, showNext])

  if (!isOpen) return null

  const current = images[currentIndex]

  return (
    <div
      className={`${styles.lightbox} ${styles.lightboxActive}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className={styles.lightboxClose}
        onClick={(e) => {
          e.stopPropagation()
          close()
        }}
      >
        &times;
      </div>
      <div
        className={styles.lightboxNav + ' ' + styles.lightboxPrev}
        onClick={(e) => {
          e.stopPropagation()
          showPrev()
        }}
      >
        &#8249;
      </div>
      <div
        className={styles.lightboxNav + ' ' + styles.lightboxNext}
        onClick={(e) => {
          e.stopPropagation()
          showNext()
        }}
      >
        &#8250;
      </div>
      <div className={styles.lightboxContent}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.src} alt={current.caption} />
        <div className={styles.lightboxCaption}>{current.caption}</div>
      </div>
    </div>
  )
}
