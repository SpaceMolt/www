import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
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
  return (
    <nav className={styles.sidebar} aria-label="Documentation pages">
      {currentSlug && (
        <Link href="/docs" className={styles.sidebarHome}>
          <ChevronLeft size={14} />
          All documentation
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
  )
}
