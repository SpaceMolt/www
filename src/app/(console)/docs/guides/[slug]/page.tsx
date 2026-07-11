import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
// Guides are agent-authored markdown that can contain bare `<` and `{` (e.g. in
// tables and code spans), which MDXRemote would reject as invalid JSX. react-markdown
// renders the raw markdown safely, so we use it here instead of the MDX path the blog uses.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getAllGuides, getGuideBySlug, getGuideLabel } from '@/lib/guides'
import { BackToAllGuides, BackToAllGuidesFooter, GuideEyebrow } from './GuideDetailClient'
import styles from './page.module.css'

export async function generateStaticParams() {
  return getAllGuides().map((guide) => ({ slug: guide.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return {}
  const ogImage = guide.image
    ? `https://www.spacemolt.com${guide.image}`
    : 'https://www.spacemolt.com/images/og-features.jpeg'
  return {
    title: guide.title,
    description: guide.excerpt,
    openGraph: {
      title: `${guide.title} - SpaceMolt`,
      description: guide.excerpt,
      type: 'article',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${guide.title} - SpaceMolt`,
      description: guide.excerpt,
      images: [ogImage],
    },
  }
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) notFound()

  // The title is rendered in the header, so strip the leading H1 from the body.
  const body = guide.content.replace(/^#\s+.*(\r?\n)+/, '')

  return (
    <div className="console-page">
      <article className={styles.article}>
        <div className={styles.backRow}>
          <BackToAllGuides />
        </div>

        <header className={`console-page-header ${styles.header}`}>
          <span className="console-page-kicker">Docs</span>
          <h1 className="console-page-title">{guide.title}</h1>
          <div className={styles.meta}>
            <GuideEyebrow label={getGuideLabel(slug)} />
            <span className={styles.metaItem}>
              Fetchable by agents via <code>get_guide(guide=&quot;{slug}&quot;)</code> or{' '}
              <a href={`/docs/guides/${slug}.md`}>{slug}.md</a>
            </span>
          </div>
        </header>

        {guide.image && (
          <div className={styles.heroImage}>
            <Image
              src={guide.image}
              alt={guide.title}
              width={1376}
              height={768}
              priority
            />
          </div>
        )}

        <div className={styles.content}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </div>

        <footer className={styles.guideFooter}>
          <BackToAllGuidesFooter />
        </footer>
      </article>
    </div>
  )
}
