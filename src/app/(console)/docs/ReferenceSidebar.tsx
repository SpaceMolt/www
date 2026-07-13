'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronDown, BookOpen } from 'lucide-react'
import styles from './referenceLayout.module.css'

export interface ReferenceSidebarPage {
  slug: string
  label: string
}

export interface ReferenceSidebarCategory {
  category: string
  pages: ReferenceSidebarPage[]
}

interface ReferenceSidebarProps {
  categories: ReferenceSidebarCategory[]
  /** Slug of the page being viewed; omit on the /docs index itself. */
  currentSlug?: string
}

export function ReferenceSidebar({
  categories,
  currentSlug,
}: ReferenceSidebarProps) {
  // On phones the full page list is longer than the article it sits above, so
  // it collapses behind a toggle; the desktop grid ignores this state entirely.
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const currentLabel = currentSlug
    ? categories
        .flatMap((c) => c.pages)
        .find((p) => p.slug === currentSlug)?.label
    : undefined

  return (
    <div
      className={
        currentSlug
          ? styles.sidebarWrap
          : `${styles.sidebarWrap} ${styles.sidebarWrapIndex}`
      }
    >
      <button
        type="button"
        className={styles.sidebarToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="reference-sidebar"
      >
        <BookOpen size={14} aria-hidden />
        <span className={styles.sidebarToggleLabel}>
          {currentLabel ?? 'All reference'}
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={open ? styles.sidebarChevronOpen : styles.sidebarChevron}
        />
      </button>

      <nav
        id="reference-sidebar"
        className={`${styles.sidebar} ${open ? styles.sidebarExpanded : ''}`}
        aria-label="Documentation pages"
      >
        {currentSlug && (
          <Link href="/docs" className={styles.sidebarHome}>
            <ChevronLeft size={14} />
            All reference
          </Link>
        )}
        {categories.map(({ category, pages }) => (
          <div key={category} className={styles.sidebarGroup}>
            <div className={styles.sidebarGroupTitle}>{category}</div>
            {pages.map((p) => (
              <Link
                key={p.slug}
                href={`/docs/${p.slug}`}
                className={
                  p.slug === currentSlug
                    ? `${styles.sidebarLink} ${styles.sidebarLinkActive}`
                    : styles.sidebarLink
                }
                aria-current={p.slug === currentSlug ? 'page' : undefined}
              >
                {p.label}
              </Link>
            ))}
          </div>
        ))}
        <div className={styles.sidebarGroup}>
          <div className={styles.sidebarGroupTitle}>Resources</div>
          <Link href="/glossary" className={styles.sidebarLink}>
            Glossary
          </Link>
        </div>
      </nav>
    </div>
  )
}
