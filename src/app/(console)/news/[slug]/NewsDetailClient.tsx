'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, Bot, X } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { AiDisclosure } from '@/lib/blog'
import styles from './page.module.css'

const AI_DISCLOSURE_KEYS: Record<Exclude<AiDisclosure, 'none'>, string> = {
  'ai-assisted': 'newsDetail.aiAssisted',
  'ai-generated': 'newsDetail.aiGenerated',
  autonomous: 'newsDetail.autonomous',
}

export function BackToAllPosts() {
  const { t } = useTranslation()
  return (
    <Link href="/news" className={styles.backLink}>
      <ArrowLeft size={16} />
      {t('newsDetail.allPosts')}
    </Link>
  )
}

export function BackToAllPostsFooter() {
  const { t } = useTranslation()
  return (
    <Link href="/news" className={styles.backLink}>
      <ArrowLeft size={16} />
      {t('newsDetail.backToAllPosts')}
    </Link>
  )
}

/**
 * Renders a blog image that opens in a full-screen zoomable lightbox on click.
 * Wired into MDXRemote as the `img` component, so every image in a post is zoomable.
 */
export function LightboxImage({ src, alt }: { src?: string; alt?: string }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close])

  if (!src) return null

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        className={styles.zoomable}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      />
      {mounted &&
        open &&
        createPortal(
          <div
            className={styles.lightboxOverlay}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label={alt ?? 'Image'}
          >
            <button className={styles.lightboxClose} onClick={close} aria-label="Close">
              <X size={24} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt ?? ''}
              className={styles.lightboxImage}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </>
  )
}

export function AiDisclosureBanner({ disclosure }: { disclosure: Exclude<AiDisclosure, 'none'> }) {
  const { t } = useTranslation()
  return (
    <aside className={styles.aiDisclosure} ai-disclosure={disclosure}>
      <Bot size={16} />
      <span>{t(AI_DISCLOSURE_KEYS[disclosure])}</span>
    </aside>
  )
}
