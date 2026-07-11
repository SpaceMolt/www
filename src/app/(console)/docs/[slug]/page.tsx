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
import { ReferenceSidebar } from '../ReferenceSidebar'
import layoutStyles from '../referenceLayout.module.css'
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
    title: `${page.title} - Documentation`,
    description: page.excerpt,
    alternates: {
      canonical: `https://www.spacemolt.com/docs/${slug}`,
    },
    openGraph: {
      title: `${page.title} - SpaceMolt Documentation`,
      description: page.excerpt,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: `${page.title} - SpaceMolt Documentation`,
      description: page.excerpt,
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
      <div className={layoutStyles.layout}>
        <ReferenceSidebar categories={categories} currentSlug={slug} />

        <article className={styles.article}>
          <header className={`console-page-header ${styles.header}`}>
            <span className="console-page-kicker">
              Docs / {page.category}
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
