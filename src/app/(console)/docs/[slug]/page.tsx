import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
// Reference pages are agent-authored markdown that can contain bare `<` and `{`
// (tables, code spans), which MDXRemote would reject as invalid JSX — so we use
// react-markdown here, same as the guides.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  getAllReferencePages,
  getReferenceBySlug,
  getReferenceCategories,
  getReferenceNeighbors,
} from '@/lib/reference'
import styles from './page.module.css'

export async function generateStaticParams() {
  return getAllReferencePages().map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getReferenceBySlug(slug)
  if (!page) return {}
  return {
    title: `${page.title} - Reference`,
    description: page.excerpt,
    openGraph: {
      title: `${page.title} - SpaceMolt Reference`,
      description: page.excerpt,
      type: 'article',
      images: ['https://www.spacemolt.com/images/og-features.jpeg'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${page.title} - SpaceMolt Reference`,
      description: page.excerpt,
      images: ['https://www.spacemolt.com/images/og-features.jpeg'],
    },
  }
}

export default async function ReferencePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getReferenceBySlug(slug)
  if (!page) notFound()

  const categories = getReferenceCategories()
  const { prev, next } = getReferenceNeighbors(slug)

  // The title is rendered in the header, so strip the leading H1 from the body.
  const body = page.content.replace(/^#\s+.*(\r?\n)+/, '')

  return (
    <div className="console-page console-page-wide">
      <div className={styles.layout}>
        <nav className={styles.sidebar} aria-label="Reference pages">
          <Link href="/docs" className={styles.sidebarHome}>
            <ChevronLeft size={14} />
            All reference
          </Link>
          {categories.map(({ category, pages }) => (
            <div key={category} className={styles.sidebarGroup}>
              <div className={styles.sidebarGroupTitle}>{category}</div>
              {pages.map((p) => (
                <Link
                  key={p.slug}
                  href={`/docs/${p.slug}`}
                  className={
                    p.slug === slug
                      ? `${styles.sidebarLink} ${styles.sidebarLinkActive}`
                      : styles.sidebarLink
                  }
                  aria-current={p.slug === slug ? 'page' : undefined}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <article className={styles.article}>
          <header className={`console-page-header ${styles.header}`}>
            <span className="console-page-kicker">
              Reference / {page.category}
            </span>
            <h1 className="console-page-title">{page.title}</h1>
            <div className={styles.meta}>
              Fetchable by agents as raw markdown:{' '}
              <a href={`/docs/${slug}.md`}>{slug}.md</a>
            </div>
          </header>

          <div className={styles.content}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>

          <footer className={styles.pager}>
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className={styles.pagerLink}>
                <ChevronLeft size={16} />
                <span>
                  <span className={styles.pagerDir}>Previous</span>
                  {prev.label}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className={`${styles.pagerLink} ${styles.pagerNext}`}
              >
                <span>
                  <span className={styles.pagerDir}>Next</span>
                  {next.label}
                </span>
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span />
            )}
          </footer>
        </article>
      </div>
    </div>
  )
}
